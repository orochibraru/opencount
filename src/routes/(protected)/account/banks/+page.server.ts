import { createPrivateKey } from "node:crypto";

import { resolve } from "$app/paths";
import { fail, redirect } from "@sveltejs/kit";
import { z } from "zod";

import { AppearanceDTO } from "#lib/dto/appearance.js";
import { BankConnectionDTO } from "#lib/dto/bank-connection.js";
import {
	bankCredentialsFor,
	removeBankCredentials,
	saveBankCredentials,
} from "#lib/dto/bank-credential.js";
import { PersonalExpenseDTO } from "#lib/dto/personal-expense.js";
import { publicOrigin } from "#lib/server/auth.js";
import { queueBankSync } from "#lib/server/bank-sync.js";
import {
	bankApplicationName,
	BankError,
	bankLinkPurpose,
	closeBankSession,
	startBankLink,
} from "#lib/server/enable-banking.js";
import { encryptSecret, signPayload } from "#lib/server/secrets.js";
import {
	recentSignInMessage,
	signedInRecently,
} from "#lib/server/security-policy.js";
import { idSchema, parseForm } from "#lib/server/validation/form.js";

const bankSchema = z.object({
	name: z.string().min(1, "Pick a bank."),
	country: z.string().regex(/^[A-Z]{2}$/, "Pick a country."),
});
const syncSchema = idSchema.extend({ full: z.stringbool().default(false) });

const homeSchema = z.object({ moneyHome: z.stringbool().default(false) });

const credentialsSchema = z.object({
	applicationId: z.string().trim().min(1, "Paste the application ID."),
	privateKey: z
		.string()
		.trim()
		.refine((value) => {
			try {
				createPrivateKey(value);
				return true;
			} catch {
				return false;
			}
		}, "Paste the private key, from -----BEGIN to the END line."),
});

export const load = async ({ parent, url }) => {
	const { user } = await parent();
	const historyFrom = PersonalExpenseDTO.historyFromBank(user.id);
	return {
		applicationId: bankCredentialsFor(user.id)?.applicationId ?? null,
		connections: BankConnectionDTO.forUser(user.id).map((entry) => ({
			...entry.toJSON(),
			syncing: entry.syncing(),
			historyFrom: historyFrom[entry.id] ?? null,
		})),
		moneyHome: AppearanceDTO.homeFor(user.id) === "money",
		redirectUrl: new URL(
			resolve("/(protected)/personal/bank"),
			publicOrigin() ?? url.origin,
		).href,
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
	home: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const parsed = parseForm(homeSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { error: "Pick whether to show the Home tab." });
		}
		AppearanceDTO.saveHome(
			locals.user.id,
			parsed.data.moneyHome ? "money" : "groups",
		);
		return { saved: true };
	},
	save: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		if (!locals.session || !signedInRecently(locals.session)) {
			return fail(403, { error: recentSignInMessage });
		}
		const parsed = parseForm(credentialsSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		const credentials = {
			applicationId: parsed.data.applicationId,
			encryptedPrivateKey: encryptSecret(parsed.data.privateKey),
		};
		try {
			const application = await bankApplicationName(credentials);
			saveBankCredentials(locals.user.id, credentials);
			return { application };
		} catch (error) {
			if (error instanceof BankError) {
				return fail(400, {
					error: `Enable Banking refused these keys: ${error.message}`,
				});
			}
			throw error;
		}
	},
	remove: ({ locals }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		if (!locals.session || !signedInRecently(locals.session)) {
			return fail(403, { error: recentSignInMessage });
		}
		removeBankCredentials(locals.user.id);
		return { removed: true };
	},
};
