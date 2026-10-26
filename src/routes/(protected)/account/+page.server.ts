import { resolve } from "$app/paths";
import { redirect } from "@sveltejs/kit";

import { getAuth } from "#lib/server/auth.js";

export const actions = {
	signOut: async ({ request }) => {
		await getAuth().api.signOut({ headers: request.headers });
		redirect(303, resolve("/auth/sign-in"));
	},
};
