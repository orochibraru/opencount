import { describe, expect, test } from "bun:test";

import { configuration } from "#lib/server/core/config.js";
import { workerMessages } from "#lib/server/worker/messages.js";

import { variables } from "../../src/env.ts";

async function parse(
	name: keyof typeof variables,
	value: string | undefined,
): Promise<unknown> {
	const result = await variables[name].schema["~standard"].validate(value);
	return "issues" in result && result.issues
		? { issues: result.issues.map((issue) => issue.message) }
		: result.value;
}

describe("env.ts", () => {
	test("AUTH_SECRET is required and long", async () => {
		expect(await parse("AUTH_SECRET", "short")).toMatchObject({
			issues: [expect.stringContaining("32 characters")],
		});
		expect(await parse("AUTH_SECRET", "x".repeat(44))).toBe("x".repeat(44));
	});

	test("optional values turn empty into undefined and URLs are checked", async () => {
		expect(await parse("ORIGIN", "")).toBeUndefined();
		expect(await parse("ORIGIN", "http://192.168.1.10:3000")).toBe(
			"http://192.168.1.10:3000",
		);
		expect(await parse("ORIGIN", "ftp://nope")).toHaveProperty("issues");
		expect(await parse("SENTRY_DSN", undefined)).toBeUndefined();
	});

	test("defaults, enums and integers", async () => {
		expect(await parse("DATABASE_PATH", undefined)).toBe(
			"./data/opencount.sqlite",
		);
		expect(await parse("LOG_LEVEL", undefined)).toBe("info");
		expect(await parse("LOG_LEVEL", "loud")).toHaveProperty("issues");
		expect(await parse("WORKER_CONCURRENCY", undefined)).toBe(2);
		expect(await parse("WORKER_CONCURRENCY", " 4 ")).toBe(4);
		expect(await parse("WORKER_CONCURRENCY", "0")).toHaveProperty("issues");
		expect(await parse("WORKER_POLL_INTERVAL_MS", "abc")).toHaveProperty(
			"issues",
		);
	});
});

describe("config helpers", () => {
	test("OTel resource attributes are parsed and URL-decoded", () => {
		expect(
			configuration.parseResourceAttributes(
				"homerun.service.id=svc_1, deployment.environment=prod%20eu,broken",
			),
		).toEqual({
			"homerun.service.id": "svc_1",
			"deployment.environment": "prod eu",
		});
		expect(configuration.parseResourceAttributes(undefined)).toEqual({});
	});

	test("worker IPC messages are recognised", () => {
		expect(workerMessages.isReady({ type: "ready" })).toBe(true);
		expect(workerMessages.isReady("ready")).toBe(false);
		expect(workerMessages.isConfig({ type: "config", config: {} })).toBe(true);
		expect(workerMessages.isConfig({ type: "config" })).toBe(false);
		expect(workerMessages.isConfig(null)).toBe(false);
	});
});
