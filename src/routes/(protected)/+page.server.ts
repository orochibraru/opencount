import { resolve } from "$app/paths";
import { redirect } from "@sveltejs/kit";

import { PersonalCategoryDTO } from "#lib/dto/personal-category.js";
import { PersonalExpenseDTO } from "#lib/dto/personal-expense.js";
import { moneyOverview } from "#lib/money-overview.js";
import { monthlyCost } from "#lib/recurring-schedule.js";
import { accountBook } from "#lib/server/money/accounts.js";
import { periodSummary } from "#lib/server/money/period-summary.js";
import { recurringBook } from "#lib/server/money/recurring.js";

export const load = async ({ parent }) => {
	const { user } = await parent();
	if (!accountBook.moneyHomeFor(user.id)) {
		redirect(307, resolve("/(protected)/groups"));
	}
	const summary = periodSummary.summarize(user.id);
	return {
		accounts: accountBook.list(user.id),
		currency: summary.currency,
		left:
			summary.left.accounts.length > 0
				? { parts: summary.left, included: summary.included }
				: null,
		overview: {
			...moneyOverview(
				PersonalExpenseDTO.spending(user.id),
				new Date().toISOString().slice(0, 10),
				PersonalExpenseDTO.monthCalendar(user.id),
			),
			recurring: recurringBook
				.list(user.id)
				.filter(
					(payment) =>
						!payment.ended &&
						payment.kind === "expense" &&
						payment.currency === summary.currency,
				)
				.map((payment) => ({
					description: payment.label,
					amountMinor: monthlyCost(payment),
				})),
			categories: PersonalCategoryDTO.forUser(user.id).map((entry) =>
				entry.toJSON(),
			),
		},
	};
};
