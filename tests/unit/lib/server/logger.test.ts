import { afterEach, describe, expect, spyOn, test } from "bun:test";

import { getConfig } from "#lib/server/config.js";
import { Logger } from "#lib/server/logger.js";

const original = { ...getConfig() };

afterEach(() => {
	getConfig().logFormat = original.logFormat;
	getConfig().logLevel = original.logLevel;
});

describe("Logger", () => {
	test("json lines merge plain objects, keep other params and serialise errors", () => {
		getConfig().logFormat = "json";
		getConfig().logLevel = "trace";
		const output = spyOn(console, "log").mockImplementation(() => {});
		const errors = spyOn(console, "error").mockImplementation(() => {});
		const logger = new Logger("Test");
		logger.info("hello", { userId: "u1" }, 42);
		logger.error("broke", new Error("boom"));
		const info = JSON.parse(String(output.mock.calls[0]?.[0]));
		const failure = JSON.parse(String(errors.mock.calls[0]?.[0]));
		output.mockRestore();
		errors.mockRestore();
		expect(info).toMatchObject({
			level: "info",
			scope: "Test",
			message: "hello",
			userId: "u1",
			params: [42],
		});
		expect(failure.error).toMatchObject({ name: "Error", message: "boom" });
	});

	test("drops lines under the configured level", () => {
		getConfig().logFormat = "console";
		getConfig().logLevel = "warn";
		const output = spyOn(console, "log").mockImplementation(() => {});
		const errors = spyOn(console, "error").mockImplementation(() => {});
		const logger = new Logger("Test");
		logger.trace("t");
		logger.debug("d");
		logger.info("i");
		logger.warn("w", { detail: true }, "text");
		const calls = output.mock.calls.length;
		const errorCalls = errors.mock.calls.length;
		output.mockRestore();
		errors.mockRestore();
		expect(calls).toBe(0);
		expect(errorCalls).toBe(1);
	});

	test("request lines log 5xx at error level and others at info", () => {
		getConfig().logLevel = "info";
		const output = spyOn(console, "log").mockImplementation(() => {});
		const errors = spyOn(console, "error").mockImplementation(() => {});
		const logger = new Logger("Test");
		getConfig().logFormat = "console";
		logger.request({ method: "GET", path: "/", status: 200, durationMs: 3 });
		logger.request({
			method: "GET",
			path: "/missing",
			status: 404,
			durationMs: 1,
		});
		logger.request({ method: "POST", path: "/", status: 400, durationMs: 1 });
		getConfig().logFormat = "json";
		logger.request({ method: "POST", path: "/", status: 500, durationMs: 9 });
		const infoCalls = output.mock.calls.length;
		const lastError = JSON.parse(String(errors.mock.calls.at(-1)?.[0]));
		output.mockRestore();
		errors.mockRestore();
		expect(infoCalls).toBe(2);
		expect(lastError).toMatchObject({ level: "error", status: 500, path: "/" });
	});
});
