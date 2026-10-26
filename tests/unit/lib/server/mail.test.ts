import { beforeEach, describe, expect, mock, test } from "bun:test";

import { setSetting } from "#lib/dto/setting.js";
import {
	emailChangeCodeEmail,
	emailChangedEmail,
	inviteEmail,
	resetPasswordEmail,
	testEmail,
	verificationCodeEmail,
} from "#lib/server/emails.js";
import { jobHandlers } from "#lib/server/jobs/handlers.js";
import { encryptSecret } from "#lib/server/secrets.js";

import { resetDatabase } from "../../database.js";

const sendMail = mock(async (_message: unknown) => ({}));
mock.module("nodemailer", () => ({ createTransport: () => ({ sendMail }) }));

const { deliverEmail, isEmailConfigured } =
	await import("#lib/server/mailer.js");

describe("emails", () => {
	test("templates escape names and carry the code or link", () => {
		expect(verificationCodeEmail("a@b.c", "123456").subject).toContain(
			"123 456",
		);
		const invite = inviteEmail(
			"a@b.c",
			"https://app.test/auth/invite/x",
			"<Ada>",
		);
		expect(invite.html).toContain("&lt;Ada&gt;");
		expect(invite.text).toContain("https://app.test/auth/invite/x");
		expect(testEmail("a@b.c").to).toBe("a@b.c");
	});

	test("account emails carry the reset link, the code or the new address", () => {
		expect(resetPasswordEmail("a@b.c", "https://app.test/r").text).toContain(
			"https://app.test/r",
		);
		expect(emailChangeCodeEmail("new@b.c", "654321").subject).toContain(
			"654 321",
		);
		const changed = emailChangedEmail("old@b.c", "<new@b.c>");
		expect(changed.to).toBe("old@b.c");
		expect(changed.html).toContain("&lt;new@b.c&gt;");
	});
});

describe("mailer", () => {
	beforeEach(resetDatabase);

	test("refuses to send without SMTP, then sends through the transport", async () => {
		expect(isEmailConfigured()).toBe(false);
		expect(deliverEmail(testEmail("a@b.c"))).rejects.toThrow("No SMTP server");
		setSetting("smtp", {
			host: "smtp.example.com",
			port: 465,
			security: "tls",
			username: "user",
			encryptedPassword: encryptSecret("secret"),
			fromAddress: "opencount@example.com",
			fromName: "OpenCount",
		});
		await jobHandlers["email.send"](testEmail("a@b.c"));
		expect(sendMail).toHaveBeenCalledTimes(1);
	});
});
