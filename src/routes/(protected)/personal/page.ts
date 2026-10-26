import { z } from "zod";

import { PersonalExpenseDTO } from "#lib/dto/personal-expense.js";
import { PersonalFolderDTO } from "#lib/dto/personal-folder.js";

const pageSize = 50;
const limitSchema = z.coerce
	.number()
	.int()
	.min(pageSize)
	.max(10_000)
	.catch(pageSize);

/** What a personal ledger page shows for `userId`: a page of expenses, in folder `folderId` when given, and its totals. */
export function personalPage(userId: string, url: URL, folderId?: string) {
	const page = PersonalExpenseDTO.page(userId, {
		limit: limitSchema.parse(url.searchParams.get("limit") ?? pageSize),
		folderId,
	});
	const stats = PersonalExpenseDTO.stats(userId, folderId);
	return {
		expenses: page.entries.map((entry) => entry.toJSON()),
		hasMore: page.total > page.entries.length,
		matching: page.total,
		pageSize,
		stats,
		folders: PersonalFolderDTO.forUser(userId).map((entry) => entry.toJSON()),
		defaultCurrency:
			stats.totals[0]?.currency ?? page.entries[0]?.toJSON().currency ?? "EUR",
	};
}
