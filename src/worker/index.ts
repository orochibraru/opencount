import { type Config, configure } from "#lib/server/config.js";
import { Logger } from "#lib/server/logger.js";
import {
	isConfigMessage,
	type WorkerReadyMessage,
} from "#lib/server/worker-messages.js";

import { isProcessAlive } from "./watchdog.js";

const logger = new Logger("Worker");

const parentPid = process.ppid;
const configTimeoutMs = 10_000;

let flushTelemetry = (): Promise<void> => Promise.resolve();

function exit(code: number): void {
	void flushTelemetry().finally(() => process.exit(code));
}

setInterval(() => {
	if (!isProcessAlive(parentPid)) {
		logger.warn("Parent server is gone, exiting");
		exit(0);
	}
}, 1000).unref();

function receiveConfig(): Promise<Config> {
	return new Promise((resolve, reject) => {
		if (!process.send) {
			reject(
				new Error(
					"The worker only runs under the server, which hands it its configuration",
				),
			);
			return;
		}
		const timeout = setTimeout(
			() => reject(new Error("The server sent no configuration")),
			configTimeoutMs,
		);
		process.on("message", (message) => {
			if (isConfigMessage(message)) {
				clearTimeout(timeout);
				resolve(message.config);
			}
		});
		process.send({ type: "ready" } satisfies WorkerReadyMessage);
	});
}

try {
	configure(await receiveConfig());
	try {
		const telemetry = await import("#lib/server/telemetry.js");
		telemetry.startTelemetry("worker");
		flushTelemetry = telemetry.flushTelemetry;
	} catch (error) {
		logger.error("Telemetry failed to start, running without it", error);
	}
	await import("./main.js");
	exit(0);
} catch (error) {
	logger.error("Worker failed to start", error);
	exit(1);
}
