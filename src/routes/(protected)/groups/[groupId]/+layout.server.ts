import { computeBalances } from "#lib/balances.js";
import { ExpenseDTO } from "#lib/dto/expense.js";
import { GroupCategoryDTO } from "#lib/dto/group-category.js";
import { groupForMember } from "#lib/server/group-access.js";

export const load = async ({ params, parent }) => {
	const { user } = await parent();
	const { group, members } = groupForMember(params.groupId, user.id);
	const memberRows = members.map((member) => member.toJSON());
	const balances = computeBalances(
		memberRows.map((member) => member.id),
		ExpenseDTO.ledger(group.id),
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
