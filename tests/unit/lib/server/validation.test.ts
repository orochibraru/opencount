import { describe, expect, test } from "bun:test";

import {
	changePasswordSchema,
	codeSchema,
	newAccountSchema,
	newPasswordSchema,
	signInSchema,
} from "#lib/server/validation/auth.js";
import { parseForm } from "#lib/server/validation/form.js";
import { newGroupSchema } from "#lib/server/validation/group.js";

function form(fields: Record<string, string>): FormData {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		data.set(key, value);
	}
	return data;
}

describe("parseForm", () => {
	test("returns trimmed, normalised data", () => {
		expect(
			parseForm(
				signInSchema,
				form({ email: " Ada@Example.com ", password: "x" }),
			),
		).toEqual({
			success: true,
			data: { email: "ada@example.com", password: "x" },
		});
	});

	test("groups messages per field", () => {
		const parsed = parseForm(
			newAccountSchema("ada@example.com"),
			form({ name: "", password: "short", confirmPassword: "other" }),
		);
		expect(parsed.success).toBe(false);
		if (!parsed.success) {
			expect(Object.keys(parsed.errors).sort()).toEqual([
				"confirmPassword",
				"name",
				"password",
			]);
		}
	});

	test("accepts a strong, confirmed password", () => {
		const password = "Correct-Horse-42";
		expect(
			parseForm(
				newAccountSchema("ada@example.com"),
				form({ name: "Ada", password, confirmPassword: password }),
			).success,
		).toBe(true);
	});

	test("normalises a code typed with a dash", () => {
		expect(parseForm(codeSchema, form({ code: "123-456" }))).toEqual({
			success: true,
			data: { code: "123456" },
		});
		expect(parseForm(codeSchema, form({ code: "123 456" }))).toEqual({
			success: true,
			data: { code: "123456" },
		});
	});

	test("rejects an unknown currency", () => {
		const parsed = parseForm(
			newGroupSchema,
			form({ name: "Trip", currency: "XXX" }),
		);
		expect(parsed).toEqual({
			success: false,
			errors: { currency: ["Pick a currency."] },
		});
	});
});

describe("password change schemas", () => {
	test("newPasswordSchema applies the rules and wants it twice", () => {
		expect(
			parseForm(
				newPasswordSchema("ada@example.com"),
				form({
					password: "Correct-Horse-9",
					confirmPassword: "Correct-Horse-9",
				}),
			).success,
		).toBe(true);
		const parsed = parseForm(
			newPasswordSchema("ada@example.com"),
			form({ password: "ada-Is-Great-99", confirmPassword: "other" }),
		);
		expect(parsed.success || Object.keys(parsed.errors).sort()).toEqual([
			"confirmPassword",
			"password",
		]);
	});

	test("changePasswordSchema takes the current password when there is one", () => {
		expect(
			parseForm(
				changePasswordSchema("ada@example.com"),
				form({
					currentPassword: "old",
					password: "Correct-Horse-9",
					confirmPassword: "Correct-Horse-9",
				}),
			),
		).toEqual({
			success: true,
			data: {
				currentPassword: "old",
				password: "Correct-Horse-9",
				confirmPassword: "Correct-Horse-9",
			},
		});
	});
});
