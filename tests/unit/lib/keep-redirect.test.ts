import { describe, expect, test } from "bun:test";

import { keepRedirect } from "#lib/keep-redirect.js";

describe("keepRedirect", () => {
	test("carries where the person was headed onto a form action", () => {
		expect(
			keepRedirect(
				"?/password",
				new URL("https://app.test/auth/sign-in?redirectTo=%2Foauth%3Fa%3D1"),
			),
		).toBe("?/password&redirectTo=%2Foauth%3Fa%3D1");
		expect(
			keepRedirect("?/password", new URL("https://app.test/auth/sign-in")),
		).toBe("?/password");
	});
});
