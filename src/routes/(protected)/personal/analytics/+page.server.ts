import {
	type Period,
	periodRange,
	periods,
	summarize,
} from "#lib/analytics.js";
import { PersonalCategoryDTO } from "#lib/dto/personal-category.js";
import { PersonalExpenseDTO } from "#lib/dto/personal-expense.js";
import { PersonalFolderDTO } from "#lib/dto/personal-folder.js";

export const load = async ({ parent, url }) => {
	const { user } = await parent();
	const requested = url.searchParams.get("period");
	const period: Period = periods.includes(requested as Period)
		? (requested as Period)
		: "month";
	const rows = PersonalExpenseDTO.spending(user.id);
	const byCurrency = new Map<string, number>();
	for (const row of rows) {
		byCurrency.set(
			row.currency,
			(byCurrency.get(row.currency) ?? 0) + row.amountMinor,
		);
	}
	const currency =
		[...byCurrency].toSorted((left, right) => right[1] - left[1])[0]?.[0] ??
		"EUR";
	const inCurrency = rows.filter((row) => row.currency === currency);
	const range = periodRange(
		period,
		new Date().toISOString().slice(0, 10),
		inCurrency[0]?.spentOn,
	);
	const summary = summarize(
		inCurrency
			.filter((row) => row.kind === "expense" && !row.aside)
			.map((row) => ({
				category: row.category,
				merchantId: row.folderId,
				paidBy: user.id,
				amountMinor: row.amountMinor,
				spentOn: row.spentOn,
				shares: [],
			})),
		range,
		null,
	);
	return {
		period,
		currency,
		otherCurrencies: byCurrency.size > 1,
		summary,
		asideMinor: inCurrency
			.filter(
				(row) =>
					row.kind === "expense" &&
					row.aside &&
					row.spentOn >= range.from &&
					row.spentOn <= range.to,
			)
			.reduce((total, row) => total + row.amountMinor, 0),
		categories: PersonalCategoryDTO.forUser(user.id).map((entry) =>
			entry.toJSON(),
		),
		folders: PersonalFolderDTO.forUser(user.id).map((entry) => entry.toJSON()),
	};
};
