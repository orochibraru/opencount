import { fail } from "@sveltejs/kit";

import { removeBankCredentials } from "#lib/dto/bank-credential.js";
import {
	recentSignInMessage,
	signedInRecently,
} from "#lib/server/security-policy.js";

export const actions = {
	remove: ({ locals }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		if (!locals.session || !signedInRecently(locals.session)) {
			return fail(403, { error: recentSignInMessage });
		}
		removeBankCredentials(locals.user.id);
		return { removed: true };
	},
};
