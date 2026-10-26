import { resolve } from "$app/paths";
import { fail, redirect } from "@sveltejs/kit";
import { APIError } from "better-auth/api";
import { z } from "zod";

import { getSetting } from "#lib/dto/setting.js";
import { getAuth } from "#lib/server/auth.js";
import { safeRedirectTarget } from "#lib/server/guards.js";
import { enabledSignInMethods } from "#lib/server/sign-in-methods.js";
import { signInSchema } from "#lib/server/validation/auth.js";
import { parseForm } from "#lib/server/validation/form.js";

const ssoSchema = z.object({ provider: z.string().min(1) });

export const load = () => ({
	signUpsOpen: getSetting("signUpsEnabled"),
	methods: enabledSignInMethods(),
});

export const actions = {
	password: async ({ request, url }) => {
		const parsed = parseForm(signInSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		let result: Awaited<
			ReturnType<ReturnType<typeof getAuth>["api"]["signInEmail"]>
		>;
		try {
			result = await getAuth().api.signInEmail({
				body: parsed.data,
				headers: request.headers,
			});
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, {
					error:
						error.status === "FORBIDDEN"
							? error.message
							: "Wrong email or password.",
				});
			}
			throw error;
		}
		if ("twoFactorRedirect" in result && result.twoFactorRedirect) {
			redirect(303, `${resolve("/auth/two-factor")}${url.search}`);
		}
		redirect(303, safeRedirectTarget(url));
	},
	sso: async ({ request, url }) => {
		const parsed = parseForm(ssoSchema, await request.formData());
		if (
			!parsed.success ||
			!enabledSignInMethods().sso.some(
				(provider) => provider.id === parsed.data.provider,
			)
		) {
			return fail(400, { error: "That sign-in method is turned off." });
		}
		let target: string | undefined;
		try {
			const result = await getAuth().api.signInSocial({
				body: {
					provider: parsed.data.provider,
					callbackURL: safeRedirectTarget(url),
					errorCallbackURL: resolve("/auth/sign-in"),
				},
				headers: request.headers,
			});
			target = "url" in result ? result.url : undefined;
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, {
					error:
						"The provider couldn't start the sign-in. Try again, or ask an admin to check it.",
				});
			}
			throw error;
		}
		if (!target) {
			return fail(400, { error: "The provider couldn't start the sign-in." });
		}
		redirect(303, target);
	},
};
