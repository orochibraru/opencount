import type { Config } from "#lib/server/config.js";

export interface WorkerReadyMessage {
	type: "ready";
}

export interface WorkerConfigMessage {
	type: "config";
	config: Config;
}

/** Whether an IPC message is the worker asking for its configuration. */
export function isReadyMessage(
	message: unknown,
): message is WorkerReadyMessage {
	return (
		typeof message === "object" &&
		message !== null &&
		(message as { type?: unknown }).type === "ready"
	);
}

/** Whether an IPC message is the server sending the worker its configuration. */
export function isConfigMessage(
	message: unknown,
): message is WorkerConfigMessage {
	return (
		typeof message === "object" &&
		message !== null &&
		(message as { type?: unknown }).type === "config" &&
		typeof (message as { config?: unknown }).config === "object"
	);
}
