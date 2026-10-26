import { resolve } from "$app/paths";
import { redirect } from "@sveltejs/kit";

import { GroupDTO } from "#lib/dto/group.js";
import { isAdmin } from "#lib/server/admin.js";
import { redirectToSignIn } from "#lib/server/guards.js";
import { missingFactors } from "#lib/server/security-policy.js";

export const load = ({ locals, url }) => {
	if (!locals.user) {
		redirectToSignIn(url);
	}
	const missing = missingFactors(locals.user);
	const securityPath = resolve("/(protected)/account/security");
	if (missing.length > 0 && url.pathname !== securityPath) {
		redirect(303, `${securityPath}?required=${missing.join(",")}`);
	}
	return {
		user: {
			id: locals.user.id,
			name: locals.user.name,
			email: locals.user.email,
		},
		isAdmin: isAdmin(locals.user),
		groups: GroupDTO.forMember(locals.user.id).map((entry) => {
			const { id, name } = entry.toJSON();
			return { id, name };
		}),
	};
};
