import { resolve } from "$app/paths";
import { redirect } from "@sveltejs/kit";

import { needsSetup } from "#lib/server/setup.js";

/**
 * Sends a signed-out visitor to sign-in, remembering where they were going, or to setup on a fresh instance.
 *
 * @throws A 303 redirect to `/auth/sign-in` or `/auth/setup`.
 */
export function redirectToSignIn(url: URL): never {
	if (needsSetup()) {
		redirect(303, resolve("/auth/setup"));
	}
	const target = `${url.pathname}${url.search}`;
	redirect(
		303,
		`${resolve("/auth/sign-in")}?redirectTo=${encodeURIComponent(target)}`,
	);
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
