import { resolve } from "$app/paths";
import { fail, redirect } from "@sveltejs/kit";

import { access } from "#lib/server/auth/access.js";
import { appLock } from "#lib/server/auth/app-lock.js";
import { authService } from "#lib/server/auth/auth.js";
import { passcodeSchema } from "#lib/server/validation/auth.js";
import { parseForm } from "#lib/server/validation/form.js";

export const load = ({ locals }) => {
	const user = locals.gate?.reason === "locked" ? locals.gate.user : undefined;
	return { name: user?.name ?? "", email: user?.email ?? "" };
};

export const actions = {
	unlock: async ({ locals, request, url }) => {
		if (locals.gate?.reason !== "locked") {
			redirect(303, access.safeRedirectTarget(url));
		}
		const parsed = parseForm(passcodeSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		const result = await appLock.unlock(
			{ id: locals.gate.sessionId, userId: locals.gate.user.id },
			parsed.data.passcode,
		);
		if (result === "signed-out") {
			redirect(303, `${resolve("/auth/sign-in")}?locked=out`);
		}
		if (result === "wrong") {
			return fail(400, {
				errors: {
					passcode: [
						`Wrong passcode. After ${appLock.maxFailures} wrong ones you're signed out.`,
					],
				},
			});
		}
		redirect(303, access.safeRedirectTarget(url));
	},
	signOut: async ({ request }) => {
		await authService.get().api.signOut({ headers: request.headers });
		redirect(303, resolve("/auth/sign-in"));
	},
};
