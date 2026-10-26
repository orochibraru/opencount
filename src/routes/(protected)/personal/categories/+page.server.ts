import { fail } from "@sveltejs/kit";
import { z } from "zod";

import { PersonalCategoryDTO } from "#lib/dto/personal-category.js";
import { PersonalExpenseDTO } from "#lib/dto/personal-expense.js";
import { personalGuess } from "#lib/server/bank-sync.js";
import {
	categoryNameTaken,
	categorySchema,
} from "#lib/server/validation/category.js";
import { parseForm } from "#lib/server/validation/form.js";
import { isMoneyAside } from "#lib/smart-category.js";

const idSchema = z.object({ id: z.string().min(1) });

export const load = async ({ parent }) => {
	const { user } = await parent();
	return {
		categories: PersonalCategoryDTO.forUser(user.id).map((entry) =>
			entry.toJSON(),
		),
		usage: PersonalCategoryDTO.usage(user.id),
	};
};

export const actions = {
	autoCategorize: ({ locals }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const userId = locals.user.id;
		const aside = PersonalExpenseDTO.markAside(userId, isMoneyAside);
		const moved = PersonalExpenseDTO.categorizeUncategorized(
			userId,
			personalGuess(userId),
		);
		return { moved, aside };
	},
	save: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const parsed = parseForm(categorySchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		const { id, name, icon } = parsed.data;
		const custom = PersonalCategoryDTO.forUser(locals.user.id).map((entry) =>
			entry.toJSON(),
		);
		if (categoryNameTaken(custom, name, id)) {
			return fail(400, {
				errors: { name: ["A category already has that name."] },
			});
		}
		if (id) {
			const existing = PersonalCategoryDTO.findForUser(id, locals.user.id);
			if (!existing) {
				return fail(404, { error: "That category no longer exists." });
			}
			existing.update(name, icon);
		} else {
			PersonalCategoryDTO.create(locals.user.id, name, icon);
		}
		return { saved: true };
	},
	delete: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const parsed = parseForm(idSchema, await request.formData());
		const existing = parsed.success
			? PersonalCategoryDTO.findForUser(parsed.data.id, locals.user.id)
			: undefined;
		if (!existing) {
			return fail(404, { error: "That category no longer exists." });
		}
		existing.delete();
		return { deleted: true };
	},
};
