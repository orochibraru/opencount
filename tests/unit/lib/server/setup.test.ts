import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";

import { getConfig } from "#lib/server/config.js";
import {
	announceSetup,
	issueSetupCode,
	needsSetup,
	SetupError,
	verifySetupCode,
} from "#lib/server/setup.js";

import { createUser, resetDatabase } from "../../database.js";

function logged(run: () => void): string {
	const output = spyOn(console, "error").mockImplementation(() => {});
	const info = spyOn(console, "log").mockImplementation(() => {});
	run();
	const lines = [...output.mock.calls, ...info.mock.calls]
		.map((call) => call.map(String).join(" "))
		.join("\n");
	output.mockRestore();
	info.mockRestore();
	return lines;
}

describe("instance setup", () => {
	beforeEach(resetDatabase);
	afterEach(() => {
		getConfig().logLevel = "error";
	});

	test("is needed until the first account exists", () => {
		expect(needsSetup()).toBe(true);
		createUser("ada");
		expect(needsSetup()).toBe(false);
	});

	test("the code printed in the log verifies once", () => {
		getConfig().logLevel = "info";
		const line = logged(() => issueSetupCode());
		const code = /Setup code: (\d{3}) (\d{3})/.exec(line);
		expect(code).not.toBeNull();
		expect(
			verifySetupCode(
				"000000" === `${code?.[1]}${code?.[2]}` ? "111111" : "000000",
			),
		).toBe(false);
		expect(verifySetupCode(`${code?.[1]}${code?.[2]}`)).toBe(true);
		expect(verifySetupCode(`${code?.[1]}${code?.[2]}`)).toBe(false);
	});

	test("refuses a new code within the resend cooldown", () => {
		logged(() => issueSetupCode());
		expect(() => issueSetupCode()).toThrow(SetupError);
	});

	test("announces itself only on a fresh instance", () => {
		getConfig().logLevel = "info";
		expect(logged(() => announceSetup())).toContain("Setup code");
		expect(logged(() => announceSetup())).toContain("open /auth/setup");
		createUser("ada");
		expect(logged(() => announceSetup())).toBe("");
	});
});
