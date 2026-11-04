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
	lte,
	ne,
	not,
	notInArray,
	or,
	type SQL,
	sql,
} from "drizzle-orm";

import { type CardRole, cardRoleOf } from "#lib/deferred-card.js";
import { AppearanceDTO } from "#lib/dto/appearance.js";
import { BankConnectionDTO } from "#lib/dto/bank-connection.js";
import { BaseDTO } from "#lib/dto/base-dto.js";
import {
	PersonalRuleDTO,
	type PersonalRuleRow,
} from "#lib/dto/personal-rule.js";
import { fuzzyMatches } from "#lib/fuzzy.js";
import { MonthCalendar, type MonthStarts } from "#lib/pay-month.js";
import { ruleMatches } from "#lib/personal-rules.js";
import type { RecurringLine } from "#lib/recurring-schedule.js";
import { databaseConnection } from "#lib/server/db/database.js";
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
	pay: boolean;
	cardRole: CardRole | null;
	tags: string[];
	recurringId: string | null;
	transferPairId: string | null;
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
	tags?: string[];
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
	from?: string;
	to?: string;
	kind?: PersonalKind;
	tag?: string;
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
	bankConnectionId: string | null;
	bankAccountUid: string | null;
}

export interface TransferLine {
	id: string;
	kind: PersonalKind;
	category: string;
	amountMinor: number;
	currency: string;
	spentOn: string;
	bankAccountUid: string;
	aside: boolean;
	transferPairId: string | null;
}

export const internalCategory = "internal";

export const reimbursableTag = "reimbursable";

export interface CardStatement {
	id: string;
	accountUid: string | null;
	spentOn: string;
	amountMinor: number;
	currency: string;
	purchaseIds: string[];
	purchasesMinor: number;
}

export interface PendingDeferred {
	accountUid: string | null;
	currency: string;
	since: string;
	count: number;
	minor: number;
}

export interface PersonalStats {
	totals: MoneyTotal[];
	thisMonth: MoneyTotal[];
	aside: MoneyTotal[];
	asideThisMonth: MoneyTotal[];
	finance: MoneyTotal[];
	financeThisMonth: MoneyTotal[];
	income: MoneyTotal[];
	incomeThisMonth: MoneyTotal[];
	byCategory: (MoneyTotal & { category: string })[];
	byCategoryThisMonth: (MoneyTotal & { category: string })[];
	byMonth: (MoneyTotal & { month: string })[];
}

