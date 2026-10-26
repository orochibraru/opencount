import { fail } from "@sveltejs/kit";

import type { Session } from "#lib/server/auth.js";

/** Whether `user` holds the admin role. */
export function isAdmin(
	user: { role?: string | null } | null | undefined,
): boolean {
	return user?.role === "admin";
}

/** The signed-in admin for a form action, or the failure to return when the caller isn't one. */
export function adminFrom(
	locals: App.Locals,
): Session["user"] | ReturnType<typeof fail<{ error: string }>> {
	if (!locals.user || !isAdmin(locals.user)) {
		return fail(403, { error: "Only admins can do that." });
	}
	return locals.user;
}
