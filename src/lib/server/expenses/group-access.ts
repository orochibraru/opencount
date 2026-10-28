import { error } from "@sveltejs/kit";

import { GroupMemberDTO } from "#lib/dto/group-member.js";
import { GroupDTO } from "#lib/dto/group.js";

/** Group data only for the group's members: a group id from a URL or a form is checked here first. */
class GroupAccess {
	/**
	 * Group `groupId` and its members for an action, checking `userId` belongs to it.
	 *
	 * @throws A 404 when the group doesn't exist or `userId` isn't a member, so a stranger can't tell which.
	 */
	forMember(
		groupId: string,
		userId: string,
	): { group: GroupDTO; members: GroupMemberDTO[] } {
		const group = GroupDTO.findForMember(groupId, userId);
		if (!group) {
			error(404, "Group not found");
		}
		return { group, members: GroupMemberDTO.forGroup(groupId) };
	}
}

export const groupAccess = new GroupAccess();
