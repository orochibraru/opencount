import { resolve } from "$app/paths";
import { fail, redirect } from "@sveltejs/kit";
import { z } from "zod";

import { BankConnectionDTO } from "#lib/dto/bank-connection.js";
import { bankCredentialsFor } from "#lib/dto/bank-credential.js";
import { PersonalExpenseDTO } from "#lib/dto/personal-expense.js";
import { publicOrigin } from "#lib/server/auth.js";
import { queueBankSync } from "#lib/server/bank-sync.js";
import {
	BankError,
	bankLinkPurpose,
	closeBankSession,
	startBankLink,
} from "#lib/server/enable-banking.js";
import { signPayload } from "#lib/server/secrets.js";
import { idSchema, parseForm } from "#lib/server/validation/form.js";

const bankSchema = z.object({
	name: z.string().min(1, "Pick a bank."),
	country: z.string().regex(/^[A-Z]{2}$/, "Pick a country."),
});
const syncSchema = idSchema.extend({ full: z.stringbool().default(false) });

export const load = async ({ parent }) => {
	const { user } = await parent();
	const historyFrom = PersonalExpenseDTO.historyFromBank(user.id);
	return {
		connections: BankConnectionDTO.forUser(user.id).map((entry) => ({
			...entry.toJSON(),
			syncing: entry.syncing(),
			historyFrom: historyFrom[entry.id] ?? null,
		})),
	};
};

export const actions = {
	connectBank: async ({ locals, request, url }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const credentials = bankCredentialsFor(locals.user.id);
		if (!credentials) {
			return fail(400, { error: "Set up bank sync first." });
		}
		const parsed = parseForm(bankSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		let target: string;
		try {
			target = await startBankLink(
				credentials,
				parsed.data,
				new URL(
					resolve("/(protected)/personal/bank"),
					publicOrigin() ?? url.origin,
				).href,
				signPayload(
					{ userId: locals.user.id },
					bankLinkPurpose,
					30 * 60 * 1000,
				),
			);
		} catch (error) {
			if (error instanceof BankError) {
				return fail(400, { error: error.message });
			}
			throw error;
		}
		redirect(303, target, { external: true });
	},
	syncBank: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const parsed = parseForm(syncSchema, await request.formData());
		const connection = parsed.success
			? BankConnectionDTO.findForUser(parsed.data.id, locals.user.id)
			: undefined;
		if (!parsed.success || !connection) {
			return fail(404, { error: "That bank isn't linked anymore." });
		}
		queueBankSync(connection, parsed.data.full);
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
			await closeBankSession(credentials, connection.sessionId);
		}
		connection.delete();
		return { disconnected: true };
	},
};
