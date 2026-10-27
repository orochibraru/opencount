import { AppLockDTO } from "#lib/dto/app-lock.js";
import { GroupDTO } from "#lib/dto/group.js";
import { isAdmin } from "#lib/server/admin.js";
import { redirectToSignIn } from "#lib/server/guards.js";

export const load = ({ locals, url }) => {
	if (!locals.user) {
		redirectToSignIn(url);
	}
	return {
		user: {
			id: locals.user.id,
			name: locals.user.name,
			email: locals.user.email,
		},
		isAdmin: isAdmin(locals.user),
		lockAfterMinutes:
			AppLockDTO.forUser(locals.user.id)?.lockAfterMinutes ?? null,
		groups: GroupDTO.forMember(locals.user.id).map((entry) => {
			const { id, name } = entry.toJSON();
			return { id, name };
		}),
	};
};
