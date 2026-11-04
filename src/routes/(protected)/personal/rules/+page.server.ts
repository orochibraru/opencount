import { fail } from "@sveltejs/kit";

import { PersonalCategoryDTO } from "#lib/dto/personal-category.js";
import { RecurringSeriesDTO } from "#lib/dto/recurring-series.js";
import { ruleBook } from "#lib/server/money/rules.js";
import { parseForm } from "#lib/server/validation/form.js";
import {
	ruleErrors,
	ruleIdSchema,
	ruleSchema,
} from "#lib/server/validation/rules.js";

export const load = async ({ parent }) => {
	const { user } = await parent();
	return {
		rules: ruleBook.list(user.id),
		categories: PersonalCategoryDTO.forUser(user.id).map((entry) =>
			entry.toJSON(),
		),
		series: RecurringSeriesDTO.forUser(user.id).map((entry) => entry.toJSON()),
	};
};

export const actions = {
	save: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const parsed = parseForm(ruleSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		const { id, ...input } = parsed.data;
		const outcome = ruleBook.save(locals.user.id, input, id || undefined);
		if ("error" in outcome) {
			return fail(400, { errors: ruleErrors[outcome.error] });
		}
		return { applied: outcome.applied };
	},
	remove: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const parsed = parseForm(ruleIdSchema, await request.formData());
		if (!parsed.success || !ruleBook.remove(locals.user.id, parsed.data.id)) {
			return fail(404, { error: "That rule no longer exists." });
		}
		return { removed: true };
	},
};
