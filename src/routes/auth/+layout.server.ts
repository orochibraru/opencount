import { resolve } from "$app/paths";
import { redirect } from "@sveltejs/kit";

import { redirectToSignIn, safeRedirectTarget } from "#lib/server/guards.js";
import { needsSetup } from "#lib/server/setup.js";

export const load = ({ locals, route, url }) => {
	if (locals.user) {
		redirect(303, safeRedirectTarget(url));
	}
	const onUnlock = route.id === "/auth/unlock";
	if (locals.gate && !onUnlock) {
		redirectToSignIn(new URL(safeRedirectTarget(url), url));
	}
	if (!locals.gate && onUnlock) {
		redirect(303, `${resolve("/auth/sign-in")}${url.search}`);
	}
	const onSetup = route.id === "/auth/setup";
	if (needsSetup() && !onSetup) {
		redirect(303, resolve("/auth/setup"));
	}
	if (!needsSetup() && onSetup) {
		redirect(303, resolve("/auth/sign-in"));
	}
};
