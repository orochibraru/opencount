import { z } from "zod";

import {
	type Period,
	periodRange,
	periods,
	summarize,
} from "#lib/analytics.js";
import { categoryOptions } from "#lib/categories.js";
import { BankConnectionDTO } from "#lib/dto/bank-connection.js";
import { PersonalCategoryDTO } from "#lib/dto/personal-category.js";
import { PersonalExpenseDTO } from "#lib/dto/personal-expense.js";
import { PersonalFolderDTO } from "#lib/dto/personal-folder.js";
import { fuzzyMatches } from "#lib/fuzzy.js";
import { accountBook } from "#lib/server/money/accounts.js";
import { spendingKind } from "#lib/spending-kind.js";

const customRangeSchema = z
	.object({ from: z.iso.date(), to: z.iso.date() })
	.refine((range) => range.from <= range.to)
	.transform((range) => ({
		...range,
		bucket:
			(new Date(range.to).getTime() - new Date(range.from).getTime()) /
				86_400_000 >
			62
				? ("week" as const)
				: ("day" as const),
	}));

/** The Insights filter in `url`, each value kept only when it is one of `known`. */
function readFilter(
	url: URL,
	known: {
		categories: string[];
		folders: string[];
		banks: string[];
		accounts: string[];
	},
) {
	const pick = (name: string, values: string[]) => {
		const wanted = url.searchParams.get(name);
		return values.find((value) => value === wanted) ?? null;
	};
	return {
		category: pick("category", known.categories),
		folder: pick("folder", known.folders),
		bank: pick("bank", known.banks),
		account: pick("account", known.accounts),
		search: url.searchParams.get("q")?.trim().slice(0, 100) ?? "",
	};
}

export const load = async ({ parent, url }) => {
	const { user } = await parent();
	const requested = url.searchParams.get("period");
	const customRange = customRangeSchema.safeParse({
		from: url.searchParams.get("from"),
		to: url.searchParams.get("to"),
	});
	const period: Period | "custom" =
		requested === "custom" && customRange.success
			? "custom"
			: periods.includes(requested as Period)
				? (requested as Period)
				: "month";
	const custom = PersonalCategoryDTO.forUser(user.id).map((entry) =>
		entry.toJSON(),
	);
	const folders = PersonalFolderDTO.forUser(user.id).map((entry) =>
		entry.toJSON(),
	);
	const accounts = BankConnectionDTO.accountsOf(user.id);
	const filter = readFilter(url, {
		categories: categoryOptions(custom).map((option) => option.value),
		folders: folders.map((entry) => entry.id),
		banks: [...new Set(accounts.map((account) => account.connectionId))],
		accounts: accounts.map((account) => account.uid),
	});
	const rows = PersonalExpenseDTO.spending(user.id).filter(
		(row) =>
			(!filter.category || row.category === filter.category) &&
			(!filter.folder || row.folderId === filter.folder) &&
			(!filter.bank || row.bankConnectionId === filter.bank) &&
			(!filter.account || row.bankAccountUid === filter.account) &&
			(!filter.search || fuzzyMatches(row.description, filter.search)),
	);
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
	const calendar = PersonalExpenseDTO.monthCalendar(user.id);
	const range =
		period === "custom" && customRange.success
			? customRange.data
			: periodRange(
					period === "custom" ? "month" : period,
					new Date().toISOString().slice(0, 10),
					inCurrency[0]?.spentOn,
					calendar,
				);
	const inRange = inCurrency.filter(
		(row) => row.spentOn >= range.from && row.spentOn <= range.to,
	);
	const sum = (keep: (row: (typeof rows)[number]) => boolean) =>
		inRange.filter(keep).reduce((total, row) => total + row.amountMinor, 0);
	const summary = summarize(
		inCurrency
			.filter((row) => spendingKind(row) === "spent")
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
	const byAccount = new Map<string, number>();
	for (const row of inRange) {
		if (spendingKind(row) === "spent" && row.bankAccountUid) {
			byAccount.set(
				row.bankAccountUid,
				(byAccount.get(row.bankAccountUid) ?? 0) + row.amountMinor,
			);
		}
	}
	return {
		period,
		followsPay: calendar.followsPay,
		range: { from: range.from, to: range.to },
		byAccount: [...byAccount]
			.map(([key, totalMinor]) => ({ key, totalMinor }))
			.toSorted((left, right) => right.totalMinor - left.totalMinor),
		filter,
		currency,
		otherCurrencies: byCurrency.size > 1,
		summary,
		incomeMinor: sum((row) => spendingKind(row) === "income"),
		asideMinor: sum((row) => spendingKind(row) === "aside"),
		financeMinor: sum((row) => spendingKind(row) === "finance"),
		availableMinor: accountBook.held(user.id, currency, false),
		investedMinor: accountBook.held(user.id, currency, true),
		accounts: accounts.map(({ uid, name, bankName, connectionId }) => ({
			uid,
			name,
			bankName,
			connectionId,
		})),
		categories: custom,
		folders,
	};
};
