import { createPrivateKey } from "node:crypto";

import { resolve } from "$app/paths";
import { fail } from "@sveltejs/kit";
import { z } from "zod";

import { saveBankCredentials } from "#lib/dto/bank-credential.js";
import { authService } from "#lib/server/auth/auth.js";
import { securityPolicy } from "#lib/server/auth/security-policy.js";
import {
	BankError,
	EnableBankingClient,
} from "#lib/server/banking/enable-banking.js";
import { secrets } from "#lib/server/core/secrets.js";
import { parseForm } from "#lib/server/validation/form.js";

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
	await parent();
	return {
		redirectUrl: new URL(
			resolve("/(protected)/personal/bank"),
			authService.publicOrigin() ?? url.origin,
		).href,
	};
};

export const actions = {
	save: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		if (!locals.session || !securityPolicy.signedInRecently(locals.session)) {
			return fail(403, { error: securityPolicy.recentSignInMessage });
		}
		const parsed = parseForm(credentialsSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		const credentials = {
			applicationId: parsed.data.applicationId,
			encryptedPrivateKey: secrets.encrypt(parsed.data.privateKey),
		};
		try {
			const application = await new EnableBankingClient(
				credentials,
			).applicationName();
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
};
