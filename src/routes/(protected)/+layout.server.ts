import { AppLockDTO } from "#lib/dto/app-lock.js";
import { GroupDTO } from "#lib/dto/group.js";
import { getSetting } from "#lib/dto/setting.js";
import { access } from "#lib/server/auth/access.js";
import { accountBook } from "#lib/server/money/accounts.js";

export const load = ({ locals, url }) => {
	if (!locals.user) {
		access.redirectToSignIn(url);
	}
	return {
		user: {
			id: locals.user.id,
			name: locals.user.name,
			email: locals.user.email,
		},
		isAdmin: access.isAdmin(locals.user),
		moneyHome: accountBook.moneyHomeFor(locals.user.id),
		bankSyncEnabled: getSetting("bankSyncEnabled"),
		lockAfterMinutes:
			AppLockDTO.forUser(locals.user.id)?.lockAfterMinutes ?? null,
		groups: GroupDTO.forMember(locals.user.id).map((entry) => {
			const { id, name } = entry.toJSON();
			return { id, name };
		}),
	};
};
