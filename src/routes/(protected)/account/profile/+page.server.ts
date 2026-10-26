import { resolve } from "$app/paths";
import { fail, redirect } from "@sveltejs/kit";
import { APIError } from "better-auth/api";
import { z } from "zod";

import { hasPassword } from "#lib/dto/account.js";
import { CodeChallengeDTO } from "#lib/dto/code-challenge.js";
import { UserDTO } from "#lib/dto/user.js";
import { isAdmin } from "#lib/server/admin.js";
import { getAuth } from "#lib/server/auth.js";
import {
	emailChangeCodeEmail,
	emailChangedEmail,
	queueEmail,
} from "#lib/server/emails.js";
import { isEmailConfigured } from "#lib/server/mailer.js";
import {
	emailChangeCodeSchema,
	emailChangeSchema,
	optionalPasswordSchema,
} from "#lib/server/validation/auth.js";
import { parseForm } from "#lib/server/validation/form.js";

const profileSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, "Enter your name.")
		.max(80, "Keep it under 80 characters."),
});

function emailChangeIdentifier(userId: string, email: string): string {
	return `email-change:${userId}:${email}`;
}

function isLastAdmin(user: { role?: string | null }): boolean {
	return isAdmin(user) && UserDTO.adminCount() <= 1;
}

export const load = ({ locals }) => ({
	emailChangeAvailable: isEmailConfigured(),
	hasPassword: locals.user ? hasPassword(locals.user.id) : false,
	lastAdmin: locals.user ? isLastAdmin(locals.user) : false,
});

export const actions = {
	profile: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const parsed = parseForm(profileSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		await getAuth().api.updateUser({
			body: { name: parsed.data.name },
			headers: request.headers,
		});
		return { saved: true };
	},
	requestEmailChange: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		if (!isEmailConfigured()) {
			return fail(400, { error: "Email isn't set up here. Ask an admin." });
		}
		const parsed = parseForm(emailChangeSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		const { email } = parsed.data;
		if (email === locals.user.email) {
			return fail(400, { errors: { email: ["That's already your email."] } });
		}
		if (UserDTO.emailExists(email)) {
			return fail(400, {
				errors: { email: ["Another account already uses that email."] },
			});
		}
		let code: string;
		try {
			code = CodeChallengeDTO.start(
				emailChangeIdentifier(locals.user.id, email),
			);
		} catch (error) {
			return fail(400, {
				error: error instanceof Error ? error.message : String(error),
			});
		}
		queueEmail(emailChangeCodeEmail(email, code));
		return { codeSentTo: email };
	},
	confirmEmailChange: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const parsed = parseForm(emailChangeCodeSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		const { email, code } = parsed.data;
		const challenge = CodeChallengeDTO.find(
			emailChangeIdentifier(locals.user.id, email),
		);
		if (!challenge?.verify(code)) {
			return fail(400, {
				errors: { code: ["That code isn't right, or it expired."] },
			});
		}
		if (UserDTO.emailExists(email)) {
			return fail(400, {
				errors: { code: ["Another account took that email meanwhile."] },
			});
		}
		UserDTO.changeEmail(locals.user.id, email);
		queueEmail(emailChangedEmail(locals.user.email, email));
		return { emailChanged: true };
	},
	deleteAccount: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		if (isLastAdmin(locals.user)) {
			return fail(400, {
				error: "You're the only admin. Make someone else admin first.",
			});
		}
		const parsed = parseForm(optionalPasswordSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		if (hasPassword(locals.user.id)) {
			try {
				await getAuth().api.verifyPassword({
					body: { password: parsed.data.password },
					headers: request.headers,
				});
			} catch (error) {
				if (error instanceof APIError) {
					return fail(400, {
						errors: { password: ["That password isn't right."] },
					});
				}
				throw error;
			}
		}
		UserDTO.delete(locals.user.id);
		redirect(303, resolve("/auth/sign-in"));
	},
};
