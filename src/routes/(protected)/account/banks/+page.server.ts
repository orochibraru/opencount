import { createPrivateKey } from "node:crypto";

import { resolve } from "$app/paths";
import { fail } from "@sveltejs/kit";
import { z } from "zod";

import { AppearanceDTO } from "#lib/dto/appearance.js";
import {
	bankCredentialsFor,
	removeBankCredentials,
	saveBankCredentials,
} from "#lib/dto/bank-credential.js";
import { publicOrigin } from "#lib/server/auth.js";
import { bankApplicationName, BankError } from "#lib/server/enable-banking.js";
import { encryptSecret } from "#lib/server/secrets.js";
import { parseForm } from "#lib/server/validation/form.js";

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
	return {
		applicationId: bankCredentialsFor(user.id)?.applicationId ?? null,
		moneyHome: AppearanceDTO.homeFor(user.id) === "money",
		redirectUrl: new URL(
			resolve("/(protected)/personal/bank"),
			publicOrigin() ?? url.origin,
		).href,
	};
};

export const actions = {
	home: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const parsed = parseForm(homeSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { error: "Pick a home page." });
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
		removeBankCredentials(locals.user.id);
		return { removed: true };
	},
};
