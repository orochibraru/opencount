import { resolve } from "$app/paths";
import { fail, redirect } from "@sveltejs/kit";
import { APIError } from "better-auth/api";

import { CodeChallengeDTO } from "#lib/dto/code-challenge.js";
import { getSetting } from "#lib/dto/setting.js";
import { safeRedirectTarget } from "#lib/server/guards.js";
import { mayEmail, signUpCodeAttempts } from "#lib/server/rate-limit.js";
import {
	clearSignUp,
	currentSignUpStep,
	grantSignUpTicket,
	rememberPendingSignUp,
} from "#lib/server/sign-up-cookies.js";
import {
	createVerifiedAccount,
	SignUpError,
	signUpIdentifier,
	startSignUp,
} from "#lib/server/sign-up.js";
import {
	codeSchema,
	newAccountSchema,
	signUpStartSchema,
} from "#lib/server/validation/auth.js";
import { parseForm } from "#lib/server/validation/form.js";

const tooManyEmails = "Too many emails asked for. Wait a while and try again.";

function signInLink(url: URL): string {
	return new URL(resolve("/auth/sign-in"), url).href;
}

export const load = ({ cookies }) => currentSignUpStep(cookies);

export const actions = {
	start: async ({ cookies, getClientAddress, request, url }) => {
		const parsed = parseForm(signUpStartSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		if (!mayEmail(parsed.data.email, getClientAddress())) {
			return fail(429, { error: tooManyEmails });
		}
		try {
			startSignUp(parsed.data.email, signInLink(url));
			rememberPendingSignUp(cookies, url, parsed.data.email);
			return { sent: true };
		} catch (error) {
			if (error instanceof SignUpError) {
				return fail(400, { errors: { email: [error.message] } });
			}
			throw error;
		}
	},
	resend: ({ cookies, getClientAddress, url }) => {
		const current = currentSignUpStep(cookies);
		if (current.step !== "code") {
			return fail(400, { error: "Start again with your email." });
		}
		if (!mayEmail(current.email, getClientAddress())) {
			return fail(429, { error: tooManyEmails });
		}
		try {
			startSignUp(current.email, signInLink(url));
			rememberPendingSignUp(cookies, url, current.email);
			return { sent: true };
		} catch (error) {
			if (error instanceof SignUpError) {
				return fail(400, { error: error.message });
			}
			throw error;
		}
	},
	verify: async ({ cookies, request, url }) => {
		const current = currentSignUpStep(cookies);
		if (current.step !== "code") {
			return fail(400, { error: "Start again with your email." });
		}
		const parsed = parseForm(codeSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		if (signUpCodeAttempts.blocked(current.email)) {
			return fail(429, {
				error: "Too many wrong codes for this email today. Try again tomorrow.",
			});
		}
		signUpCodeAttempts.hit(current.email);
		if (
			!CodeChallengeDTO.find(signUpIdentifier(current.email))?.verify(
				parsed.data.code,
			)
		) {
			return fail(400, {
				errors: {
					code: ["That code isn't right, or it expired. Ask for a new one."],
				},
			});
		}
		grantSignUpTicket(cookies, url, current.email);
		return { verified: true };
	},
	create: async ({ cookies, request, url }) => {
		const current = currentSignUpStep(cookies);
		if (current.step !== "details") {
			return fail(400, { error: "Verify your email first." });
		}
		if (!getSetting("signUpsEnabled")) {
			clearSignUp(cookies);
			return fail(403, {
				error: "Sign-ups just closed. Ask an admin for an invite.",
			});
		}
		const parsed = parseForm(
			newAccountSchema(current.email),
			await request.formData(),
		);
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		try {
			await createVerifiedAccount({
				email: current.email,
				name: parsed.data.name,
				password: parsed.data.password,
				headers: request.headers,
			});
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, {
					error: error.body?.message ?? "Could not create the account.",
				});
			}
			throw error;
		}
		clearSignUp(cookies);
		redirect(303, safeRedirectTarget(url));
	},
	restart: ({ cookies }) => {
		clearSignUp(cookies);
		return { restarted: true };
	},
};
