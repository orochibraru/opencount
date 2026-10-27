import {
	and,
	count,
	desc,
	eq,
	gte,
	inArray,
	isNotNull,
	isNull,
	lt,
	ne,
	type SQL,
	sql,
} from "drizzle-orm";

import { BaseDTO } from "#lib/dto/base-dto.js";
import { monthStartOn, shiftMonth } from "#lib/pay-month.js";
import { getDb } from "#lib/server/db/lib.js";
import {
	bankConnection,
	expense,
	group,
	personalExpense,
	personalFolder,
	type personalKinds,
} from "#lib/server/db/schema.js";
import { similarKey } from "#lib/similar-key.js";

export type PersonalKind = (typeof personalKinds)[number];

export interface PersonalExpenseRow {
	id: string;
	description: string;
	note: string | null;
	category: string;
	amountMinor: number;
	currency: string;
	spentOn: string;
	kind: PersonalKind;
	aside: boolean;
	folderId: string | null;
	folderName: string | null;
	bankName: string | null;
	bankConnectionId: string | null;
	bankAccountUid: string | null;
	fromBank: boolean;
	sharedGroupId: string | null;
	sharedGroupName: string | null;
}

export type PersonalExpenseInput = Pick<
	PersonalExpenseRow,
	"description" | "category" | "amountMinor" | "currency" | "spentOn"
> & {
	folderId?: string | null;
	aside?: boolean;
	kind?: PersonalKind;
	note?: string | null;
};

export interface BankExpense extends PersonalExpenseInput {
	bankRef: string;
	bankAccountUid: string;
}

export interface MoneyTotal {
	currency: string;
	minor: number;
}

export interface PersonalFilter {
	folderId?: string;
	category?: string;
	search?: string;
	bankId?: string;
	accountUid?: string;
}

export interface SpendingRow {
	description: string;
	category: string;
	kind: PersonalKind;
	aside: boolean;
	amountMinor: number;
	currency: string;
	spentOn: string;
	folderId: string | null;
}

export interface PersonalStats {
	totals: MoneyTotal[];
	thisMonth: MoneyTotal[];
	aside: MoneyTotal[];
	asideThisMonth: MoneyTotal[];
	income: MoneyTotal[];
	incomeThisMonth: MoneyTotal[];
	byCategory: (MoneyTotal & { category: string })[];
	byMonth: (MoneyTotal & { month: string })[];
}

function select() {
	return getDb()
		.select({
			id: personalExpense.id,
			description: personalExpense.description,
			note: personalExpense.note,
			category: personalExpense.category,
			amountMinor: personalExpense.amountMinor,
			currency: personalExpense.currency,
			spentOn: personalExpense.spentOn,
			kind: personalExpense.kind,
			aside: personalExpense.aside,
			folderId: personalExpense.folderId,
			folderName: personalFolder.name,
			bankName: bankConnection.bankName,
			bankConnectionId: personalExpense.bankConnectionId,
			bankAccountUid: personalExpense.bankAccountUid,
			bankRef: personalExpense.bankRef,
			sharedGroupId: group.id,
			sharedGroupName: group.name,
			userId: personalExpense.userId,
		})
		.from(personalExpense)
		.leftJoin(personalFolder, eq(personalFolder.id, personalExpense.folderId))
		.leftJoin(
			bankConnection,
			eq(bankConnection.id, personalExpense.bankConnectionId),
		)
		.leftJoin(expense, eq(expense.id, personalExpense.sharedExpenseId))
		.leftJoin(group, eq(group.id, expense.groupId));
}

type SelectedRow = ReturnType<ReturnType<typeof select>["all"]>[number];

function toRow({
	bankRef,
	userId: _userId,
	...row
}: SelectedRow): PersonalExpenseRow {
	return { ...row, fromBank: bankRef !== null };
}

