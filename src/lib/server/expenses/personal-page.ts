import { z } from "zod";

import { categoryOptions } from "#lib/categories.js";
import { AppearanceDTO } from "#lib/dto/appearance.js";
import { BankConnectionDTO } from "#lib/dto/bank-connection.js";
import { PersonalCategoryDTO } from "#lib/dto/personal-category.js";
import { PersonalExpenseDTO } from "#lib/dto/personal-expense.js";
import { PersonalFolderDTO } from "#lib/dto/personal-folder.js";
import { knownValues } from "#lib/filter-params.js";

const pageSize = 50;
const limitSchema = z.coerce
	.number()
	.int()
	.min(pageSize)
	.max(10_000)
	.catch(pageSize);

/** The personal ledger pages: their expenses, filters, folders and totals. */
class PersonalPage {
	/**
	 * What a personal ledger page shows for `userId`: a page of expenses, in folder `folderId` when given and narrowed by
	 * the repeated `category`, `bank` and `account` search params and `q`, and the totals of what it shows.
	 */
	load(userId: string, url: URL, folderId?: string) {
		const custom = PersonalCategoryDTO.forUser(userId).map((entry) =>
			entry.toJSON(),
		);
		const categories = knownValues(
			url,
			"category",
			categoryOptions(custom).map((option) => option.value),
		);
		const search = url.searchParams.get("q")?.trim().slice(0, 100) || undefined;
		const accounts = BankConnectionDTO.forUser(userId).flatMap((entry) => {
			const connection = entry.toJSON();
			return connection.accounts.map((account) => ({
				uid: account.uid,
				name: account.name,
				bankId: connection.id,
				bankName: connection.bankName,
			}));
		});
		const bankIds = knownValues(
			url,
			"bank",
			accounts.map((account) => account.bankId),
		);
		const accountUids = knownValues(
			url,
			"account",
			accounts.map((account) => account.uid),
		);
		const filter = { folderId, categories, search, bankIds, accountUids };
		const page = PersonalExpenseDTO.page(userId, {
			limit: limitSchema.parse(url.searchParams.get("limit") ?? pageSize),
			...filter,
		});
		const monthStartDay = AppearanceDTO.monthStartFor(userId);
		const stats = PersonalExpenseDTO.stats(userId, filter, {
			startDay: monthStartDay,
		});
		return {
			expenses: page.entries.map((entry) => entry.toJSON()),
			hasMore: page.total > page.entries.length,
			matching: page.total,
			pageSize,
			categories: custom,
			categoryFilter: categories,
			accounts,
			bankFilter: bankIds,
			accountFilter: accountUids,
			search: search ?? "",
			stats,
			monthStartDay,
			folders: PersonalFolderDTO.forUser(userId).map((entry) => entry.toJSON()),
			defaultCurrency:
				stats.totals[0]?.currency ??
				page.entries[0]?.toJSON().currency ??
				"EUR",
		};
	}
}

export const personalPage = new PersonalPage();
