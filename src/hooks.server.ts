import { building, dev } from "$app/env";
import {
	type Handle,
	type HandleServerError,
	sequence,
	type ServerInit,
} from "@sveltejs/kit/hooks";
import { svelteKitHandler } from "better-auth/svelte-kit";

import { getAuth, publicOrigin } from "#lib/server/auth.js";
import { csrfHandler } from "#lib/server/csrf.js";
import { closeDb, migrateDb } from "#lib/server/db/lib.js";
import { Logger } from "#lib/server/logger.js";
import { announceSetup } from "#lib/server/setup.js";
import { flushTelemetry, reportError } from "#lib/server/telemetry.js";
import { workerCommand, WorkerSupervisor } from "#lib/server/worker-process.js";

const logger = new Logger("Server");

const globalForWorker = globalThis as unknown as {
	__opencountWorker?: WorkerSupervisor;
};

const devShutdownSignals = ["SIGINT", "SIGTERM", "SIGHUP"] as const;

function shutDown(reason: string): void {
	logger.info("Shutting down", { reason });
	globalForWorker.__opencountWorker?.stop();
	closeDb();
	void flushTelemetry().finally(() => process.exit(0));
}

export const init: ServerInit = () => {
	try {
		migrateDb();
	} catch (error) {
		logger.error("Could not migrate the database, refusing to start", error);
		throw error;
	}
	logger.info("Database migrated");

	if (globalForWorker.__opencountWorker) {
		return;
	}
	announceSetup();
	const supervisor = new WorkerSupervisor(workerCommand(dev));
	supervisor.start();
	globalForWorker.__opencountWorker = supervisor;

	process.once("exit", () => supervisor.stop());
	process.once("sveltekit:shutdown", () => shutDown("sveltekit:shutdown"));
	if (dev) {
		for (const signal of devShutdownSignals) {
			process.once(signal, () => shutDown(signal));
		}
	}
};

const quietPaths = [
	"/_app/",
	"/.well-known/",
	"/api/health",
	"/favicon",
	"/sw.js",
	"/workbox-",
];

const requestLog: Handle = async ({ event, resolve }) => {
	const startedAt = performance.now();
	const response = await resolve(event);
	if (
		!event.url.pathname.endsWith("/__data.json") &&
		!quietPaths.some((path) => event.url.pathname.startsWith(path))
	) {
		logger.request({
			method: event.request.method,
			path: event.url.pathname,
			status: response.status,
			durationMs: Math.round(performance.now() - startedAt),
		});
	}
	return response;
};

const authentication: Handle = async ({ event, resolve }) => {
	const auth = getAuth();
	const current = await auth.api.getSession({ headers: event.request.headers });
	event.locals.session = current?.session ?? null;
	event.locals.user = current?.user ?? null;
	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle = sequence(
	requestLog,
	csrfHandler(publicOrigin),
	authentication,
);

export const handleError: HandleServerError = ({ error, event, kind }) => {
	if (kind !== "unknown") {
		return;
	}
	const errorId = reportError(error, {
		path: event.route.id ?? event.url.pathname,
	});
	logger.error(
		"Unhandled error",
		{ errorId, method: event.request.method, path: event.url.pathname },
		error,
	);
	return { errorId, message: "Something went wrong." };
};
