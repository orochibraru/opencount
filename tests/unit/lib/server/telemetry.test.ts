import { afterAll, describe, expect, test } from "bun:test";

import { diag } from "@opentelemetry/api";

import { configuration } from "#lib/server/core/config.js";
import { telemetry } from "#lib/server/core/telemetry.js";

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
		configuration.get().telemetry.otlpEndpoint = endpoint;
		configuration.get().telemetry.resourceAttributes = {
			"homerun.service.id": "svc_1",
		};
		configuration.get().telemetry.sentryDsn = `http://publickey@localhost:${collector.port}/42`;
		telemetry.start("worker");
		telemetry.start("worker");

		expect(
			await telemetry.withSpan("job test", { "job.id": 1 }, () =>
				Promise.resolve("done"),
			),
		).toBe("done");
		expect(
			telemetry.withSpan("job broken", {}, () =>
				Promise.reject(new Error("boom")),
			),
		).rejects.toThrow("boom");
		expect(
			telemetry.reportError(new Error("reported"), { job: "test" }),
		).toMatch(/^[0-9a-f]{32}$/);

		for (const level of [
			"error",
			"warn",
			"info",
			"debug",
			"verbose",
		] as const) {
			diag[level]("collector unreachable");
		}

		await telemetry.flush();
		const paths = received.map((request) => request.path);
		expect(paths).toContain("/v1/traces");
		expect(paths).toContain("/api/42/envelope/");
		expect(received.every((request) => request.bytes > 0)).toBe(true);
	});

	test("stays off without an endpoint or a DSN", async () => {
		received.length = 0;
		configuration.get().telemetry.otlpEndpoint = undefined;
		configuration.get().telemetry.sentryDsn = undefined;
		telemetry.start("server");
		await telemetry.withSpan("ignored", {}, () => Promise.resolve());
		telemetry.reportError(new Error("ignored"));
		await telemetry.flush();
		expect(received).toEqual([]);
	});
});
