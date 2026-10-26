import { getRequestEvent } from "$app/server";
import { error } from "@sveltejs/kit";

import type { Session } from "#lib/server/auth.js";

/**
 * The signed-in user for the current remote function call; remote functions never run a layout's guard.
 *
 * @throws A 401 error when nobody is signed in.
 */
export function requireUser(): Session["user"] {
	const { locals } = getRequestEvent();
	if (!locals.user) {
		error(401, "Unauthorized");
	}
	return locals.user;
}
