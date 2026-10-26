import { fail } from "@sveltejs/kit";
import { z } from "zod";

import { computeBalances } from "#lib/balances.js";
import { ExpenseDTO } from "#lib/dto/expense.js";
import { GroupMemberDTO } from "#lib/dto/group-member.js";
import { GroupDTO } from "#lib/dto/group.js";
import { groupForMember } from "#lib/server/group-access.js";
import { parseForm } from "#lib/server/validation/form.js";
import { newGroupSchema } from "#lib/server/validation/group.js";

const groupIdSchema = z.object({ id: z.string().min(1) });

export const load = async ({ parent }) => {
	const { user } = await parent();
	return {
		groups: GroupDTO.forMember(user.id).map((entry) => {
			const group = entry.toJSON();
			const members = GroupMemberDTO.forGroup(group.id).map((member) =>
				member.toJSON(),
			);
			const myMemberId = members.find(
				(member) => member.userId === user.id,
			)?.id;
			const balances = computeBalances(
				members.map((member) => member.id),
				ExpenseDTO.ledger(group.id),
			);
			return {
				...group,
				memberNames: members.map((member) => member.displayName),
				myBalanceMinor: myMemberId ? (balances.get(myMemberId) ?? 0) : 0,
				isOwner: group.createdBy === user.id,
			};
		}),
	};
};

export const actions = {
	create: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const parsed = parseForm(newGroupSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		const group = GroupDTO.create({
			...parsed.data,
			owner: { id: locals.user.id, name: locals.user.name },
		});
		return { group: group.toJSON() };
	},
	delete: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const parsed = parseForm(groupIdSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { error: "Pick a group." });
		}
		const { group } = groupForMember(parsed.data.id, locals.user.id);
		if (!group.isOwnedBy(locals.user.id)) {
			return fail(403, {
				error: "Only the person who created the group can delete it.",
			});
		}
		group.delete();
		return { deleted: true };
	},
};
