import { resolve } from "$app/paths";
import { fail, redirect } from "@sveltejs/kit";
import { APIError } from "better-auth/api";

import { UserDTO } from "#lib/dto/user.js";
import {
	issueSetupCode,
	needsSetup,
	SetupError,
	verifySetupCode,
} from "#lib/server/setup.js";
import {
	clearSetupTicket,
	grantSetupTicket,
	hasSetupTicket,
} from "#lib/server/sign-up-cookies.js";
import { createVerifiedAccount } from "#lib/server/sign-up.js";
import {
	codeSchema,
	emailSchema,
	newAccountSchema,
} from "#lib/server/validation/auth.js";
import { parseForm } from "#lib/server/validation/form.js";

export const load = ({ cookies }) => ({
	step: hasSetupTicket(cookies) ? ("account" as const) : ("code" as const),
});

export const actions = {
	newCode: () => {
		try {
			issueSetupCode();
			return { sent: true };
		} catch (error) {
			if (error instanceof SetupError) {
				return fail(400, { error: error.message });
			}
			throw error;
		}
	},
	verify: async ({ cookies, request, url }) => {
		const parsed = parseForm(codeSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		if (!verifySetupCode(parsed.data.code)) {
			return fail(400, {
				errors: {
					code: ["That code isn't right, or it expired. Print a new one."],
				},
			});
		}
		grantSetupTicket(cookies, url);
		return { verified: true };
	},
	create: async ({ cookies, request }) => {
		if (!needsSetup()) {
			return fail(400, {
				error: "This server already has an admin. Sign in instead.",
			});
		}
		if (!hasSetupTicket(cookies)) {
			return fail(400, { error: "Enter the setup code first." });
		}
		const formData = await request.formData();
		const email = emailSchema.safeParse(formData.get("email"));
		if (!email.success) {
			return fail(400, { errors: { email: ["Enter a valid email."] } });
		}
		const parsed = parseForm(newAccountSchema(email.data), formData);
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		try {
			const userId = await createVerifiedAccount({
				email: email.data,
				name: parsed.data.name,
				password: parsed.data.password,
				headers: request.headers,
			});
			UserDTO.setRole(userId, "admin");
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, {
					error: error.body?.message ?? "Could not create the account.",
				});
			}
			throw error;
		}
		clearSetupTicket(cookies);
		redirect(303, resolve("/(protected)/admin/overview"));
	},
};