function visible(
	userId: string,
	{ folderId, category, search, bankId, accountUid }: PersonalFilter = {},
) {
	const pattern = search
		? `%${search.toLowerCase().replaceAll(/[\\%_]/g, (character) => `\\${character}`)}%`
		: undefined;
	return and(
		eq(personalExpense.userId, userId),
		isNull(personalExpense.hiddenAt),
		folderId ? eq(personalExpense.folderId, folderId) : undefined,
		category ? eq(personalExpense.category, category) : undefined,
		bankId ? eq(personalExpense.bankConnectionId, bankId) : undefined,
		accountUid ? eq(personalExpense.bankAccountUid, accountUid) : undefined,
		pattern
			? sql`(lower(${personalExpense.description}) like ${pattern} escape '\\' or lower(coalesce(${personalExpense.note}, '')) like ${pattern} escape '\\')`
			: undefined,
	);
}

const minor = sql<number>`sum(${personalExpense.amountMinor})`.mapWith(Number);

export class PersonalExpenseDTO extends BaseDTO<PersonalExpenseRow> {
	/** The latest `limit` of `userId`'s own expenses matching `filter`, skipping the first `offset`, with how many match. */
	static page(
		userId: string,
		{
			limit,
			offset = 0,
			...filter
		}: { limit: number; offset?: number } & PersonalFilter,
	): { entries: PersonalExpenseDTO[]; total: number } {
		const scope = visible(userId, filter);
		return {
			entries: select()
				.where(scope)
				.orderBy(desc(personalExpense.spentOn), desc(personalExpense.createdAt))
				.limit(limit)
				.offset(offset)
				.all()
				.map((row) => new PersonalExpenseDTO(toRow(row))),
			total:
				getDb()
					.select({ total: count() })
					.from(personalExpense)
					.where(scope)
					.get()?.total ?? 0,
		};
	}

	/**
	 * Totals of `userId`'s expenses matching `filter`: spent in all, this month, by category and by month, and what was
	 * set aside or came in, in all and this month, apart. Months start on day `startDay`, payday to payday when not 1.
	 */
	static stats(
		userId: string,
		filter: PersonalFilter = {},
		{
			startDay = 1,
			today = new Date().toISOString().slice(0, 10),
		}: { startDay?: number; today?: string } = {},
	): PersonalStats {
		const database = getDb();
		const matching = visible(userId, filter);
		const spent = and(matching, eq(personalExpense.kind, "expense"));
		const scope = and(spent, eq(personalExpense.aside, false));
		const setAside = and(spent, eq(personalExpense.aside, true));
		const earned = and(
			matching,
			eq(personalExpense.kind, "income"),
			eq(personalExpense.aside, false),
		);
		const monthStart = monthStartOn(today, startDay);
		const thisMonth = and(
			gte(personalExpense.spentOn, monthStart),
			lt(personalExpense.spentOn, shiftMonth(monthStart, 1)),
		);
		const totalsOf = (where: SQL | undefined) =>
			database
				.select({ currency: personalExpense.currency, minor })
				.from(personalExpense)
				.where(where)
				.groupBy(personalExpense.currency)
				.orderBy(desc(minor))
				.all();
		const byMonth = new Map<string, MoneyTotal & { month: string }>();
		for (const row of database
			.select({
				day: personalExpense.spentOn,
				currency: personalExpense.currency,
				minor,
			})
			.from(personalExpense)
			.where(scope)
			.groupBy(personalExpense.spentOn, personalExpense.currency)
			.all()) {
			const month = monthStartOn(row.day, startDay);
			const key = `${month}:${row.currency}`;
			const entry = byMonth.get(key) ?? {
				month,
				currency: row.currency,
				minor: 0,
			};
			entry.minor += row.minor;
			byMonth.set(key, entry);
		}
		return {
			income: totalsOf(earned),
			incomeThisMonth: totalsOf(and(earned, thisMonth)),
			aside: totalsOf(setAside),
			asideThisMonth: totalsOf(and(setAside, thisMonth)),
			totals: totalsOf(scope),
			thisMonth: totalsOf(and(scope, thisMonth)),
			byCategory: database
				.select({
					category: personalExpense.category,
					currency: personalExpense.currency,
					minor,
				})
				.from(personalExpense)
				.where(scope)
				.groupBy(personalExpense.category, personalExpense.currency)
				.orderBy(desc(minor))
				.all(),
			byMonth: [...byMonth.values()].toSorted(
				(left, right) =>
					right.month.localeCompare(left.month) || right.minor - left.minor,
			),
		};
	}

