import { fail } from "@sveltejs/kit";
import { z } from "zod";

import { categories, customCategoryIcons } from "#lib/categories.js";
import { ExpenseDTO } from "#lib/dto/expense.js";
import { GroupCategoryDTO } from "#lib/dto/group-category.js";
import { MerchantDTO } from "#lib/dto/merchant.js";
import { groupForMember } from "#lib/server/group-access.js";
import { parseForm } from "#lib/server/validation/form.js";
import { similarKey } from "#lib/similar-key.js";
import { guessCategory } from "#lib/smart-category.js";

const categorySchema = z.object({
	id: z.string().optional(),
	name: z
		.string()
		.trim()
		.min(1, "Give it a name.")
		.max(40, "Keep it under 40 characters."),
	icon: z
		.string()
		.refine((icon) => icon in customCategoryIcons, "Pick an icon."),
});

function nameTaken(groupId: string, name: string, exceptId?: string): boolean {
	const wanted = name.toLocaleLowerCase();
	return (
		categories.some((entry) => entry.label.toLocaleLowerCase() === wanted) ||
		GroupCategoryDTO.forGroup(groupId).some((entry) => {
			const row = entry.toJSON();
			return row.id !== exceptId && row.name.toLocaleLowerCase() === wanted;
		})
	);
}

export const load = async ({ parent }) => {
	const { group } = await parent();
	return { usage: GroupCategoryDTO.usage(group.id) };
};

export const actions = {
	autoCategorize: ({ locals, params }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const { group } = groupForMember(params.groupId, locals.user.id);
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
		const { group } = groupForMember(params.groupId, locals.user.id);
		const parsed = parseForm(categorySchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		const { id, name, icon } = parsed.data;
		if (nameTaken(group.id, name, id)) {
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
		const { group } = groupForMember(params.groupId, locals.user.id);
		const existing = GroupCategoryDTO.findInGroup(
			group.id,
			String((await request.formData()).get("id") ?? ""),
		);
		if (!existing) {
			return fail(404, { error: "That category no longer exists." });
		}
		existing.delete();
		return { deleted: true };
	},
};
