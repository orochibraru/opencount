import { resolve } from "$app/paths";
import { redirect } from "@sveltejs/kit";

import { AppearanceDTO } from "#lib/dto/appearance.js";
import { GroupDTO } from "#lib/dto/group.js";
import { isAdmin } from "#lib/server/admin.js";
import { redirectToSignIn } from "#lib/server/guards.js";
import { missingFactors } from "#lib/server/security-policy.js";

export const load = ({ locals, route, url }) => {
	if (!locals.user) {
		redirectToSignIn(url);
	}
	const missing = missingFactors(locals.user);
	if (missing.length > 0 && route.id !== "/(protected)/account/security") {
		redirect(
			303,
			`${resolve("/(protected)/account/security")}?required=${missing.join(",")}`,
		);
	}
	return {
		user: {
			id: locals.user.id,
			name: locals.user.name,
			email: locals.user.email,
		},
		isAdmin: isAdmin(locals.user),
		moneyHome: AppearanceDTO.homeFor(locals.user.id) === "money",
		groups: GroupDTO.forMember(locals.user.id).map((entry) => {
			const { id, name } = entry.toJSON();
			return { id, name };
		}),
	};
};
