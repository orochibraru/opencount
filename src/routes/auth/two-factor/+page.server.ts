import { fail, redirect } from "@sveltejs/kit";
import { APIError } from "better-auth/api";

import { getAuth } from "#lib/server/auth.js";
import { safeRedirectTarget } from "#lib/server/guards.js";
import { backupCodeSchema, totpSchema } from "#lib/server/validation/auth.js";
import { parseForm } from "#lib/server/validation/form.js";

export const actions = {
	totp: async ({ request, url }) => {
		const parsed = parseForm(totpSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		try {
			await getAuth().api.verifyTOTP({
				body: {
					code: parsed.data.code,
					trustDevice: parsed.data.trustDevice ?? false,
				},
				headers: request.headers,
			});
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, {
					error: "That code didn't match. Try the newest one.",
				});
			}
			throw error;
		}
		redirect(303, safeRedirectTarget(url));
	},
	backup: async ({ request, url }) => {
		const parsed = parseForm(backupCodeSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		try {
			await getAuth().api.verifyBackupCode({
				body: { code: parsed.data.code },
				headers: request.headers,
			});
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { error: "That backup code isn't valid." });
			}
			throw error;
		}
		redirect(303, safeRedirectTarget(url));
	},
};
