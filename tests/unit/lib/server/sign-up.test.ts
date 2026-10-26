import { beforeEach, describe, expect, spyOn, test } from "bun:test";

import { JobDTO } from "#lib/dto/job.js";
import { setSetting } from "#lib/dto/setting.js";
import { UserDTO } from "#lib/dto/user.js";
import { forwardAuthLog } from "#lib/server/auth.js";
import { getDb } from "#lib/server/db/lib.js";
import { job, user } from "#lib/server/db/schema.js";
import { missingFactors } from "#lib/server/security-policy.js";
import {
	createVerifiedAccount,
	SignUpError,
	startSignUp,
} from "#lib/server/sign-up.js";

import { createUser, resetDatabase } from "../../database.js";

const smtp = {
	host: "smtp.example.com",
	port: 587,
	security: "starttls" as const,
	username: "",
	encryptedPassword: "",
	fromAddress: "opencount@example.com",
	fromName: "OpenCount",
};

describe("startSignUp", () => {
	beforeEach(resetDatabase);

	test("is closed while sign-ups are off", () => {
		expect(() => startSignUp("someone@example.com")).toThrow(SignUpError);
		expect(() => startSignUp("someone@example.com")).toThrow("invite");
	});

	test("open sign-ups still need SMTP, then email the code", () => {
		setSetting("signUpsEnabled", true);
		expect(() => startSignUp("someone@example.com")).toThrow("email delivery");
		setSetting("smtp", smtp);
		startSignUp("someone@example.com");
		expect(getDb().select({ type: job.type }).from(job).all()).toEqual([
			{ type: "email.send" },
		]);
		expect(() => startSignUp("someone@example.com")).toThrow("Wait a minute");
	});

	test("refuses an address that already has an account", () => {
		createUser("ada");
		expect(() => startSignUp("ada@example.com")).toThrow(
			"already uses this email",
		);
	});
});

describe("createVerifiedAccount and missingFactors", () => {
	beforeEach(resetDatabase);

	test("creates a verified account through better-auth", async () => {
		await createVerifiedAccount({
			email: "new@example.com",
			name: "New",
			password: "Correct-Horse-42",
			headers: new Headers({ host: "app.test", origin: "https://app.test" }),
		});
		const created = getDb().select().from(user).get();
		expect(created).toMatchObject({
			role: "member",
			email: "new@example.com",
			emailVerified: true,
		});
		expect(UserDTO.count()).toBe(1);
	});

	test("lists the factors an admin requires and the user lacks", () => {
		const ada = createUser("ada");
		expect(missingFactors(ada)).toEqual([]);
		setSetting("requireTwoFactor", true);
		setSetting("requirePasskey", true);
		expect(missingFactors(ada)).toEqual(["two-factor", "passkey"]);
		expect(missingFactors({ ...ada, twoFactorEnabled: true })).toEqual([
			"passkey",
		]);
	});
});

describe("JobDTO stats", () => {
	beforeEach(resetDatabase);

	test("counts per status and lists failures", () => {
		JobDTO.enqueue("jobs.prune", { olderThanDays: 1 }, { maxAttempts: 1 });
		JobDTO.claimNext()?.fail(new Error("broken"));
		expect(JobDTO.counts()).toEqual({
			pending: 0,
			running: 0,
			done: 0,
			failed: 1,
		});
		expect(JobDTO.recentFailures()[0]).toMatchObject({
			type: "jobs.prune",
			lastError: "broken",
		});
	});
});

describe("forwardAuthLog", () => {
	test("forwards better-auth logs except the base URL warning", () => {
		const output = spyOn(console, "error").mockImplementation(() => {});
		forwardAuthLog("warn", "Base URL is not set");
		forwardAuthLog("error", "Something broke");
		const calls = output.mock.calls.length;
		output.mockRestore();
		expect(calls).toBe(1);
	});
});
