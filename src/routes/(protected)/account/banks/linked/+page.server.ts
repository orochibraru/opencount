import { resolve } from "$app/paths";
import { fail, redirect } from "@sveltejs/kit";
import { z } from "zod";

import { BankConnectionDTO } from "#lib/dto/bank-connection.js";
import { bankCredentialsFor } from "#lib/dto/bank-credential.js";
import { JobDTO } from "#lib/dto/job.js";
import { PersonalExpenseDTO } from "#lib/dto/personal-expense.js";
import { authService } from "#lib/server/auth/auth.js";
import { bankSync } from "#lib/server/banking/bank-sync.js";
import {
	BankError,
	bankLinkPurpose,
	EnableBankingClient,
} from "#lib/server/banking/enable-banking.js";
import { secrets } from "#lib/server/core/secrets.js";
import { idSchema, parseForm } from "#lib/server/validation/form.js";
import { accountNamesSchema } from "#lib/server/validation/personal.js";

const bankSchema = z.object({
	name: z.string().min(1, "Pick a bank."),
	country: z.string().regex(/^[A-Z]{2}$/, "Pick a country."),
});

async function openBank(
	userId: string,
	bank: { name: string; country: string },
	url: URL,
	connectionId?: string,
) {
	if (!bankSync.enabled()) {
		return fail(403, { error: bankSync.offMessage });
	}
	const credentials = bankCredentialsFor(userId);
	if (!credentials) {
		return fail(400, { error: "Set up bank sync first." });
	}
	let target: string;
	try {
		target = await new EnableBankingClient(credentials).startLink(
			bank,
			new URL(
				resolve("/(protected)/personal/bank"),
				authService.publicOrigin() ?? url.origin,
			).href,
			secrets.sign({ userId, connectionId }, bankLinkPurpose, 30 * 60 * 1000),
		);
	} catch (error) {
		if (error instanceof BankError) {
			return fail(400, { error: error.message });
		}
		throw error;
	}
	redirect(303, target, { external: true });
}

export const load = async ({ parent }) => {
	const { user } = await parent();
	const historyFrom = PersonalExpenseDTO.historyFromBank(user.id);
	return {
		connections: BankConnectionDTO.forUser(user.id).map((entry) => ({
			...entry.toJSON(),
			syncing: entry.syncing(),
			historyFrom: historyFrom[entry.id] ?? null,
		})),
		nextSync: JobDTO.nextRun("bank.syncAll") ?? null,
	};
};

export const actions = {
	connectBank: async ({ locals, request, url }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const parsed = parseForm(bankSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		return openBank(locals.user.id, parsed.data, url);
	},
	relinkBank: async ({ locals, request, url }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const parsed = parseForm(idSchema, await request.formData());
		const connection = parsed.success
			? BankConnectionDTO.findForUser(parsed.data.id, locals.user.id)
			: undefined;
		if (!connection) {
			return fail(404, { error: "That bank isn't linked anymore." });
		}
		const { bankName, bankCountry } = connection.toJSON();
		return openBank(
			locals.user.id,
			{ name: bankName, country: bankCountry },
			url,
			connection.id,
		);
	},
	renameAccounts: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const parsed = parseForm(accountNamesSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, {
				error: Object.values(parsed.errors)[0]?.[0] ?? "Check the names.",
			});
		}
		const connection = BankConnectionDTO.findForUser(
			parsed.data.id,
			locals.user.id,
		);
		if (!connection) {
			return fail(404, { error: "That bank isn't linked anymore." });
		}
		for (const account of connection.accounts) {
			const name = parsed.data[`name-${account.uid}`];
			if (name !== undefined) {
				connection.renameAccount(account.uid, name);
			}
		}
		return { renamed: true };
	},
	syncBank: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		if (!bankSync.enabled()) {
			return fail(403, { error: bankSync.offMessage });
		}
		const parsed = parseForm(idSchema, await request.formData());
		const connection = parsed.success
			? BankConnectionDTO.findForUser(parsed.data.id, locals.user.id)
			: undefined;
		if (!parsed.success || !connection) {
			return fail(404, { error: "That bank isn't linked anymore." });
		}
		bankSync.queue(connection);
		return { syncing: true };
	},
	disconnectBank: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const parsed = parseForm(idSchema, await request.formData());
		const connection = parsed.success
			? BankConnectionDTO.findForUser(parsed.data.id, locals.user.id)
			: undefined;
		if (!connection) {
			return fail(404, { error: "That bank isn't linked anymore." });
		}
		const credentials = bankCredentialsFor(locals.user.id);
		if (credentials) {
			await new EnableBankingClient(credentials).closeSession(
				connection.sessionId,
			);
		}
		connection.delete();
		return { disconnected: true };
	},
};
