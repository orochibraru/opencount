import { context, type Span, SpanStatusCode, trace } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import {
	defaultResource,
	resourceFromAttributes,
} from "@opentelemetry/resources";
import { BatchSpanProcessor, TracerProvider } from "@opentelemetry/sdk-trace";
import * as Sentry from "@sentry/bun";

import { getConfig } from "#lib/server/config.js";

export type ProcessRole = "server" | "worker";

const globalForTelemetry = globalThis as unknown as {
	__opencountTelemetry?: { provider: TracerProvider | undefined };
};

/**
 * Starts Sentry error reporting when `SENTRY_DSN` is set and OpenTelemetry tracing over OTLP when
 * `OTEL_EXPORTER_OTLP_ENDPOINT` is set, as Homerun injects them; does nothing on a second call.
 */
export function startTelemetry(role: ProcessRole): void {
	if (globalForTelemetry.__opencountTelemetry) {
		return;
	}
	const { appVersion, telemetry } = getConfig();
	Sentry.init({
		dsn: telemetry.sentryDsn,
		release: telemetry.sentryRelease,
		environment: telemetry.sentryEnvironment,
		initialScope: { tags: { process: role } },
	});
	let provider: TracerProvider | undefined;
	if (telemetry.otlpEndpoint) {
		context.setGlobalContextManager(
			new AsyncLocalStorageContextManager().enable(),
		);
		provider = new TracerProvider({
			resource: defaultResource().merge(
				resourceFromAttributes({
					...telemetry.resourceAttributes,
					"service.name": telemetry.serviceName,
					"service.version": appVersion,
					"opencount.process": role,
				}),
			),
			spanProcessors: [
				new BatchSpanProcessor({
					exporter: new OTLPTraceExporter({
						url: `${telemetry.otlpEndpoint.replace(/\/+$/, "")}/v1/traces`,
					}),
				}),
			],
		});
		trace.setGlobalTracerProvider(provider);
	}
	globalForTelemetry.__opencountTelemetry = { provider };
}

/** Sends `error` to Sentry, when configured, and returns the event id. */
export function reportError(
	error: unknown,
	tags: Record<string, string> = {},
): string {
	return Sentry.captureException(error, { tags });
}

/** Runs `work` inside a span named `name`, marking the span failed and rethrowing when `work` throws. */
export function withSpan<Result>(
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

/** Exports pending spans and Sentry events, waiting at most two seconds, then stops both; never throws. */
export async function flushTelemetry(): Promise<void> {
	await Promise.allSettled([
		globalForTelemetry.__opencountTelemetry?.provider?.shutdown(),
		Sentry.close(2000),
	]);
	trace.disable();
	context.disable();
	globalForTelemetry.__opencountTelemetry = undefined;
}