function select() {
	return databaseConnection
		.get()
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
			pay: personalExpense.pay,
			cardRole: personalExpense.cardRole,
			tags: personalExpense.tags,
			recurringId: personalExpense.recurringId,
			transferPairId: personalExpense.transferPairId,
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

/** The ids of `userId`'s visible expenses whose description or note fuzzily matches `search`. */
function searchIds(userId: string, search: string): string[] {
	return databaseConnection
		.get()
		.select({
			id: personalExpense.id,
			description: personalExpense.description,
			note: personalExpense.note,
		})
		.from(personalExpense)
		.where(
			and(eq(personalExpense.userId, userId), isNull(personalExpense.hiddenAt)),
		)
		.all()
		.filter((row) =>
			fuzzyMatches(`${row.description} ${row.note ?? ""}`, search),
		)
		.map((row) => row.id);
}

function visible(
	userId: string,
	{
		folderId,
		category,
		search,
		bankId,
		accountUid,
		from,
		to,
		kind,
		tag,
	}: PersonalFilter = {},
) {
	return and(
		eq(personalExpense.userId, userId),
		isNull(personalExpense.hiddenAt),
		from ? gte(personalExpense.spentOn, from) : undefined,
		to ? lte(personalExpense.spentOn, to) : undefined,
		kind ? eq(personalExpense.kind, kind) : undefined,
		tag ? hasTag(tag) : undefined,
		folderId ? eq(personalExpense.folderId, folderId) : undefined,
		category ? eq(personalExpense.category, category) : undefined,
		bankId ? eq(personalExpense.bankConnectionId, bankId) : undefined,
		accountUid ? eq(personalExpense.bankAccountUid, accountUid) : undefined,
		search ? inArray(personalExpense.id, searchIds(userId, search)) : undefined,
	);
}

/** Lines carrying tag `tag`. */
function hasTag(tag: string): SQL {
	return sql`exists (select 1 from json_each(${personalExpense.tags}) where json_each.value = ${tag})`;
}

/** Leaves out deferred card statements: the purchases they settle already count, each on its own day. */
function notStatement(): SQL | undefined {
	return or(
		isNull(personalExpense.cardRole),
		ne(personalExpense.cardRole, "statement"),
	);
}

/** Leaves out money coming into a shared account: it's the other person's contribution, not income. */
function ownIncome(userId: string): SQL | undefined {
	const shared = BankConnectionDTO.sharedAccountUids(userId);
	return shared.length === 0
		? undefined
		: or(
				ne(personalExpense.kind, "income"),
				isNull(personalExpense.bankAccountUid),
				notInArray(personalExpense.bankAccountUid, shared),
			);
}

/** The part of a line that is `userId`'s: half of it on an account shared with someone. */
function mine(userId: string): SQL<number> {
	const shared = BankConnectionDTO.sharedAccountUids(userId);
	return shared.length === 0
		? sql<number>`${personalExpense.amountMinor}`
		: sql<number>`case when ${inArray(personalExpense.bankAccountUid, shared)} then ${personalExpense.amountMinor} / 2 else ${personalExpense.amountMinor} end`;
}

/** The ids of `userId`'s lines of `kind` (line `id`'s own when left out) whose description matches line `id`'s, its own included. */
function lookAlikeIds(
	userId: string,
	id: string,
	kind?: PersonalKind,
): string[] {
	const database = databaseConnection.get();
	const line = database
		.select({
			description: personalExpense.description,
			kind: personalExpense.kind,
		})
		.from(personalExpense)
		.where(
			and(
				eq(personalExpense.userId, userId),
				eq(personalExpense.id, id),
				kind ? eq(personalExpense.kind, kind) : undefined,
			),
		)
		.get();
	if (!line) {
		return [];
	}
	const key = similarKey(line.description);
	return database
		.select({
			id: personalExpense.id,
			description: personalExpense.description,
		})
		.from(personalExpense)
		.where(
			and(
				eq(personalExpense.userId, userId),
				eq(personalExpense.kind, line.kind),
			),
		)
		.all()
		.filter((row) => row.id === id || similarKey(row.description) === key)
		.map((row) => row.id);
}

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
				databaseConnection
					.get()
					.select({ total: count() })
					.from(personalExpense)
					.where(scope)
					.get()?.total ?? 0,
		};
	}

	/**
	 * Totals of `userId`'s expenses matching `filter`: spent in all and this month, by category in all and this month, by
	 * month, and what was set aside or came in, in all and this month, apart. Months follow `calendar`.
	 */
	static stats(
		userId: string,
		filter: PersonalFilter = {},
		{
			calendar = new MonthCalendar(),
			today = new Date().toISOString().slice(0, 10),
		}: { calendar?: MonthCalendar; today?: string } = {},
	): PersonalStats {
		const database = databaseConnection.get();
		const minor = sql<number>`sum(${mine(userId)})`.mapWith(Number);
		const matching = and(
			visible(userId, filter),
			ne(personalExpense.category, internalCategory),
			notStatement(),
			not(hasTag(reimbursableTag)),
			ownIncome(userId),
		);
		const spent = and(matching, eq(personalExpense.kind, "expense"));
		const scope = and(
			spent,
			eq(personalExpense.aside, false),
			ne(personalExpense.category, "finance"),
		);
		const setAside = and(spent, eq(personalExpense.aside, true));
		const finance = and(
			spent,
			eq(personalExpense.aside, false),
			eq(personalExpense.category, "finance"),
		);
		const earned = and(
			matching,
			eq(personalExpense.kind, "income"),
			eq(personalExpense.aside, false),
		);
		const monthStart = calendar.startOf(today);
		const thisMonth = and(
			gte(personalExpense.spentOn, monthStart),
			lt(personalExpense.spentOn, calendar.next(monthStart)),
		);
		const totalsOf = (where: SQL | undefined) =>
			database
				.select({ currency: personalExpense.currency, minor })
				.from(personalExpense)
				.where(where)
				.groupBy(personalExpense.currency)
				.orderBy(desc(minor))
				.all();
		const byCategoryOf = (where: SQL | undefined) =>
			database
				.select({
					category: personalExpense.category,
					currency: personalExpense.currency,
					minor,
				})
				.from(personalExpense)
				.where(where)
				.groupBy(personalExpense.category, personalExpense.currency)
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
			const month = calendar.startOf(row.day);
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
			finance: totalsOf(finance),
			financeThisMonth: totalsOf(and(finance, thisMonth)),
			totals: totalsOf(scope),
			thisMonth: totalsOf(and(scope, thisMonth)),
			byCategory: byCategoryOf(scope),
			byCategoryThisMonth: byCategoryOf(and(scope, thisMonth)),
			byMonth: [...byMonth.values()].toSorted(
				(left, right) =>
					right.month.localeCompare(left.month) || right.minor - left.minor,
			),
		};
	}

	/**
	 * Where `userId`'s months start: their chosen day, and when months follow their pay, the days it came in plus the day
	 * they expect the next one when that is still to come.
	 */
	static monthStarts(userId: string): MonthStarts {
		const setting = AppearanceDTO.monthSettingFor(userId);
		if (!setting.fromPay) {
			return { startDay: setting.startDay, paydays: [] };
		}
		const paydays = PersonalExpenseDTO.paydays(userId);
		const expected = AppearanceDTO.expectedPaydayFor(userId);
		return {
			startDay: setting.startDay,
			paydays:
				expected && paydays.length > 0 && expected > (paydays.at(-1) ?? "")
					? [...paydays, expected]
					: paydays,
		};
	}

	/** The days `userId`'s pay came in, oldest first. */
	static paydays(userId: string): string[] {
		return databaseConnection
			.get()
			.selectDistinct({ day: personalExpense.spentOn })
			.from(personalExpense)
			.where(
				and(
					visible(userId),
					eq(personalExpense.kind, "income"),
					eq(personalExpense.pay, true),
				),
			)
			.orderBy(personalExpense.spentOn)
			.all()
			.map((row) => row.day);
	}

	/** The calendar `userId`'s months follow. */
	static monthCalendar(userId: string): MonthCalendar {
		return new MonthCalendar(PersonalExpenseDTO.monthStarts(userId));
	}

	/**
	 * Marks `userId`'s income line `id` as their pay, or not, and every income line with the same description with it;
	 * returns how many lines changed.
	 */
	static markPay(userId: string, id: string, pay: boolean): number {
		const ids = lookAlikeIds(userId, id, "income");
		return ids.length === 0
			? 0
			: databaseConnection
					.get()
					.update(personalExpense)
					.set({ pay })
					.where(
						and(inArray(personalExpense.id, ids), ne(personalExpense.pay, pay)),
					)
					.returning({ id: personalExpense.id })
					.all().length;
	}

	/**
	 * Each of `userId`'s deferred card statements, latest first, with the purchases it settles: those on its account
	 * since the statement before it. Their sum can differ from the statement when the bank lists some elsewhere.
	 */
	static cardStatements(userId: string): CardStatement[] {
		const lines = databaseConnection
			.get()
			.select({
				id: personalExpense.id,
				cardRole: personalExpense.cardRole,
				amountMinor: personalExpense.amountMinor,
				currency: personalExpense.currency,
				spentOn: personalExpense.spentOn,
				accountUid: personalExpense.bankAccountUid,
			})
			.from(personalExpense)
			.where(and(visible(userId), isNotNull(personalExpense.cardRole)))
			.orderBy(personalExpense.spentOn)
			.all();
		const statements: CardStatement[] = [];
		for (const [accountUid, own] of Map.groupBy(
			lines,
			(line) => line.accountUid,
		)) {
			let from = "";
			for (const line of own.filter(
				(entry) => entry.cardRole === "statement",
			)) {
				const purchases = own.filter(
					(entry) =>
						entry.cardRole === "deferred" &&
						entry.spentOn > from &&
						entry.spentOn <= line.spentOn,
				);
				statements.push({
					id: line.id,
					accountUid,
					spentOn: line.spentOn,
					amountMinor: line.amountMinor,
					currency: line.currency,
					purchaseIds: purchases.map((entry) => entry.id),
					purchasesMinor: purchases.reduce(
						(total, entry) => total + entry.amountMinor,
						0,
					),
				});
				from = line.spentOn;
			}
		}
		return statements.toSorted((left, right) =>
			right.spentOn.localeCompare(left.spentOn),
		);
	}

	/**
	 * What `userId` bought with deferred cards since each card's last statement, per account and currency: already
	 * counted as spent, not yet taken from the account. An account that never had a statement has nothing pending.
	 */
	static pendingDeferred(userId: string): PendingDeferred[] {
		const lines = databaseConnection
			.get()
			.select({
				cardRole: personalExpense.cardRole,
				amountMinor: mine(userId).mapWith(Number),
				currency: personalExpense.currency,
				spentOn: personalExpense.spentOn,
				accountUid: personalExpense.bankAccountUid,
			})
			.from(personalExpense)
			.where(and(visible(userId), isNotNull(personalExpense.cardRole)))
			.all();
		return [...Map.groupBy(lines, (line) => line.accountUid)].flatMap(
			([accountUid, own]) => {
				const last = own
					.filter((line) => line.cardRole === "statement")
					.map((line) => line.spentOn)
					.toSorted()
					.at(-1);
				if (!last) {
					return [];
				}
				return [
					...Map.groupBy(
						own.filter(
							(line) => line.cardRole === "deferred" && line.spentOn > last,
						),
						(line) => line.currency,
					),
				].map(([currency, pending]) => ({
					accountUid,
					currency,
					since: last,
					count: pending.length,
					minor: pending.reduce((total, line) => total + line.amountMinor, 0),
				}));
			},
		);
	}

	/**
	 * Files `userId`'s line `id` and every line of the same kind and description in recurring series `seriesId`, or out
	 * of any series when null; returns how many lines it covers.
	 */
	static fileRecurring(
		userId: string,
		id: string,
		seriesId: string | null,
	): number {
		const ids = lookAlikeIds(userId, id);
		return ids.length === 0
			? 0
			: databaseConnection
					.get()
					.update(personalExpense)
					.set({ recurringId: seriesId })
					.where(inArray(personalExpense.id, ids))
					.returning({ id: personalExpense.id })
					.all().length;
	}

	/** Every visible line of `userId` filed in a recurring series, a shared account's at half. */
	static recurringLines(userId: string): RecurringLine[] {
		return databaseConnection
			.get()
			.select({
				seriesId: sql<string>`${personalExpense.recurringId}`,
				kind: personalExpense.kind,
				amountMinor: mine(userId).mapWith(Number),
				currency: personalExpense.currency,
				spentOn: personalExpense.spentOn,
				accountUid: personalExpense.bankAccountUid,
			})
			.from(personalExpense)
			.where(and(visible(userId), isNotNull(personalExpense.recurringId)))
			.all();
	}

	/** The oldest day each of `userId`'s bank links brought a line for, keyed by link id: how far back its history goes. */
	static historyFromBank(userId: string): Record<string, string> {
		return Object.fromEntries(
			databaseConnection
				.get()
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

	/**
	 * Every expense of `userId` but internal transfers, oldest first, reduced to what spending charts need, a shared
	 * account's lines at half.
	 */
	static spending(userId: string): SpendingRow[] {
		return databaseConnection
			.get()
			.select({
				description: personalExpense.description,
				category: personalExpense.category,
				kind: personalExpense.kind,
				aside: personalExpense.aside,
				amountMinor: mine(userId).mapWith(Number),
				currency: personalExpense.currency,
				spentOn: personalExpense.spentOn,
				folderId: personalExpense.folderId,
				bankConnectionId: personalExpense.bankConnectionId,
				bankAccountUid: personalExpense.bankAccountUid,
			})
			.from(personalExpense)
			.where(
				and(
					visible(userId),
					ne(personalExpense.category, internalCategory),
					notStatement(),
					not(hasTag(reimbursableTag)),
					ownIncome(userId),
				),
			)
			.orderBy(personalExpense.spentOn)
			.all();
	}

	/** For each description `userId` filed outside Other (keyed by `similarKey`), the category they used most. */
	static categoryHistory(userId: string): Map<string, string> {
		const counts = new Map<string, Map<string, number>>();
		for (const row of databaseConnection
			.get()
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
		const database = databaseConnection.get();
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
		const database = databaseConnection.get();
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
		return databaseConnection
			.get()
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

	/** Moves `userId`'s expenses `ids` into folder `folderId`, or out of every folder when null; returns how many moved. */
	static moveToFolder(
		userId: string,
		ids: string[],
		folderId: string | null,
	): number {
		if (ids.length === 0) {
			return 0;
		}
		return databaseConnection
			.get()
			.update(personalExpense)
			.set({ folderId })
			.where(
				and(
					eq(personalExpense.userId, userId),
					inArray(personalExpense.id, ids),
				),
			)
			.returning({ id: personalExpense.id })
			.all().length;
	}

	/** Sets or clears (an empty note) the note of each of `userId`'s expenses in `changes`; returns how many changed. */
	static setNotes(
		userId: string,
		changes: { id: string; note: string }[],
	): number {
		if (changes.length === 0) {
			return 0;
		}
		return databaseConnection.get().transaction((transaction) => {
			let changed = 0;
			for (const { id, note } of changes) {
				changed += transaction
					.update(personalExpense)
					.set({ note: note.trim() || null })
					.where(
						and(eq(personalExpense.userId, userId), eq(personalExpense.id, id)),
					)
					.returning({ id: personalExpense.id })
					.all().length;
			}
			return changed;
		});
	}

	/**
	 * Sets the tags of each of `userId`'s expenses in `changes`, lower case and without repeats; returns how many
	 * changed.
	 */
	static setTags(
		userId: string,
		changes: { id: string; tags: string[] }[],
	): number {
		return databaseConnection.get().transaction((transaction) => {
			let changed = 0;
			for (const { id, tags } of changes) {
				changed += transaction
					.update(personalExpense)
					.set({
						tags: [
							...new Set(tags.map((tag) => tag.trim().toLowerCase())),
						].filter(Boolean),
					})
					.where(
						and(eq(personalExpense.userId, userId), eq(personalExpense.id, id)),
					)
					.returning({ id: personalExpense.id })
					.all().length;
			}
			return changed;
		});
	}

	/** What `userId` paid and tagged reimbursable, per currency: money they expect back, left out of their totals. */
	static reimbursable(userId: string): MoneyTotal[] {
		return databaseConnection
			.get()
			.select({
				currency: personalExpense.currency,
				minor: sql<number>`sum(${mine(userId)})`.mapWith(Number),
			})
			.from(personalExpense)
			.where(
				and(
					visible(userId),
					eq(personalExpense.kind, "expense"),
					hasTag(reimbursableTag),
				),
			)
			.groupBy(personalExpense.currency)
			.all();
	}

	/**
	 * Applies `rules` (oldest first, so a newer one wins) to `userId`'s lines, or only to `ids` when given: each matching
	 * line takes the rule's category, tag, recurring series, and pay on income. Returns how many lines changed.
	 */
	static applyRules(
		userId: string,
		rules: PersonalRuleRow[],
		ids?: string[],
	): number {
		if (rules.length === 0 || ids?.length === 0) {
			return 0;
		}
		const lines = databaseConnection
			.get()
			.select({
				id: personalExpense.id,
				description: personalExpense.description,
				kind: personalExpense.kind,
				category: personalExpense.category,
				tags: personalExpense.tags,
				pay: personalExpense.pay,
				recurringId: personalExpense.recurringId,
			})
			.from(personalExpense)
			.where(
				and(
					visible(userId),
					ids ? inArray(personalExpense.id, ids) : undefined,
				),
			)
			.all();
		let changed = 0;
		databaseConnection.get().transaction((transaction) => {
			for (const line of lines) {
				const next = { ...line, tags: [...line.tags] };
				for (const rule of rules) {
					if (!ruleMatches(rule.pattern, line.description)) {
						continue;
					}
					next.category = rule.category ?? next.category;
					next.recurringId = rule.recurringId ?? next.recurringId;
					next.pay = (rule.pay && line.kind === "income") || next.pay;
					if (rule.tag && !next.tags.includes(rule.tag)) {
						next.tags.push(rule.tag);
					}
				}
				if (
					next.category === line.category &&
					next.recurringId === line.recurringId &&
					next.pay === line.pay &&
					next.tags.length === line.tags.length
				) {
					continue;
				}
				transaction
					.update(personalExpense)
					.set({
						category: next.category,
						recurringId: next.recurringId,
						pay: next.pay,
						tags: next.tags,
					})
					.where(eq(personalExpense.id, line.id))
					.run();
				changed += 1;
			}
		});
		return changed;
	}

	/** Records an expense `userId` typed in. */
	static create(userId: string, input: PersonalExpenseInput): string {
		return databaseConnection
			.get()
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
		const known = new Map<
			string,
			{ pay: boolean; recurringId: string | null }
		>();
		for (const row of databaseConnection
			.get()
			.select({
				description: personalExpense.description,
				kind: personalExpense.kind,
				pay: personalExpense.pay,
				recurringId: personalExpense.recurringId,
			})
			.from(personalExpense)
			.where(
				and(
					eq(personalExpense.userId, userId),
					or(
						and(
							eq(personalExpense.pay, true),
							eq(personalExpense.kind, "income"),
						),
						isNotNull(personalExpense.recurringId),
					),
				),
			)
			.orderBy(personalExpense.spentOn)
			.all()) {
			known.set(`${row.kind}:${similarKey(row.description)}`, {
				pay: row.pay,
				recurringId: row.recurringId,
			});
		}
		const added = databaseConnection
			.get()
			.insert(personalExpense)
			.values(
				expenses.map((entry) => {
					const match = known.get(
						`${entry.kind ?? "expense"}:${similarKey(entry.description)}`,
					);
					return {
						...entry,
						userId,
						bankConnectionId: connectionId,
						pay: match?.pay ?? false,
						recurringId: match?.recurringId ?? null,
						cardRole: cardRoleOf(entry.description),
					};
				}),
			)
			.onConflictDoNothing({
				target: [personalExpense.userId, personalExpense.bankRef],
			})
			.returning({ id: personalExpense.id })
			.all()
			.map((row) => row.id);
		PersonalExpenseDTO.applyRules(
			userId,
			PersonalRuleDTO.forUser(userId).map((rule) => rule.toJSON()),
			added,
		);
		return added.length;
	}

	/** `userId`'s visible bank lines, paired as a transfer or not, for matching transfers between their own accounts. */
	static transferLines(userId: string): TransferLine[] {
		return databaseConnection
			.get()
			.select({
				id: personalExpense.id,
				kind: personalExpense.kind,
				category: personalExpense.category,
				amountMinor: personalExpense.amountMinor,
				currency: personalExpense.currency,
				spentOn: personalExpense.spentOn,
				bankAccountUid: sql<string>`${personalExpense.bankAccountUid}`,
				aside: personalExpense.aside,
				transferPairId: personalExpense.transferPairId,
			})
			.from(personalExpense)
			.where(and(visible(userId), isNotNull(personalExpense.bankAccountUid)))
			.all();
	}

	/** Files lines `ids` of `userId` as `values` say, the transfer they belong to included. */
	static fileTransfer(
		userId: string,
		ids: string[],
		values: { category: string; aside: boolean; transferPairId?: string },
	): void {
		databaseConnection
			.get()
			.update(personalExpense)
			.set(values)
			.where(
				and(
					eq(personalExpense.userId, userId),
					inArray(personalExpense.id, ids),
				),
			)
			.run();
	}

	/**
	 * Gives `userId`'s bank lines still under Other the name and category a sync now reads for them, as banks or this
	 * app learn to say more; returns how many changed.
	 */
	static refreshUncategorized(userId: string, expenses: BankExpense[]): number {
		let changed = 0;
		databaseConnection.get().transaction((transaction) => {
			for (const entry of expenses) {
				changed += transaction
					.update(personalExpense)
					.set({ description: entry.description, category: entry.category })
					.where(
						and(
							eq(personalExpense.userId, userId),
							eq(personalExpense.bankRef, entry.bankRef),
							eq(personalExpense.category, "other"),
							or(
								ne(personalExpense.description, entry.description),
								ne(personalExpense.category, entry.category),
							),
						),
					)
					.returning({ id: personalExpense.id })
					.all().length;
			}
		});
		return changed;
	}

	/** Moves `userId`'s lines of bank account `fromUid` to `toUid`, its uid under a new consent, references included. */
	static moveBankAccount(userId: string, fromUid: string, toUid: string): void {
		databaseConnection
			.get()
			.update(personalExpense)
			.set({
				bankAccountUid: toUid,
				bankRef: sql`${toUid} || substr(${personalExpense.bankRef}, ${fromUid.length + 1})`,
			})
			.where(
				and(
					eq(personalExpense.userId, userId),
					eq(personalExpense.bankAccountUid, fromUid),
				),
			)
			.run();
	}

	get id(): string {
		return this.row.id;
	}

	/** Replaces the expense's fields. */
	update(input: PersonalExpenseInput): void {
		databaseConnection
			.get()
			.update(personalExpense)
			.set({ folderId: null, ...input })
			.where(eq(personalExpense.id, this.row.id))
			.run();
	}

	/** Moves the expense into folder `folderId`, or out of every folder when null. */
	moveTo(folderId: string | null): void {
		databaseConnection
			.get()
			.update(personalExpense)
			.set({ folderId })
			.where(eq(personalExpense.id, this.row.id))
			.run();
	}

	/** Remembers the group expense this one was split into. */
	markShared(expenseId: string): void {
		databaseConnection
			.get()
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
			databaseConnection
				.get()
				.update(personalExpense)
				.set({ hiddenAt: new Date() })
				.where(scope)
				.run();
		} else {
			databaseConnection.get().delete(personalExpense).where(scope).run();
		}
	}
}
