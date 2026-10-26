import { CodeChallengeDTO } from "#lib/dto/code-challenge.js";
import { getSetting } from "#lib/dto/setting.js";
import { UserDTO } from "#lib/dto/user.js";
import { getAuth } from "#lib/server/auth.js";
import { queueEmail, verificationCodeEmail } from "#lib/server/emails.js";
import { isEmailConfigured } from "#lib/server/mailer.js";

/** The challenge identifier of a sign-up for `email`. */
export function signUpIdentifier(email: string): string {
	return `signup:${email}`;
}

export class SignUpError extends Error {}

/**
 * Starts a sign-up for `email`: checks sign-ups are open and email works, then emails a verification code.
 *
 * @throws SignUpError when sign-ups are closed, email isn't set up, the address is taken, or a code was sent less than a minute ago.
 */
export function startSignUp(email: string): void {
	if (!getSetting("signUpsEnabled")) {
		throw new SignUpError("Sign-ups are closed. Ask an admin for an invite.");
	}
	if (!isEmailConfigured()) {
		throw new SignUpError(
			"Sign-ups need email delivery, which isn't set up yet. Ask an admin.",
		);
	}
	if (UserDTO.emailExists(email)) {
		throw new SignUpError(
			"An account already uses this email. Sign in instead.",
		);
	}
	let code: string;
	try {
		code = CodeChallengeDTO.start(signUpIdentifier(email));
	} catch (error) {
		throw new SignUpError(
			error instanceof Error ? error.message : String(error),
		);
	}
	queueEmail(verificationCodeEmail(email, code));
}

export interface NewAccount {
	email: string;
	name: string;
	password: string;
	headers: Headers;
}

/** Creates a verified account, signs it in on the current request and returns its id. */
export async function createVerifiedAccount({
	email,
	name,
	password,
	headers,
}: NewAccount): Promise<string> {
	const result = await getAuth().api.signUpEmail({
		body: { email, name, password },
		headers,
	});
	UserDTO.markEmailVerified(result.user.id);
	return result.user.id;
}
