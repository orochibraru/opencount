import { fail } from "@sveltejs/kit";

import type { Session } from "#lib/server/auth.js";
import {
	recentSignInMessage,
	signedInRecently,
} from "#lib/server/security-policy.js";

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

/** Like `adminFrom`, for an action that hands out access (a role, an email, a reset): it also needs a recent sign-in. */
export function recentAdminFrom(
	locals: App.Locals,
): Session["user"] | ReturnType<typeof fail<{ error: string }>> {
	const admin = adminFrom(locals);
	if ("id" in admin && (!locals.session || !signedInRecently(locals.session))) {
		return fail(403, { error: recentSignInMessage });
	}
	return admin;
}