	/** The oldest day each of `userId`'s bank links brought a line for, keyed by link id: how far back its history goes. */
	static historyFromBank(userId: string): Record<string, string> {
		return Object.fromEntries(
			getDb()
				.select({
					connectionId: personalExpense.bankConnectionId,
					oldest: sql<string>`min(${personalExpense.spentOn})`,
				})
				.from(personalExpense)
				.where(
					and(
						eq(personalExpense.userId, userId),
						isNotNull(personalExpense.bankConnectionId),
					),
				)
				.groupBy(personalExpense.bankConnectionId)
				.all()
				.map((row) => [row.connectionId ?? "", row.oldest]),
		);
	}

	/** Every expense of `userId`, oldest first, reduced to what spending charts need. */
	static spending(userId: string): SpendingRow[] {
		return getDb()
			.select({
				description: personalExpense.description,
				category: personalExpense.category,
				kind: personalExpense.kind,
				aside: personalExpense.aside,
				amountMinor: personalExpense.amountMinor,
				currency: personalExpense.currency,
				spentOn: personalExpense.spentOn,
				folderId: personalExpense.folderId,
			})
			.from(personalExpense)
			.where(visible(userId))
			.orderBy(personalExpense.spentOn)
			.all();
	}

	/** For each description `userId` filed outside Other (keyed by `similarKey`), the category they used most. */
	static categoryHistory(userId: string): Map<string, string> {
		const counts = new Map<string, Map<string, number>>();
		for (const row of getDb()
			.select({
				description: personalExpense.description,
				category: personalExpense.category,
			})
			.from(personalExpense)
			.where(
				and(
					eq(personalExpense.userId, userId),
					ne(personalExpense.category, "other"),
				),
			)
			.all()) {
			const key = similarKey(row.description);
			const perCategory = counts.get(key) ?? new Map<string, number>();
			perCategory.set(row.category, (perCategory.get(row.category) ?? 0) + 1);
			counts.set(key, perCategory);
		}
		return new Map(
			[...counts].map(([key, perCategory]) => [
				key,
				[...perCategory].toSorted(
					(left, right) => right[1] - left[1],
				)[0]?.[0] ?? "other",
			]),
		);
	}

	/** Files each of `userId`'s expenses under Other where `guess` finds a category; returns how many moved. */
	static categorizeUncategorized(
		userId: string,
		guess: (description: string) => string | undefined,
	): number {
		const database = getDb();
		let moved = 0;
		database.transaction((transaction) => {
			for (const row of transaction
				.select({
					id: personalExpense.id,
					description: personalExpense.description,
				})
				.from(personalExpense)
				.where(
					and(
						visible(userId),
						eq(personalExpense.kind, "expense"),
						eq(personalExpense.category, "other"),
					),
				)
				.all()) {
				const category = guess(row.description);
				if (category && category !== "other") {
					transaction
						.update(personalExpense)
						.set({ category })
						.where(eq(personalExpense.id, row.id))
						.run();
					moved += 1;
				}
			}
		});
		return moved;
	}

	/** Marks each of `userId`'s expenses that `isAside` recognises as money set aside, filing it under Finance if it was under Other; returns how many. */
	static markAside(
		userId: string,
		isAside: (description: string) => boolean,
	): number {
		const database = getDb();
		let marked = 0;
		database.transaction((transaction) => {
			for (const row of transaction
				.select({
					id: personalExpense.id,
					description: personalExpense.description,
					category: personalExpense.category,
				})
				.from(personalExpense)
				.where(and(visible(userId), eq(personalExpense.aside, false)))
				.all()) {
				if (isAside(row.description)) {
					transaction
						.update(personalExpense)
						.set({
							aside: true,
							category: row.category === "other" ? "finance" : row.category,
						})
						.where(eq(personalExpense.id, row.id))
						.run();
					marked += 1;
				}
			}
		});
		return marked;
	}

