import { fail } from "@sveltejs/kit";

import {
	type Period,
	periodRange,
	periods,
	summarize,
} from "#lib/analytics.js";
import { categoryOptions } from "#lib/categories.js";
import { AppearanceDTO } from "#lib/dto/appearance.js";
import { BankConnectionDTO } from "#lib/dto/bank-connection.js";
import { PersonalCategoryDTO } from "#lib/dto/personal-category.js";
import { PersonalExpenseDTO } from "#lib/dto/personal-expense.js";
import { PersonalFolderDTO } from "#lib/dto/personal-folder.js";
import { fuzzyMatches } from "#lib/fuzzy.js";
import { bankSync } from "#lib/server/banking/bank-sync.js";
import { parseForm } from "#lib/server/validation/form.js";
import { accountFlagSchema } from "#lib/server/validation/personal.js";

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
	const period: Period = periods.includes(requested as Period)
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
	const range = periodRange(
		period,
		new Date().toISOString().slice(0, 10),
		inCurrency[0]?.spentOn,
		AppearanceDTO.monthStartFor(user.id),
	);
	const inRange = inCurrency.filter(
		(row) => row.spentOn >= range.from && row.spentOn <= range.to,
	);
	const sum = (keep: (row: (typeof rows)[number]) => boolean) =>
		inRange.filter(keep).reduce((total, row) => total + row.amountMinor, 0);
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
	const held = (savings: boolean) =>
		accounts
			.filter(
				(account) =>
					Boolean(account.savings) === savings &&
					account.balance?.currency === currency,
			)
			.reduce(
				(total, account) =>
					total +
					(account.shared
						? Math.trunc((account.balance?.minor ?? 0) / 2)
						: (account.balance?.minor ?? 0)),
				0,
			);
	return {
		period,
		filter,
		currency,
		otherCurrencies: byCurrency.size > 1,
		summary,
		incomeMinor: sum((row) => row.kind === "income" && !row.aside),
		asideMinor: sum((row) => row.kind === "expense" && row.aside),
		availableMinor: held(false),
		investedMinor: held(true),
		accounts: accounts.map(
			({ uid, name, bankName, connectionId, shared, savings, balance }) => ({
				uid,
				name,
				bankName,
				connectionId,
				shared: shared ?? false,
				savings: savings ?? false,
				balance: balance ?? null,
			}),
		),
		categories: custom,
		folders,
	};
};

export const actions = {
	setAccount: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const parsed = parseForm(accountFlagSchema, await request.formData());
		const connection = parsed.success
			? BankConnectionDTO.findForUser(parsed.data.connectionId, locals.user.id)
			: undefined;
		if (
			!parsed.success ||
			!connection?.setAccountFlags(parsed.data.uid, {
				[parsed.data.flag]: parsed.data.value,
			})
		) {
			return fail(404, { error: "That account isn't linked anymore." });
		}
		if (parsed.data.flag === "savings") {
			bankSync.pairTransfers(locals.user.id);
		}
		return { saved: true };
	},
};
