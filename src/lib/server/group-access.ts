import { error } from "@sveltejs/kit";

import { GroupMemberDTO } from "#lib/dto/group-member.js";
import { GroupDTO } from "#lib/dto/group.js";

/**
 * Group `groupId` and its members for an action, checking `userId` belongs to it.
 *
 * @throws A 404 when the group doesn't exist or `userId` isn't a member, so a stranger can't tell which.
 */
export function groupForMember(
	groupId: string,
	userId: string,
): { group: GroupDTO; members: GroupMemberDTO[] } {
	const group = GroupDTO.findForMember(groupId, userId);
	if (!group) {
		error(404, "Group not found");
	}
	return { group, members: GroupMemberDTO.forGroup(groupId) };
}
