import { describe, expect, test } from "bun:test";

import { csrfHandler } from "#lib/server/csrf.js";

function call(
	handler: ReturnType<typeof csrfHandler>,
	init: { method: string; origin?: string; type?: string },
) {
	const headers = new Headers();
	if (init.origin) {
		headers.set("origin", init.origin);
	}
	if (init.type) {
		headers.set("content-type", init.type);
	}
	const event = {
		request: new Request("https://app.test/form", {
			method: init.method,
			headers,
		}),
		url: new URL("https://app.test/form"),
	};
	return handler({
		event,
		resolve: () => new Response("ok"),
	} as never) as Response;
}

describe("csrfHandler", () => {
	const handler = csrfHandler(() => "http://localhost:3000");

	test("lets same-origin, public-origin and non-form requests through", async () => {
		expect(
			await call(handler, {
				method: "POST",
				origin: "https://app.test",
				type: "multipart/form-data",
			}).text(),
		).toBe("ok");
		expect(
			await call(handler, {
				method: "POST",
				origin: "http://localhost:3000",
			}).text(),
		).toBe("ok");
		expect(
			await call(handler, {
				method: "POST",
				origin: "https://evil.test",
				type: "application/json",
			}).text(),
		).toBe("ok");
		expect(
			await call(handler, {
				method: "GET",
				origin: "https://evil.test",
			}).text(),
		).toBe("ok");
	});

	test("refuses a cross-site form post", () => {
		expect(
			call(handler, {
				method: "POST",
				origin: "https://evil.test",
				type: "application/x-www-form-urlencoded",
			}).status,
		).toBe(403);
		expect(
			call(
				csrfHandler(() => undefined),
				{
					method: "POST",
					origin: "http://localhost:3000",
				},
			).status,
		).toBe(403);
	});
});
