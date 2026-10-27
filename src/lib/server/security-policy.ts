import { AppLockDTO } from "#lib/dto/app-lock.js";
import { PasskeyDTO } from "#lib/dto/passkey.js";
import { getSetting } from "#lib/dto/setting.js";
import { appLock } from "#lib/server/app-lock.js";
import type { Session } from "#lib/server/auth.js";
import {
	enabledSignInMethods,
	usableMethods,
} from "#lib/server/sign-in-methods.js";

export type SecurityFactor = "two-factor" | "passkey" | "app-lock";

export type SessionGate =
	| { reason: "locked"; user: Session["user"]; sessionId: string }
	| { reason: "factors"; missing: SecurityFactor[] };

export const recentSignInMessage =
	"For your safety, sign out and back in, then do this within 15 minutes.";

const recentSignInMs = 15 * 60_000;

const securityRouteId = "/(protected)/account/security";

/**
 * The factors `user` must still set up: what an admin requires, plus a passkey when password sign-in is off and
 * they'd otherwise have no way back in.
 */
export function missingFactors(user: {
	id: string;
	twoFactorEnabled?: boolean | null;
}): SecurityFactor[] {
	const missing: SecurityFactor[] = [];
	if (getSetting("requireTwoFactor") && !user.twoFactorEnabled) {
		missing.push("two-factor");
	}
	const hasPasskey = PasskeyDTO.forUser(user.id).length > 0;
	const methods = enabledSignInMethods();
	const lockedOut =
		!methods.password && usableMethods(user.id, methods).length === 0;
	if ((getSetting("requirePasskey") || lockedOut) && !hasPasskey) {
		missing.push("passkey");
	}
	if (getSetting("requireAppLock") && !AppLockDTO.forUser(user.id)) {
		missing.push("app-lock");
	}
	return missing;
}

/** Whether `session` signed in recently enough to change security settings without proving who it is again. */
export function signedInRecently(
	session: { createdAt: Date },
	now = Date.now(),
): boolean {
	return now - session.createdAt.getTime() < recentSignInMs;
}

/**
 * What keeps a signed-in session from the app on this request: its app lock, or factors an admin requires and it lacks
 * (everywhere but the security page, where it sets them up). `undefined` when nothing does.
 */
export function sessionGate(
	current: Session,
	routeId: string | null,
): SessionGate | undefined {
	if (appLock.isLocked(current.session)) {
		return {
			reason: "locked",
			user: current.user,
			sessionId: current.session.id,
		};
	}
	const missing = missingFactors(current.user);
	if (missing.length > 0 && routeId !== securityRouteId) {
		return { reason: "factors", missing };
	}
	return undefined;
}
