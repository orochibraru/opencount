import { fail } from "@sveltejs/kit";
import { APIError } from "better-auth/api";
import { renderSVG } from "uqr";
import { z } from "zod";

import { hasPassword } from "#lib/dto/account.js";
import { PasskeyDTO } from "#lib/dto/passkey.js";
import { getAuth } from "#lib/server/auth.js";
import { missingFactors } from "#lib/server/security-policy.js";
import {
	changePasswordSchema,
	passwordConfirmSchema,
	totpSchema,
} from "#lib/server/validation/auth.js";
import { parseForm } from "#lib/server/validation/form.js";

const passkeyIdSchema = z.object({ id: z.string().min(1) });

function apiFailure(error: unknown, fallback: string) {
	if (error instanceof APIError) {
		return fail(400, { error: error.body?.message ?? fallback });
	}
	throw error;
}

export const load = async ({ locals, parent }) => {
	const { user } = await parent();
	return {
		twoFactorEnabled: locals.user?.twoFactorEnabled ?? false,
		passkeys: PasskeyDTO.forUser(user.id).map((entry) => entry.toJSON()),
		missing: locals.user ? missingFactors(locals.user) : [],
		hasPassword: hasPassword(user.id),
	};
};

export const actions = {
	changePassword: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const parsed = parseForm(
			changePasswordSchema(locals.user.email),
			await request.formData(),
		);
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		const { currentPassword, password } = parsed.data;
		const existing = hasPassword(locals.user.id);
		if (existing && !currentPassword) {
			return fail(400, {
				errors: { currentPassword: ["Enter your current password."] },
			});
		}
		try {
			if (existing) {
				await getAuth().api.changePassword({
					body: {
						currentPassword,
						newPassword: password,
						revokeOtherSessions: true,
					},
					headers: request.headers,
				});
			} else {
				await getAuth().api.setPassword({
					body: { newPassword: password },
					headers: request.headers,
				});
			}
			return { passwordChanged: true };
		} catch (error) {
			return apiFailure(error, "That password isn't right.");
		}
	},
	enableTwoFactor: async ({ request }) => {
		const parsed = parseForm(passwordConfirmSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		try {
			const result = await getAuth().api.enableTwoFactor({
				body: { password: parsed.data.password },
				headers: request.headers,
			});
			if (result.method !== "totp") {
				return fail(400, { error: "Authenticator apps aren't available." });
			}
			const { totpURI, backupCodes } = result;
			const secret = new URL(totpURI).searchParams.get("secret") ?? "";
			return {
				setup: {
					qrCode: renderSVG(totpURI, { border: 1 }),
					secret,
					backupCodes,
				},
			};
		} catch (error) {
			return apiFailure(error, "That password isn't right.");
		}
	},
	verifyTwoFactor: async ({ request }) => {
		const parsed = parseForm(totpSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		try {
			await getAuth().api.verifyTOTP({
				body: { code: parsed.data.code },
				headers: request.headers,
			});
			return { enabled: true };
		} catch (error) {
			return apiFailure(
				error,
				"That code didn't match. Check your device's clock and try again.",
			);
		}
	},
	disableTwoFactor: async ({ request }) => {
		const parsed = parseForm(passwordConfirmSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		try {
			await getAuth().api.disableTwoFactor({
				body: { password: parsed.data.password },
				headers: request.headers,
			});
			return { disabled: true };
		} catch (error) {
			return apiFailure(error, "That password isn't right.");
		}
	},
	deletePasskey: async ({ request }) => {
		const parsed = parseForm(passkeyIdSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { error: "Pick a passkey to remove." });
		}
		try {
			await getAuth().api.deletePasskey({
				body: { id: parsed.data.id },
				headers: request.headers,
			});
			return { deleted: true };
		} catch (error) {
			return apiFailure(error, "Could not remove that passkey.");
		}
	},
};
