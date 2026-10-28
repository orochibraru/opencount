import { ExpenseDTO } from "#lib/dto/expense.js";
import { GroupCategoryDTO } from "#lib/dto/group-category.js";
import { groupAccess } from "#lib/server/expenses/group-access.js";

export const load = async ({ params, parent }) => {
	const { user } = await parent();
	const { group, members } = groupAccess.forMember(params.groupId, user.id);
	const memberRows = members.map((member) => member.toJSON());
	const balances = ExpenseDTO.balances(
		group.id,
		memberRows.map((member) => member.id),
	);
	return {
		group: group.toJSON(),
		isOwner: group.isOwnedBy(user.id),
		members: memberRows,
		myMemberId:
			memberRows.find((member) => member.userId === user.id)?.id ?? null,
		balances: Object.fromEntries(balances),
		categories: GroupCategoryDTO.forGroup(group.id).map((entry) =>
			entry.toJSON(),
		),
	};
};
