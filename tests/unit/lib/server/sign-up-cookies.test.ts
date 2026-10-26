import { describe, expect, test } from "bun:test";

import type { Cookies } from "@sveltejs/kit";

import { adminFrom } from "#lib/server/admin.js";
import {
	clearSetupTicket,
	clearSignUp,
	currentSignUpStep,
	grantSetupTicket,
	grantSignUpTicket,
	hasSetupTicket,
	rememberPendingSignUp,
} from "#lib/server/sign-up-cookies.js";

function cookieJar(): Cookies {
	const values = new Map<string, string>();
	return {
		get: (name: string) => values.get(name),
		set: (name: string, value: string) => void values.set(name, value),
		delete: (name: string) => void values.delete(name),
	} as unknown as Cookies;
}

describe("sign-up cookies", () => {
	test("walk the stepper from email to code to details and back", () => {
		const cookies = cookieJar();
		const url = new URL("https://app.test/auth/sign-up");
		expect(currentSignUpStep(cookies)).toEqual({ step: "email" });
		rememberPendingSignUp(cookies, url, "a@b.c");
		expect(currentSignUpStep(cookies)).toEqual({
			step: "code",
			email: "a@b.c",
		});
		grantSignUpTicket(cookies, url, "a@b.c");
		expect(currentSignUpStep(cookies)).toEqual({
			step: "details",
			email: "a@b.c",
		});
		clearSignUp(cookies);
		expect(currentSignUpStep(cookies)).toEqual({ step: "email" });
	});
});

describe("setup ticket", () => {
	test("is granted, read and cleared", () => {
		const cookies = cookieJar();
		expect(hasSetupTicket(cookies)).toBe(false);
		grantSetupTicket(cookies, new URL("http://localhost:3000/auth/setup"));
		expect(hasSetupTicket(cookies)).toBe(true);
		clearSetupTicket(cookies);
		expect(hasSetupTicket(cookies)).toBe(false);
	});
});

describe("adminFrom", () => {
	test("returns the admin or a 403 failure", () => {
		const admin = { id: "1", email: "admin@example.com", role: "admin" };
		expect(adminFrom({ user: admin } as unknown as App.Locals)).toBe(
			admin as never,
		);
		expect(
			adminFrom({
				user: { id: "2", email: "x@example.com" },
			} as unknown as App.Locals),
		).toMatchObject({ status: 403 });
		expect(adminFrom({ user: null } as unknown as App.Locals)).toMatchObject({
			status: 403,
		});
	});
});
