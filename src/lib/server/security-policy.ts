import { PasskeyDTO } from "#lib/dto/passkey.js";
import { getSetting } from "#lib/dto/setting.js";
import {
	enabledSignInMethods,
	usableMethods,
} from "#lib/server/sign-in-methods.js";

export type SecurityFactor = "two-factor" | "passkey";

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
	return missing;
}
