import {
	APP_VERSION,
	AUTH_SECRET,
	DATABASE_PATH,
	LOG_FORMAT,
	LOG_LEVEL,
	ORIGIN,
	OTEL_EXPORTER_OTLP_ENDPOINT,
	OTEL_RESOURCE_ATTRIBUTES,
	OTEL_SERVICE_NAME,
	SENTRY_DSN,
	SENTRY_ENVIRONMENT,
	SENTRY_RELEASE,
	SIGN_IN_METHODS,
	WORKER_CONCURRENCY,
	WORKER_POLL_INTERVAL_MS,
} from "$app/env/private";

import { type Config, configuration } from "#lib/server/core/config.js";

import packageJson from "../../../../package.json" with { type: "json" };

/** Builds the server's configuration from the environment. */
class EnvironmentConfig {
	/** The configuration built from the validated variables `src/env.ts` declares. */
	build(): Config {
		const appVersion = APP_VERSION ?? packageJson.version;
		return {
			appVersion,
			origin: ORIGIN ? new URL(ORIGIN).origin : undefined,
			databasePath: DATABASE_PATH,
			signInMethods: SIGN_IN_METHODS,
			logLevel: LOG_LEVEL,
			logFormat: LOG_FORMAT,
			auth: { secret: AUTH_SECRET },
			worker: {
				concurrency: WORKER_CONCURRENCY,
				pollIntervalMs: WORKER_POLL_INTERVAL_MS,
			},
			telemetry: {
				otlpEndpoint: OTEL_EXPORTER_OTLP_ENDPOINT,
				serviceName: OTEL_SERVICE_NAME,
				resourceAttributes: configuration.parseResourceAttributes(
					OTEL_RESOURCE_ATTRIBUTES,
				),
				sentryDsn: SENTRY_DSN,
				sentryRelease: SENTRY_RELEASE ?? appVersion,
				sentryEnvironment: SENTRY_ENVIRONMENT,
			},
		};
	}
}

export const environmentConfig = new EnvironmentConfig();
