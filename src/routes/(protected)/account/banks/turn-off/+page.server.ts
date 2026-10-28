import { fail } from "@sveltejs/kit";

import { removeBankCredentials } from "#lib/dto/bank-credential.js";
import { securityPolicy } from "#lib/server/auth/security-policy.js";

export const actions = {
	remove: ({ locals }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		if (!locals.session || !securityPolicy.signedInRecently(locals.session)) {
			return fail(403, { error: securityPolicy.recentSignInMessage });
		}
		removeBankCredentials(locals.user.id);
		return { removed: true };
	},
};
