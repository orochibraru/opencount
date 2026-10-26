import { createPrivateKey } from "node:crypto";

import { resolve } from "$app/paths";
import { fail } from "@sveltejs/kit";
import { z } from "zod";

import { getSetting, setSetting } from "#lib/dto/setting.js";
import { adminFrom } from "#lib/server/admin.js";
import { publicOrigin } from "#lib/server/auth.js";
import { bankApplicationName, BankError } from "#lib/server/enable-banking.js";
import { encryptSecret } from "#lib/server/secrets.js";
import { parseForm } from "#lib/server/validation/form.js";

const bankSyncSchema = z.object({
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

export const load = ({ url }) => {
	const settings = getSetting("bankSync");
	return {
		applicationId: settings?.applicationId ?? null,
		redirectUrl: new URL(
			resolve("/(protected)/personal/bank"),
			publicOrigin() ?? url.origin,
		).href,
	};
};

export const actions = {
	save: async ({ locals, request }) => {
		const admin = adminFrom(locals);
		if (!("id" in admin)) {
			return admin;
		}
		const parsed = parseForm(bankSyncSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		const previous = getSetting("bankSync");
		setSetting("bankSync", {
			applicationId: parsed.data.applicationId,
			encryptedPrivateKey: encryptSecret(parsed.data.privateKey),
		});
		try {
			return { application: await bankApplicationName() };
		} catch (error) {
			setSetting("bankSync", previous);
			if (error instanceof BankError) {
				return fail(400, {
					error: `Enable Banking refused these keys: ${error.message}`,
				});
			}
			throw error;
		}
	},
	remove: ({ locals }) => {
		const admin = adminFrom(locals);
		if (!("id" in admin)) {
			return admin;
		}
		setSetting("bankSync", null);
		return { removed: true };
	},
};
