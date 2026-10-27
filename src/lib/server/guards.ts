import { resolve } from "$app/paths";
import { getRequestEvent } from "$app/server";
import { redirect, type RequestEvent } from "@sveltejs/kit";

import { needsSetup } from "#lib/server/setup.js";

/**
 * Sends a visitor with no usable session where they can get one, remembering where they were going: setup on a fresh
 * instance, the unlock screen for a locked session, the security page for one missing a factor an admin requires,
 * sign-in otherwise.
 *
 * @throws A 303 redirect.
 */
export function redirectToSignIn(url: URL): never {
	if (needsSetup()) {
		redirect(303, resolve("/auth/setup"));
	}
	const event: RequestEvent | undefined = getRequestEvent();
	const gate = event?.locals.gate;
	if (gate?.reason === "factors") {
		redirect(
			303,
			`${resolve("/(protected)/account/security")}?required=${gate.missing.join(",")}`,
		);
	}
	const target = encodeURIComponent(`${url.pathname}${url.search}`);
	const page = gate?.reason === "locked" ? "/auth/unlock" : "/auth/sign-in";
	redirect(303, `${resolve(page)}?redirectTo=${target}`);
}

/** The in-app path to go to after signing in: `redirectTo` when it's a local path, home otherwise. */
export function safeRedirectTarget(url: URL): string {
	const target = url.searchParams.get("redirectTo");
	const local = "http://local.invalid";
	const parsed = target?.startsWith("/") ? new URL(target, local) : undefined;
	return parsed?.origin === local
		? `${parsed.pathname}${parsed.search}${parsed.hash}`
		: resolve("/(protected)");
}
