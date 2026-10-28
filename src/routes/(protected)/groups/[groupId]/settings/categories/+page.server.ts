import { fail } from "@sveltejs/kit";

import { ExpenseDTO } from "#lib/dto/expense.js";
import { GroupCategoryDTO } from "#lib/dto/group-category.js";
import { MerchantDTO } from "#lib/dto/merchant.js";
import { groupAccess } from "#lib/server/expenses/group-access.js";
import {
	categoryNameTaken,
	categorySchema,
} from "#lib/server/validation/category.js";
import { idSchema, parseForm } from "#lib/server/validation/form.js";
import { similarKey } from "#lib/similar-key.js";
import { guessCategory } from "#lib/smart-category.js";

export const load = async ({ parent }) => {
	const { group } = await parent();
	return { usage: GroupCategoryDTO.usage(group.id) };
};

export const actions = {
	autoCategorize: ({ locals, params }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const { group } = groupAccess.forMember(params.groupId, locals.user.id);
		const custom = GroupCategoryDTO.forGroup(group.id).map((entry) =>
			entry.toJSON(),
		);
		const merchants = new Map(
			MerchantDTO.forGroup(group.id).map((entry) => {
				const { id, category } = entry.toJSON();
				return [id, category];
			}),
		);
		const history = ExpenseDTO.categoryHistory(group.id);
		const moved = ExpenseDTO.categorizeUncategorized(
			group.id,
			(description, merchantId) => {
				const remembered = merchantId ? merchants.get(merchantId) : undefined;
				return (
					history.get(similarKey(description)) ??
					(remembered && remembered !== "other" ? remembered : undefined) ??
					guessCategory(description, custom)
				);
			},
		);
		return { moved };
	},
	save: async ({ locals, params, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const { group } = groupAccess.forMember(params.groupId, locals.user.id);
		const parsed = parseForm(categorySchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		const { id, name, icon } = parsed.data;
		if (
			categoryNameTaken(
				GroupCategoryDTO.forGroup(group.id).map((entry) => entry.toJSON()),
				name,
				id,
			)
		) {
			return fail(400, {
				errors: { name: ["A category already has that name."] },
			});
		}
		if (id) {
			const existing = GroupCategoryDTO.findInGroup(group.id, id);
			if (!existing) {
				return fail(404, { error: "That category no longer exists." });
			}
			existing.update(name, icon);
		} else {
			GroupCategoryDTO.create(group.id, name, icon);
		}
		return { saved: true };
	},
	delete: async ({ locals, params, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const { group } = groupAccess.forMember(params.groupId, locals.user.id);
		const parsed = parseForm(idSchema, await request.formData());
		const existing =
			parsed.success && GroupCategoryDTO.findInGroup(group.id, parsed.data.id);
		if (!existing) {
			return fail(404, { error: "That category no longer exists." });
		}
		existing.delete();
		return { deleted: true };
	},
};
