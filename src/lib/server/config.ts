export type LogLevel = "trace" | "debug" | "info" | "warn" | "error";
export type LogFormat = "console" | "json";

export interface Config {
	appVersion: string;
	origin: string | undefined;
	databasePath: string;
	logLevel: LogLevel;
	logFormat: LogFormat;
	auth: { secret: string };
	worker: { concurrency: number; pollIntervalMs: number };
	telemetry: {
		otlpEndpoint: string | undefined;
		serviceName: string;
		resourceAttributes: Record<string, string>;
		sentryDsn: string | undefined;
		sentryRelease: string;
		sentryEnvironment: string;
	};
}

const globalForConfig = globalThis as unknown as { __opencountConfig?: Config };

/** Sets the configuration every server module reads: from `$app/env/private` in the server, from the server in the worker. */
export function configure(values: Config): void {
	globalForConfig.__opencountConfig = values;
}

/**
 * The configuration.
 *
 * @throws When read before `configure()`.
 */
export function getConfig(): Config {
	if (!globalForConfig.__opencountConfig) {
		throw new Error("Configuration read before configure() ran");
	}
	return globalForConfig.__opencountConfig;
}

/** The configuration, or `undefined` before `configure()`: for the logger, which may run first. */
export function peekConfig(): Config | undefined {
	return globalForConfig.__opencountConfig;
}

/** Parses OTel's `key=value,key2=value2` resource attribute list, URL-decoding each part. */
export function parseResourceAttributes(
	raw: string | undefined,
): Record<string, string> {
	const attributes: Record<string, string> = {};
	for (const pair of (raw ?? "").split(",")) {
		const separator = pair.indexOf("=");
		if (separator > 0) {
			attributes[decodeURIComponent(pair.slice(0, separator).trim())] =
				decodeURIComponent(pair.slice(separator + 1).trim());
		}
	}
	return attributes;
}
