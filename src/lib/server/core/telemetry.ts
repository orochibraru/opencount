import {
	context,
	diag,
	DiagLogLevel,
	type Span,
	SpanStatusCode,
	trace,
} from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import {
	defaultResource,
	resourceFromAttributes,
} from "@opentelemetry/resources";
import { BatchSpanProcessor, TracerProvider } from "@opentelemetry/sdk-trace";
import * as Sentry from "@sentry/bun";

import { configuration } from "#lib/server/core/config.js";
import { Logger } from "#lib/server/core/logger.js";

const logger = new Logger("Telemetry");

export type ProcessRole = "server" | "worker";

const globalForTelemetry = globalThis as unknown as {
	__opencountTelemetry?: { provider: TracerProvider | undefined };
};

/** Error reporting through Sentry and tracing over OTLP, each on only when configured. */
class Telemetry {
	/**
	 * Starts Sentry error reporting when `SENTRY_DSN` is set and OpenTelemetry tracing over OTLP when
	 * `OTEL_EXPORTER_OTLP_ENDPOINT` is set, as Homerun injects them; does nothing on a second call.
	 */
	start(role: ProcessRole): void {
		if (globalForTelemetry.__opencountTelemetry) {
			return;
		}
		const { appVersion, telemetry: settings } = configuration.get();
		Sentry.init({
			dsn: settings.sentryDsn,
			release: settings.sentryRelease,
			environment: settings.sentryEnvironment,
			initialScope: { tags: { process: role } },
		});
		let provider: TracerProvider | undefined;
		if (!settings.otlpEndpoint) {
			logger.info("Tracing off: OTEL_EXPORTER_OTLP_ENDPOINT isn't set", {
				process: role,
			});
		} else {
			provider = this.#startTracing(
				role,
				appVersion,
				settings.otlpEndpoint,
				settings,
			);
		}
		globalForTelemetry.__opencountTelemetry = { provider };
	}

	/** Sends `error` to Sentry, when configured, and returns the event id. */
	reportError(error: unknown, tags: Record<string, string> = {}): string {
		return Sentry.captureException(error, { tags });
	}

	/** Runs `work` inside a span named `name`, marking the span failed and rethrowing when `work` throws. */
	withSpan<Result>(
		name: string,
		attributes: Record<string, string | number>,
		work: (span: Span) => Promise<Result>,
	): Promise<Result> {
		return trace
			.getTracer("opencount")
			.startActiveSpan(name, { attributes }, async (span) => {
				try {
					return await work(span);
				} catch (error) {
					span.recordException(error instanceof Error ? error : String(error));
					span.setStatus({
						code: SpanStatusCode.ERROR,
						message: error instanceof Error ? error.message : String(error),
					});
					throw error;
				} finally {
					span.end();
				}
			});
	}

	/** Exports pending spans and Sentry events, waiting at most two seconds, then stops both and their logging; never throws. */
	async flush(): Promise<void> {
		await Promise.allSettled([
			globalForTelemetry.__opencountTelemetry?.provider?.shutdown(),
			Sentry.close(2000),
		]);
		trace.disable();
		context.disable();
		diag.disable();
		globalForTelemetry.__opencountTelemetry = undefined;
	}

	/** Registers the global tracer provider exporting to `endpoint`, with OTel's own warnings routed to the logger. */
	#startTracing(
		role: ProcessRole,
		appVersion: string,
		endpoint: string,
		settings: {
			serviceName: string;
			resourceAttributes: Record<string, string>;
		},
	): TracerProvider {
		const forward = (message: string, ...args: unknown[]) =>
			logger.warn(message, ...args);
		diag.setLogger(
			{
				error: forward,
				warn: forward,
				info: forward,
				debug: forward,
				verbose: forward,
			},
			DiagLogLevel.WARN,
		);
		context.setGlobalContextManager(
			new AsyncLocalStorageContextManager().enable(),
		);
		const provider = new TracerProvider({
			resource: defaultResource().merge(
				resourceFromAttributes({
					...settings.resourceAttributes,
					"service.name": settings.serviceName,
					"service.version": appVersion,
					"opencount.process": role,
				}),
			),
			spanProcessors: [
				new BatchSpanProcessor({
					exporter: new OTLPTraceExporter({
						url: `${endpoint.replace(/\/+$/, "")}/v1/traces`,
					}),
				}),
			],
		});
		trace.setGlobalTracerProvider(provider);
		logger.info("Tracing on", {
			process: role,
			endpoint,
			serviceName: settings.serviceName,
		});
		return provider;
	}
}

export const telemetry = new Telemetry();
