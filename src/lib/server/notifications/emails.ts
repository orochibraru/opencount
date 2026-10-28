import { JobDTO } from "#lib/dto/job.js";
import type { EmailMessage } from "#lib/server/notifications/mailer.js";

/** The emails OpenCount sends, built as text and HTML, and the queue that hands them to the worker. */
class Emails {
	/** The email carrying a sign-up verification code. */
	verificationCode(to: string, code: string): EmailMessage {
		const formatted = `${code.slice(0, 3)} ${code.slice(3)}`;
		return {
			to,
			subject: `${formatted} is your OpenCount code`,
			text: `Your OpenCount verification code is ${formatted}. It expires in 15 minutes. If you didn't ask for it, ignore this email.`,
			html: this.#layout(
				"Confirm your email",
				`<p style="margin:0 0 16px;color:#55605c">Enter this code to keep creating your account. It expires in 15 minutes.</p>
<p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:0">${formatted}</p>
<p style="margin:24px 0 0;color:#55605c;font-size:13px">If you didn't ask for it, ignore this email.</p>`,
			),
		};
	}

	/** The email telling `to` someone tried to sign up with their address, which already has an account. */
	accountExists(to: string, signInLink: string): EmailMessage {
		return {
			to,
			subject: "You already have an OpenCount account",
			text: `Someone, probably you, tried to create an OpenCount account with this email, which already has one. Sign in instead: ${signInLink}\nIf it wasn't you, ignore this email.`,
			html: this.#layout(
				"You already have an account",
				`<p style="margin:0 0 16px;color:#55605c">Someone, probably you, tried to create an OpenCount account with this email, which already has one.</p>
${this.#button(this.#escapeHtml(signInLink), "Sign in")}
<p style="margin:24px 0 0;color:#55605c;font-size:13px">If it wasn't you, ignore this email.</p>`,
			),
		};
	}

	/** The email inviting `to` to create an account. */
	invite(to: string, link: string, inviterName: string): EmailMessage {
		return {
			to,
			subject: `${inviterName} invited you to OpenCount`,
			text: `${inviterName} invited you to OpenCount, to split expenses together. Create your account: ${link}\nThe link expires in 7 days.`,
			html: this.#layout(
				"You're invited",
				`<p style="margin:0;color:#55605c">${this.#escapeHtml(inviterName)} invited you to OpenCount, to split expenses together.</p>
${this.#button(link, "Create your account")}
<p style="margin:16px 0 0;color:#55605c;font-size:13px">The link expires in 7 days.</p>`,
			),
		};
	}

	/** The email carrying a one-time sign-in link. */
	magicLink(to: string, link: string): EmailMessage {
		return {
			to,
			subject: "Your OpenCount sign-in link",
			text: `Sign in to OpenCount: ${link}\nThe link works once and expires in 10 minutes. If you didn't ask for it, ignore this email.`,
			html: this.#layout(
				"Sign in to OpenCount",
				`<p style="margin:0;color:#55605c">Tap the button to sign in on this device.</p>
${this.#button(link, "Sign in")}
<p style="margin:16px 0 0;color:#55605c;font-size:13px">The link works once and expires in 10 minutes. If you didn't ask for it, ignore this email.</p>`,
			),
		};
	}

	/** The email carrying a one-time sign-in code. */
	signInCode(to: string, code: string): EmailMessage {
		const formatted = `${code.slice(0, 3)} ${code.slice(3)}`;
		return {
			to,
			subject: `${formatted} is your OpenCount sign-in code`,
			text: `Your OpenCount sign-in code is ${formatted}. It expires in 10 minutes. If you didn't ask for it, ignore this email.`,
			html: this.#layout(
				"Your sign-in code",
				`<p style="margin:0 0 16px;color:#55605c">Enter this code to sign in. It expires in 10 minutes.</p>
<p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:0">${formatted}</p>
<p style="margin:24px 0 0;color:#55605c;font-size:13px">If you didn't ask for it, ignore this email.</p>`,
			),
		};
	}

	/** The email carrying a link to choose a new password. */
	resetPassword(to: string, link: string): EmailMessage {
		return {
			to,
			subject: "Reset your OpenCount password",
			text: `Choose a new OpenCount password: ${link}\nThe link works once and expires in an hour. If you didn't ask for it, ignore this email: your password stays the same.`,
			html: this.#layout(
				"Reset your password",
				`<p style="margin:0;color:#55605c">Tap the button to choose a new password.</p>
${this.#button(link, "Choose a new password")}
<p style="margin:16px 0 0;color:#55605c;font-size:13px">The link works once and expires in an hour. If you didn't ask for it, ignore this email: your password stays the same.</p>`,
			),
		};
	}

	/** The email carrying the code that confirms a new address for an account. */
	emailChangeCode(to: string, code: string): EmailMessage {
		const formatted = `${code.slice(0, 3)} ${code.slice(3)}`;
		return {
			to,
			subject: `${formatted} confirms your new OpenCount email`,
			text: `Your code to move your OpenCount account to this address is ${formatted}. It expires in 15 minutes. If you didn't ask for it, ignore this email.`,
			html: this.#layout(
				"Confirm your new email",
				`<p style="margin:0 0 16px;color:#55605c">Enter this code to move your account to this address. It expires in 15 minutes.</p>
<p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:0">${formatted}</p>
<p style="margin:24px 0 0;color:#55605c;font-size:13px">If you didn't ask for it, ignore this email.</p>`,
			),
		};
	}

	/** The email telling the old address its account moved to `newEmail`. */
	emailChanged(to: string, newEmail: string): EmailMessage {
		return {
			to,
			subject: "Your OpenCount email changed",
			text: `Your OpenCount account now uses ${newEmail}. If you didn't do this, ask your OpenCount admin for help right away.`,
			html: this.#layout(
				"Your email changed",
				`<p style="margin:0;color:#55605c">Your account now uses <strong>${this.#escapeHtml(newEmail)}</strong>. If you didn't do this, ask your OpenCount admin for help right away.</p>`,
			),
		};
	}

	/** The email an admin sends to check the SMTP settings. */
	test(to: string): EmailMessage {
		return {
			to,
			subject: "OpenCount test email",
			text: "Email delivery works. This is the test you sent from the admin settings.",
			html: this.#layout(
				"Email delivery works",
				`<p style="margin:0;color:#55605c">This is the test you sent from the admin settings.</p>`,
			),
		};
	}

	/** Hands `message` to the worker, which sends it and retries on failure. */
	queue(message: EmailMessage): void {
		JobDTO.enqueue("email.send", message);
	}

	/** `value` with the HTML special characters escaped. */
	#escapeHtml(value: string): string {
		return value
			.replaceAll("&", "&amp;")
			.replaceAll("<", "&lt;")
			.replaceAll(">", "&gt;")
			.replaceAll('"', "&quot;");
	}

	/** The branded HTML page around an email's `heading` and `body`. */
	#layout(heading: string, body: string): string {
		return `<!doctype html><html><body style="margin:0;background:#f4f7f6;font-family:system-ui,-apple-system,sans-serif;color:#141a18">
<div style="max-width:480px;margin:0 auto;padding:32px 24px">
<p style="font-weight:700;font-size:18px;margin:0 0 24px">OpenCount</p>
<div style="background:#fff;border-radius:16px;padding:28px 24px">
<h1 style="font-size:20px;margin:0 0 12px">${this.#escapeHtml(heading)}</h1>${body}</div></div></body></html>`;
	}

	/** A pill-shaped link button to `href`. */
	#button(href: string, label: string): string {
		return `<p style="margin:24px 0 8px"><a href="${this.#escapeHtml(href)}" style="display:inline-block;background:#911f43;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px">${this.#escapeHtml(label)}</a></p>`;
	}
}

export const emails = new Emails();
