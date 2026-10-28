export type LogLevel = "trace" | "debug" | "info" | "warn" | "error";
export type LogFormat = "console" | "json";
export type SignInMethodName =
	"password" | "passkey" | "magic-link" | "email-code";

export interface Config {
	appVersion: string;
	origin: string | undefined;
	databasePath: string;
	signInMethods: SignInMethodName[] | undefined;
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

/** Holds the process-wide configuration, kept on `globalThis` so Vite HMR reloads share it. */
class Configuration {
	/** Sets the configuration every server module reads: from `$app/env/private` in the server, from the server in the worker. */
	set(values: Config): void {
		globalForConfig.__opencountConfig = values;
	}

	/**
	 * The configuration.
	 *
	 * @throws When read before `set()`.
	 */
	get(): Config {
		if (!globalForConfig.__opencountConfig) {
			throw new Error("Configuration read before configuration.set() ran");
		}
		return globalForConfig.__opencountConfig;
	}

	/** The configuration, or `undefined` before `set()`: for the logger, which may run first. */
	peek(): Config | undefined {
		return globalForConfig.__opencountConfig;
	}

	/** Parses OTel's `key=value,key2=value2` resource attribute list, URL-decoding each part. */
	parseResourceAttributes(raw: string | undefined): Record<string, string> {
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
}

export const configuration = new Configuration();
