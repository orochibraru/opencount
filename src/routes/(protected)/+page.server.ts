import { fail } from "@sveltejs/kit";
import { z } from "zod";

import { AppearanceDTO } from "#lib/dto/appearance.js";
import { BankConnectionDTO } from "#lib/dto/bank-connection.js";
import { ExpenseDTO } from "#lib/dto/expense.js";
import { GroupMemberDTO } from "#lib/dto/group-member.js";
import { GroupDTO } from "#lib/dto/group.js";
import { PersonalCategoryDTO } from "#lib/dto/personal-category.js";
import { PersonalExpenseDTO } from "#lib/dto/personal-expense.js";
import { moneyOverview } from "#lib/money-overview.js";
import { homePages } from "#lib/server/db/schema.js";
import { groupForMember } from "#lib/server/group-access.js";
import { parseForm } from "#lib/server/validation/form.js";
import { newGroupSchema } from "#lib/server/validation/group.js";

const groupIdSchema = z.object({ id: z.string().min(1) });
const homeSchema = z.object({ home: z.enum(homePages) });

function overviewFor(userId: string) {
	const connections = BankConnectionDTO.forUser(userId).map((entry) =>
		entry.toJSON(),
	);
	const home = AppearanceDTO.homeFor(userId);
	const syncedAt = connections
		.map((connection) => connection.syncedAt)
		.filter((date) => date !== null)
		.toSorted((left, right) => right.getTime() - left.getTime())[0];
	return {
		askHome: connections.length > 0 && home === null,
		overview:
			home === "money"
				? {
						...moneyOverview(
							PersonalExpenseDTO.spending(userId),
							new Date().toISOString().slice(0, 10),
						),
						syncedAt: syncedAt ?? null,
						categories: PersonalCategoryDTO.forUser(userId).map((entry) =>
							entry.toJSON(),
						),
					}
				: null,
	};
}

export const load = async ({ parent }) => {
	const { user } = await parent();
	return {
		...overviewFor(user.id),
		groups: GroupDTO.forMember(user.id).map((entry) => {
			const group = entry.toJSON();
			const members = GroupMemberDTO.forGroup(group.id).map((member) =>
				member.toJSON(),
			);
			const myMemberId = members.find(
				(member) => member.userId === user.id,
			)?.id;
			const balances = ExpenseDTO.balances(
				group.id,
				members.map((member) => member.id),
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
	home: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const parsed = parseForm(homeSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { error: "Pick a home page." });
		}
		AppearanceDTO.saveHome(locals.user.id, parsed.data.home);
		return { home: parsed.data.home };
	},
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
