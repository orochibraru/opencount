import { resolve } from "$app/paths";
import { redirect } from "@sveltejs/kit";

import { AppearanceDTO } from "#lib/dto/appearance.js";
import { BankConnectionDTO } from "#lib/dto/bank-connection.js";
import { PersonalCategoryDTO } from "#lib/dto/personal-category.js";
import { PersonalExpenseDTO } from "#lib/dto/personal-expense.js";
import { moneyOverview } from "#lib/money-overview.js";

export const load = async ({ parent }) => {
	const { user } = await parent();
	if (AppearanceDTO.homeFor(user.id) !== "money") {
		redirect(303, resolve("/(protected)"));
	}
	const syncedAt = BankConnectionDTO.forUser(user.id)
		.map((entry) => entry.toJSON().syncedAt)
		.filter((date) => date !== null)
		.toSorted((left, right) => right.getTime() - left.getTime())[0];
	return {
		overview: {
			...moneyOverview(
				PersonalExpenseDTO.spending(user.id),
				new Date().toISOString().slice(0, 10),
			),
			syncedAt: syncedAt ?? null,
			categories: PersonalCategoryDTO.forUser(user.id).map((entry) =>
				entry.toJSON(),
			),
		},
	};
};
