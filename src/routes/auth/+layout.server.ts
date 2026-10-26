import { resolve } from "$app/paths";
import { redirect } from "@sveltejs/kit";

import { safeRedirectTarget } from "#lib/server/guards.js";
import { needsSetup } from "#lib/server/setup.js";

export const load = ({ locals, route, url }) => {
	if (locals.user) {
		redirect(303, safeRedirectTarget(url));
	}
	const onSetup = route.id === "/auth/setup";
	if (needsSetup() && !onSetup) {
		redirect(303, resolve("/auth/setup"));
	}
	if (!needsSetup() && onSetup) {
		redirect(303, resolve("/auth/sign-in"));
	}
};
