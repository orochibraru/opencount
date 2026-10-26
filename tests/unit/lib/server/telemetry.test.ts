import { afterAll, describe, expect, test } from "bun:test";

import { getConfig } from "#lib/server/config.js";
import {
	flushTelemetry,
	reportError,
	startTelemetry,
	withSpan,
} from "#lib/server/telemetry.js";

const received: { path: string; bytes: number }[] = [];

const collector = Bun.serve({
	port: 0,
	async fetch(request) {
		received.push({
			path: new URL(request.url).pathname,
			bytes: (await request.arrayBuffer()).byteLength,
		});
		return new Response("{}", {
			headers: { "content-type": "application/json" },
		});
	},
});

const endpoint = `http://localhost:${collector.port}`;

afterAll(() => collector.stop(true));

describe("telemetry", () => {
	test("exports spans over OTLP and errors to the Sentry DSN, Homerun-style", async () => {
		received.length = 0;
		getConfig().telemetry.otlpEndpoint = endpoint;
		getConfig().telemetry.resourceAttributes = {
			"homerun.service.id": "svc_1",
		};
		getConfig().telemetry.sentryDsn = `http://publickey@localhost:${collector.port}/42`;
		startTelemetry("worker");
		startTelemetry("worker");

		expect(
			await withSpan("job test", { "job.id": 1 }, () =>
				Promise.resolve("done"),
			),
		).toBe("done");
		expect(
			withSpan("job broken", {}, () => Promise.reject(new Error("boom"))),
		).rejects.toThrow("boom");
		expect(reportError(new Error("reported"), { job: "test" })).toMatch(
			/^[0-9a-f]{32}$/,
		);

		await flushTelemetry();
		const paths = received.map((request) => request.path);
		expect(paths).toContain("/v1/traces");
		expect(paths).toContain("/api/42/envelope/");
		expect(received.every((request) => request.bytes > 0)).toBe(true);
	});

	test("stays off without an endpoint or a DSN", async () => {
		received.length = 0;
		getConfig().telemetry.otlpEndpoint = undefined;
		getConfig().telemetry.sentryDsn = undefined;
		startTelemetry("server");
		await withSpan("ignored", {}, () => Promise.resolve());
		reportError(new Error("ignored"));
		await flushTelemetry();
		expect(received).toEqual([]);
	});
});
