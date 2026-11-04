import { fail } from "@sveltejs/kit";

import { AppearanceDTO } from "#lib/dto/appearance.js";
import { PersonalCategoryDTO } from "#lib/dto/personal-category.js";
import { PersonalExpenseDTO } from "#lib/dto/personal-expense.js";
import { RecurringSeriesDTO } from "#lib/dto/recurring-series.js";
import { ruleBook } from "#lib/server/money/rules.js";
import { parseForm } from "#lib/server/validation/form.js";
import {
	expectedPaydaySchema,
	ruleErrors,
	ruleSchema,
} from "#lib/server/validation/rules.js";

export const load = async ({ parent }) => {
	const { user } = await parent();
	const today = new Date().toISOString().slice(0, 10);
	const calendar = PersonalExpenseDTO.monthCalendar(user.id);
	return {
		fromPay: AppearanceDTO.monthSettingFor(user.id).fromPay,
		paydays: PersonalExpenseDTO.paydays(user.id).toReversed().slice(0, 12),
		expectedPayday: AppearanceDTO.expectedPaydayFor(user.id),
		nextPayday: calendar.next(calendar.startOf(today)),
		rules: ruleBook.list(user.id).filter((rule) => rule.pay),
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
	expected: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const parsed = parseForm(expectedPaydaySchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		AppearanceDTO.saveExpectedPayday(
			locals.user.id,
			parsed.data.clear ? null : parsed.data.expectedPayday,
		);
		return { saved: true };
	},
};