	/** Expense `id`, only when it belongs to `userId`. */
	static findForUser(
		id: string,
		userId: string,
	): PersonalExpenseDTO | undefined {
		const row = select()
			.where(
				and(eq(personalExpense.id, id), eq(personalExpense.userId, userId)),
			)
			.get();
		return row ? new PersonalExpenseDTO(toRow(row)) : undefined;
	}

	/**
	 * Up to 50 of `userId`'s other expenses whose description spells like `source`'s (see `similarKey`), filed under
	 * another category than `category`; newest first.
	 */
	static similarTo(
		userId: string,
		source: { id: string; description: string },
		category: string,
	): PersonalExpenseDTO[] {
		const key = similarKey(source.description);
		if (key === "") {
			return [];
		}
		return select()
			.where(
				and(
					visible(userId),
					ne(personalExpense.id, source.id),
					ne(personalExpense.category, category),
				),
			)
			.orderBy(desc(personalExpense.spentOn))
			.all()
			.filter((row) => similarKey(row.description) === key)
			.slice(0, 50)
			.map((row) => new PersonalExpenseDTO(toRow(row)));
	}

	/** Files `userId`'s expenses `ids` under `category`; returns how many moved. */
	static recategorize(userId: string, ids: string[], category: string): number {
		if (ids.length === 0) {
			return 0;
		}
		return getDb()
			.update(personalExpense)
			.set({ category })
			.where(
				and(
					eq(personalExpense.userId, userId),
					inArray(personalExpense.id, ids),
				),
			)
			.returning({ id: personalExpense.id })
			.all().length;
	}

	/** Records an expense `userId` typed in. */
	static create(userId: string, input: PersonalExpenseInput): string {
		return getDb()
			.insert(personalExpense)
			.values({ ...input, userId })
			.returning({ id: personalExpense.id })
			.get().id;
	}

	/** Records what a bank sync found for `userId`, skipping transactions already there; returns how many are new. */
	static importFromBank(
		userId: string,
		connectionId: string,
		expenses: BankExpense[],
	): number {
		if (expenses.length === 0) {
			return 0;
		}
		return getDb()
			.insert(personalExpense)
			.values(
				expenses.map((entry) => ({
					...entry,
					userId,
					bankConnectionId: connectionId,
				})),
			)
			.onConflictDoNothing({
				target: [personalExpense.userId, personalExpense.bankRef],
			})
			.returning({ id: personalExpense.id })
			.all().length;
	}

	get id(): string {
		return this.row.id;
	}

	/** Replaces the expense's fields. */
	update(input: PersonalExpenseInput): void {
		getDb()
			.update(personalExpense)
			.set({ folderId: null, ...input })
			.where(eq(personalExpense.id, this.row.id))
			.run();
	}

	/** Moves the expense into folder `folderId`, or out of every folder when null. */
	moveTo(folderId: string | null): void {
		getDb()
			.update(personalExpense)
			.set({ folderId })
			.where(eq(personalExpense.id, this.row.id))
			.run();
	}

	/** Remembers the group expense this one was split into. */
	markShared(expenseId: string): void {
		getDb()
			.update(personalExpense)
			.set({ sharedExpenseId: expenseId })
			.where(eq(personalExpense.id, this.row.id))
			.run();
	}

	/**
	 * Deletes the expense, or hides it when it came from the bank so the next sync doesn't bring it back; a group
	 * expense made from it stays.
	 */
	delete(): void {
		const scope = eq(personalExpense.id, this.row.id);
		if (this.row.fromBank) {
			getDb()
				.update(personalExpense)
				.set({ hiddenAt: new Date() })
				.where(scope)
				.run();
		} else {
			getDb().delete(personalExpense).where(scope).run();
		}
	}
}
