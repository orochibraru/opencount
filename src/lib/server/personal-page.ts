import { z } from "zod";

import { categoryOptions } from "#lib/categories.js";
import { BankConnectionDTO } from "#lib/dto/bank-connection.js";
import { PersonalCategoryDTO } from "#lib/dto/personal-category.js";
import { PersonalExpenseDTO } from "#lib/dto/personal-expense.js";
import { PersonalFolderDTO } from "#lib/dto/personal-folder.js";

const pageSize = 50;
const limitSchema = z.coerce
	.number()
	.int()
	.min(pageSize)
	.max(10_000)
	.catch(pageSize);

/**
 * What a personal ledger page shows for `userId`: a page of expenses, in folder `folderId` when given and narrowed by
 * the `category`, `q`, `bank` and `account` search params, and the totals of what it shows.
 */
export function personalPage(userId: string, url: URL, folderId?: string) {
	const custom = PersonalCategoryDTO.forUser(userId).map((entry) =>
		entry.toJSON(),
	);
	const wanted = url.searchParams.get("category");
	const category = categoryOptions(custom).some(
		(option) => option.value === wanted,
	)
		? (wanted ?? undefined)
		: undefined;
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
	const wantedBank = url.searchParams.get("bank");
	const bankId = accounts.some((account) => account.bankId === wantedBank)
		? (wantedBank ?? undefined)
		: undefined;
	const wantedAccount = url.searchParams.get("account");
	const accountUid = accounts.some((account) => account.uid === wantedAccount)
		? (wantedAccount ?? undefined)
		: undefined;
	const filter = { folderId, category, search, bankId, accountUid };
	const page = PersonalExpenseDTO.page(userId, {
		limit: limitSchema.parse(url.searchParams.get("limit") ?? pageSize),
		...filter,
	});
	const stats = PersonalExpenseDTO.stats(userId, filter);
	return {
		expenses: page.entries.map((entry) => entry.toJSON()),
		hasMore: page.total > page.entries.length,
		matching: page.total,
		pageSize,
		categories: custom,
		category: category ?? null,
		accounts,
		bank: bankId ?? null,
		account: accountUid ?? null,
		search: search ?? "",
		stats,
		folders: PersonalFolderDTO.forUser(userId).map((entry) => entry.toJSON()),
		defaultCurrency:
			stats.totals[0]?.currency ?? page.entries[0]?.toJSON().currency ?? "EUR",
	};
}
