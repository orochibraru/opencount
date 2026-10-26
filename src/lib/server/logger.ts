import { inspect, styleText } from "node:util";

import { type LogLevel, peekConfig } from "#lib/server/config.js";

const levelOrder: LogLevel[] = ["trace", "debug", "info", "warn", "error"];

const levelColors: Record<
	LogLevel,
	"gray" | "cyan" | "blue" | "yellow" | "red"
> = {
	trace: "gray",
	debug: "cyan",
	info: "blue",
	warn: "yellow",
	error: "red",
};

function settings(): { logLevel: LogLevel; logFormat: "console" | "json" } {
	return peekConfig() ?? { logLevel: "info", logFormat: "console" };
}

export interface RequestLine {
	method: string;
	path: string;
	status: number;
	durationMs: number;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return (
		typeof value === "object" &&
		value !== null &&
		Object.getPrototypeOf(value) === Object.prototype
	);
}

function serialiseError(error: Error): Record<string, unknown> {
	return { name: error.name, message: error.message, stack: error.stack };
}

function statusColor(status: number): "green" | "yellow" | "red" {
	if (status >= 500) {
		return "red";
	}
	return status >= 400 ? "yellow" : "green";
}

export class Logger {
	readonly #scope: string;

	/** Creates a logger whose lines are tagged with `scope`. */
	constructor(scope: string) {
		this.#scope = scope;
	}

	/** Writes a trace line. */
	trace(message: string, ...params: unknown[]): void {
		this.#write("trace", message, params);
	}

	/** Writes a debug line. */
	debug(message: string, ...params: unknown[]): void {
		this.#write("debug", message, params);
	}

	/** Writes an info line. */
	info(message: string, ...params: unknown[]): void {
		this.#write("info", message, params);
	}

	/** Writes a warning line to stderr. */
	warn(message: string, ...params: unknown[]): void {
		this.#write("warn", message, params);
	}

	/** Writes an error line to stderr; an `Error` param is serialised with its stack. */
	error(message: string, ...params: unknown[]): void {
		this.#write("error", message, params);
	}

	/** Writes one line for a finished HTTP request, at error level for a 4xx or 5xx other than 404. */
	request(line: RequestLine): void {
		const level = line.status >= 400 && line.status !== 404 ? "error" : "info";
		if (settings().logFormat === "json") {
			this.#write(level, "request", [{ ...line }]);
			return;
		}
		const summary = [
			styleText("bold", line.method),
			line.path,
			styleText(statusColor(line.status), String(line.status)),
			styleText("gray", `${line.durationMs}ms`),
		].join(" ");
		this.#write(level, summary, []);
	}

	#write(level: LogLevel, message: string, params: unknown[]): void {
		if (levelOrder.indexOf(level) < levelOrder.indexOf(settings().logLevel)) {
			return;
		}
		const output =
			level === "warn" || level === "error" ? console.error : console.log;
		if (settings().logFormat === "json") {
			output(JSON.stringify(this.#jsonLine(level, message, params)));
			return;
		}
		output(
			styleText("gray", new Date().toISOString().slice(11, 23)),
			styleText(levelColors[level], level.toUpperCase().padEnd(5)),
			styleText("magenta", `[${this.#scope}]`),
			message,
			...params.map((param) =>
				typeof param === "string"
					? param
					: inspect(param, { colors: true, depth: 5 }),
			),
		);
	}

	#jsonLine(
		level: LogLevel,
		message: string,
		params: unknown[],
	): Record<string, unknown> {
		const fields: Record<string, unknown> = {};
		const rest: unknown[] = [];
		for (const param of params) {
			if (param instanceof Error) {
				fields.error = serialiseError(param);
			} else if (isPlainObject(param)) {
				Object.assign(fields, param);
			} else {
				rest.push(param);
			}
		}
		return {
			time: new Date().toISOString(),
			level,
			scope: this.#scope,
			message,
			...fields,
			...(rest.length > 0 && { params: rest }),
		};
	}
}
