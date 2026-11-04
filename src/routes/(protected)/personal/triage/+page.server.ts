import { fail } from "@sveltejs/kit";
import { z } from "zod";

import { categoryOptions } from "#lib/categories.js";
import { PersonalCategoryDTO } from "#lib/dto/personal-category.js";
import { PersonalExpenseDTO } from "#lib/dto/personal-expense.js";
import { accountBook } from "#lib/server/money/accounts.js";
import { ruleBook } from "#lib/server/money/rules.js";
import { parseForm } from "#lib/server/validation/form.js";

const fileSchema = z.object({
	id: z.string().trim().min(1),
	category: z.string().trim().min(1, "Pick a category."),
	rule: z.stringbool().default(false),
	pattern: z.string().trim().max(60).default(""),
});

export const load = async ({ parent }) => {
	const { user } = await parent();
	const page = PersonalExpenseDTO.page(user.id, {
		limit: 50,
		category: "other",
		kind: "expense",
	});
	return {
		queue: page.entries.map((entry) => {
			const {
				id,
				description,
				amountMinor,
				currency,
				spentOn,
				bankAccountUid,
			} = entry.toJSON();
			return {
				id,
				description,
				amountMinor,
				currency,
				spentOn,
				bankAccountUid,
			};
		}),
		left: page.total,
		categories: PersonalCategoryDTO.forUser(user.id).map((entry) =>
			entry.toJSON(),
		),
		accounts: accountBook.list(user.id).map(({ id, name }) => ({ id, name })),
	};
};

export const actions = {
	file: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const parsed = parseForm(fileSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		const userId = locals.user.id;
		const { id, category, rule, pattern } = parsed.data;
		const custom = PersonalCategoryDTO.forUser(userId).map((entry) =>
			entry.toJSON(),
		);
		if (!categoryOptions(custom).some((option) => option.value === category)) {
			return fail(400, { errors: { category: ["Pick a category."] } });
		}
		if (PersonalExpenseDTO.recategorize(userId, [id], category) === 0) {
			return fail(404, { error: "That expense no longer exists." });
		}
		if (rule && pattern.length >= 2) {
			const outcome = ruleBook.save(userId, {
				pattern,
				category,
				tag: null,
				pay: false,
				recurringId: null,
			});
			return { applied: "applied" in outcome ? outcome.applied : 0 };
		}
		return { applied: 0 };
	},
};
