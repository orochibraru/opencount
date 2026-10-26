import { resolve } from "$app/paths";
import { error, fail } from "@sveltejs/kit";
import { APIError } from "better-auth/api";

import { getSetting } from "#lib/dto/setting.js";
import { getAuth } from "#lib/server/auth.js";
import { isEmailConfigured } from "#lib/server/mailer.js";
import { passwordResetRequestSchema } from "#lib/server/validation/auth.js";
import { parseForm } from "#lib/server/validation/form.js";

function assertResetsOpen(): void {
	if (!getSetting("passwordSignIn") || !isEmailConfigured()) {
		error(404, "Password resets are turned off on this server. Ask an admin.");
	}
}

export const load = () => {
	assertResetsOpen();
};

export const actions = {
	default: async ({ request }) => {
		assertResetsOpen();
		const parsed = parseForm(
			passwordResetRequestSchema,
			await request.formData(),
		);
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		try {
			await getAuth().api.requestPasswordReset({
				body: {
					email: parsed.data.email,
					redirectTo: resolve("/auth/reset-password"),
				},
				headers: request.headers,
			});
		} catch (caught) {
			if (caught instanceof APIError) {
				return fail(400, {
					error: "The link couldn't be sent. Try again in a minute.",
				});
			}
			throw caught;
		}
		return { sentTo: parsed.data.email };
	},
};
