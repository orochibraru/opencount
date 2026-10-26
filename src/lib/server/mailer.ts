import { createTransport } from "nodemailer";

import { getSetting, type SmtpSettings } from "#lib/dto/setting.js";
import { decryptSecret } from "#lib/server/secrets.js";

export interface EmailMessage {
	to: string;
	subject: string;
	text: string;
	html: string;
}

/** Whether an admin configured an SMTP server. */
export function isEmailConfigured(): boolean {
	return getSetting("smtp") !== null;
}

function transportFor(smtp: SmtpSettings) {
	return createTransport({
		host: smtp.host,
		port: smtp.port,
		secure: smtp.security === "tls",
		requireTLS: smtp.security === "starttls",
		ignoreTLS: smtp.security === "none",
		auth: smtp.username
			? { user: smtp.username, pass: decryptSecret(smtp.encryptedPassword) }
			: undefined,
		connectionTimeout: 15_000,
		greetingTimeout: 15_000,
		socketTimeout: 30_000,
	});
}

/**
 * Sends `message` through the configured SMTP server.
 *
 * @throws When no SMTP server is configured or the server refuses the message.
 */
export async function deliverEmail(message: EmailMessage): Promise<void> {
	const smtp = getSetting("smtp");
	if (!smtp) {
		throw new Error("No SMTP server is configured");
	}
	await transportFor(smtp).sendMail({
		from: { name: smtp.fromName, address: smtp.fromAddress },
		to: message.to,
		subject: message.subject,
		text: message.text,
		html: message.html,
	});
}
