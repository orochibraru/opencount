import { describe, expect, test } from "bun:test";

import {
	decryptSecret,
	encryptSecret,
	hashToken,
	randomCode,
	randomToken,
	signPayload,
	verifyPayload,
} from "#lib/server/secrets.js";

describe("secrets", () => {
	test("encrypts and decrypts, and refuses a tampered value", () => {
		const stored = encryptSecret("smtp-password");
		expect(stored).not.toContain("smtp-password");
		expect(decryptSecret(stored)).toBe("smtp-password");
		const [iv, body, tag] = stored.split(".");
		expect(() => decryptSecret(`${iv}.${body}x.${tag}`)).toThrow();
		expect(() => decryptSecret("broken")).toThrow("Malformed");
	});

	test("tokens and codes look right and hash stably", () => {
		expect(randomToken()).toMatch(/^[\w-]{43}$/);
		expect(randomCode()).toMatch(/^\d{6}$/);
		expect(hashToken("abc")).toBe(hashToken("abc"));
		expect(hashToken("abc")).not.toBe(hashToken("xyz"));
	});

	test("signed payloads check purpose, signature and expiry", () => {
		const signed = signPayload({ email: "a@b.c" }, "ticket", 60_000);
		expect(verifyPayload(signed, "ticket")).toMatchObject({ email: "a@b.c" });
		expect(verifyPayload(signed, "other")).toBeUndefined();
		expect(verifyPayload(`${signed}x`, "ticket")).toBeUndefined();
		expect(verifyPayload(undefined, "ticket")).toBeUndefined();
		expect(
			verifyPayload(signPayload({}, "ticket", -1), "ticket"),
		).toBeUndefined();
	});
});
