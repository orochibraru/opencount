import { error } from "@sveltejs/kit";

import { rememberPublicOrigin } from "#lib/server/auth.js";

export const load = async ({ parent, url }) => {
	const { isAdmin } = await parent();
	if (!isAdmin) {
		error(404, "Not found");
	}
	rememberPublicOrigin(url.origin);
};
