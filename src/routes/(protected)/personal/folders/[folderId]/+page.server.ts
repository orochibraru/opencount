import { error } from "@sveltejs/kit";

import { GroupDTO } from "#lib/dto/group.js";
import { PersonalFolderDTO } from "#lib/dto/personal-folder.js";
import { personalPage } from "#lib/server/personal-page.js";

export const load = async ({ params, parent, url }) => {
	const { user } = await parent();
	const folder = PersonalFolderDTO.findForUser(params.folderId, user.id);
	if (!folder) {
		error(404, "Folder not found");
	}
	return {
		...personalPage(user.id, url, folder.id),
		folder: folder.toJSON(),
		shareGroups: GroupDTO.forMember(user.id).map((entry) => {
			const { id, name, currency } = entry.toJSON();
			return { id, name, currency };
		}),
	};
};
