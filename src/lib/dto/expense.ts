import { and, count, desc, eq, inArray, ne, or, sql, sum } from "drizzle-orm";

import { BaseDTO } from "#lib/dto/base-dto.js";
import { getDb } from "#lib/server/db/lib.js";
import {
	expense,
	type expenseKinds,
	expenseShare,
	groupMember,
	merchant,
	type splitModes,
} from "#lib/server/db/schema.js";
import { similarKey } from "#lib/similar-key.js";

export interface ExpenseShareRow {
	memberId: string;
	amountMinor: number;
	weight: number;
}

export interface ExpenseRow {
	id: string;
	kind: (typeof expenseKinds)[number];
	description: string;
	category: string;
	amountMinor: number;
	originalCurrency: string | null;
	originalAmountMinor: number | null;
	exchangeRate: number | null;
	paidBy: string;
	splitMode: (typeof splitModes)[number];
	spentOn: string;
	merchantId: string | null;
	recurringId: string | null;
	shares: ExpenseShareRow[];
}

type OptionalFields =
	"recurringId" | "originalCurrency" | "originalAmountMinor" | "exchangeRate";

export type ExpenseInput = Omit<ExpenseRow, "id" | OptionalFields> &
	Partial<Pick<ExpenseRow, OptionalFields>>;

const sameCurrency = {
	originalCurrency: null,
	originalAmountMinor: null,
	exchangeRate: null,
};

function sharesFor(expenseIds: string[]): Map<string, ExpenseShareRow[]> {
	const byExpense = new Map<string, ExpenseShareRow[]>();
	if (expenseIds.length === 0) {
		return byExpense;
	}
	const rows = getDb()
		.select()
		.from(expenseShare)
		.where(inArray(expenseShare.expenseId, expenseIds))
		.all();
	for (const row of rows) {
		const list = byExpense.get(row.expenseId) ?? [];
		list.push({
			memberId: row.memberId,
			amountMinor: row.amountMinor,
			weight: row.weight,
		});
		byExpense.set(row.expenseId, list);
	}
	return byExpense;
}

const columns = {
	id: expense.id,
	kind: expense.kind,
	description: expense.description,
	category: expense.category,
	amountMinor: expense.amountMinor,
	originalCurrency: expense.originalCurrency,
	originalAmountMinor: expense.originalAmountMinor,
	exchangeRate: expense.exchangeRate,
	paidBy: expense.paidBy,
	splitMode: expense.splitMode,
	spentOn: expense.spentOn,
	merchantId: expense.merchantId,
	recurringId: expense.recurringId,
};

export interface ExpenseFilter {
	category?: string;
	search?: string;
}

function matching(groupId: string, { category, search }: ExpenseFilter) {
	const pattern = search
		? `%${search.toLowerCase().replaceAll(/[\\%_]/g, (character) => `\\${character}`)}%`
		: undefined;
	return and(
		eq(expense.groupId, groupId),
		category
			? and(eq(expense.category, category), eq(expense.kind, "expense"))
			: undefined,
		pattern
			? or(
					sql`lower(${expense.description}) like ${pattern} escape '\\'`,
					inArray(
						expense.merchantId,
						getDb()
							.select({ id: merchant.id })
							.from(merchant)
							.where(
								and(
									eq(merchant.groupId, groupId),
									sql`lower(${merchant.name}) like ${pattern} escape '\\'`,
								),
							),
					),
				)
			: undefined,
	);
}

export class ExpenseDTO extends BaseDTO<ExpenseRow> {
	/** Every expense and transfer of `groupId`, newest first, with its shares. */
	static forGroup(groupId: string): ExpenseDTO[] {
		const rows = getDb()
			.select(columns)
			.from(expense)
			.where(eq(expense.groupId, groupId))
			.orderBy(desc(expense.spentOn), desc(expense.createdAt))
			.all();
		const shares = sharesFor(rows.map((row) => row.id));
		return rows.map(
			(row) => new ExpenseDTO({ ...row, shares: shares.get(row.id) ?? [] }),
		);
	}

	/** Whether `groupId` already recorded the expense a device submitted as `clientId`, so a retry can be ignored. */
	static hasClientId(groupId: string, clientId: string): boolean {
		return (
			getDb()
				.select({ id: expense.id })
				.from(expense)
				.where(
					and(eq(expense.groupId, groupId), eq(expense.clientId, clientId)),
				)
				.get() !== undefined
		);
	}

	/**
	 * The latest `limit` expenses and transfers of `groupId`, newest first, only those filed under `category` and whose
	 * description or merchant contains `search` (whatever the case) when given, with how many match in all.
	 */
	static page(
		groupId: string,
		{ limit, ...filter }: { limit: number } & ExpenseFilter,
	): { entries: ExpenseDTO[]; total: number } {
		const scope = matching(groupId, filter);
		const database = getDb();
		const rows = database
			.select(columns)
			.from(expense)
			.where(scope)
			.orderBy(desc(expense.spentOn), desc(expense.createdAt))
			.limit(limit)
			.all();
		const shares = sharesFor(rows.map((row) => row.id));
		return {
			entries: rows.map(
				(row) => new ExpenseDTO({ ...row, shares: shares.get(row.id) ?? [] }),
			),
			total:
				database.select({ total: count() }).from(expense).where(scope).get()
					?.total ?? 0,
		};
	}

	/**
	 * Up to 50 other expenses of `groupId` that look like `source`, a description that spells the same (see
	 * `similarKey`) or the same merchant, filed under another category than `category`; newest first.
	 */
	static similarTo(
		groupId: string,
		source: { id: string; description: string; merchantId: string | null },
		category: string,
	): ExpenseDTO[] {
		const key = similarKey(source.description);
		return getDb()
			.select(columns)
			.from(expense)
			.where(
				and(
					eq(expense.groupId, groupId),
					eq(expense.kind, "expense"),
					ne(expense.id, source.id),
					ne(expense.category, category),
				),
			)
			.orderBy(desc(expense.spentOn))
			.all()
			.filter(
				(row) =>
					(key !== "" && similarKey(row.description) === key) ||
					(source.merchantId !== null && row.merchantId === source.merchantId),
			)
			.slice(0, 50)
			.map((row) => new ExpenseDTO({ ...row, shares: [] }));
	}

	/** The category each description of `groupId` is filed under most often, by `similarKey`, Other left out. */
	static categoryHistory(groupId: string): Map<string, string> {
		const counts = new Map<string, Map<string, number>>();
		for (const row of getDb()
			.select({ description: expense.description, category: expense.category })
			.from(expense)
			.where(
				and(
					eq(expense.groupId, groupId),
					eq(expense.kind, "expense"),
					ne(expense.category, "other"),
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

	/** Files the expenses `ids` of `groupId` under `category`; returns how many moved. */
	static recategorize(
		groupId: string,
		ids: string[],
		category: string,
	): number {
		if (ids.length === 0) {
			return 0;
		}
		return getDb()
			.update(expense)
			.set({ category })
			.where(
				and(
					eq(expense.groupId, groupId),
					eq(expense.kind, "expense"),
					inArray(expense.id, ids),
				),
			)
			.returning({ id: expense.id })
			.all().length;
	}

	/**
	 * What the expenses of `groupId` matching `filter` add up to: spent in all (transfers left out) and member
	 * `memberId`'s net among them, what they paid minus their shares.
	 */
	static summary(
		groupId: string,
		filter: ExpenseFilter,
		memberId: string | null,
	): { spentMinor: number; balanceMinor: number } {
		const database = getDb();
		const scope = matching(groupId, filter);
		const total = (value: unknown) => Number(value ?? 0);
		const spentMinor = total(
			database
				.select({ total: sum(expense.amountMinor) })
				.from(expense)
				.where(and(scope, eq(expense.kind, "expense")))
				.get()?.total,
		);
		if (!memberId) {
			return { spentMinor, balanceMinor: 0 };
		}
		const paid = total(
			database
				.select({ total: sum(expense.amountMinor) })
				.from(expense)
				.where(and(scope, eq(expense.paidBy, memberId)))
				.get()?.total,
		);
		const owed = total(
			database
				.select({ total: sum(expenseShare.amountMinor) })
				.from(expenseShare)
				.innerJoin(expense, eq(expense.id, expenseShare.expenseId))
				.where(and(scope, eq(expenseShare.memberId, memberId)))
				.get()?.total,
		);
		return { spentMinor, balanceMinor: paid - owed };
	}

	/** What `groupId` spent in all, transfers left out. */
	static spentTotal(groupId: string): number {
		return Number(
			getDb()
				.select({ total: sum(expense.amountMinor) })
				.from(expense)
				.where(and(eq(expense.groupId, groupId), eq(expense.kind, "expense")))
				.get()?.total ?? 0,
		);
	}

	/**
	 * Each of `memberIds`' balance in `groupId`, in minor units: what they paid minus their shares, summed by the
	 * database instead of loading every expense.
	 */
	static balances(groupId: string, memberIds: string[]): Map<string, number> {
		const database = getDb();
		const balances = new Map(memberIds.map((memberId) => [memberId, 0]));
		for (const row of database
			.select({
				memberId: expense.paidBy,
				total: sql<number>`sum(${expense.amountMinor})`.mapWith(Number),
			})
			.from(expense)
			.where(eq(expense.groupId, groupId))
			.groupBy(expense.paidBy)
			.all()) {
			balances.set(row.memberId, (balances.get(row.memberId) ?? 0) + row.total);
		}
		for (const row of database
			.select({
				memberId: expenseShare.memberId,
				total: sql<number>`sum(${expenseShare.amountMinor})`.mapWith(Number),
			})
			.from(expenseShare)
			.innerJoin(expense, eq(expense.id, expenseShare.expenseId))
			.where(eq(expense.groupId, groupId))
			.groupBy(expenseShare.memberId)
			.all()) {
			balances.set(row.memberId, (balances.get(row.memberId) ?? 0) - row.total);
		}
		return balances;
	}

	/** Expense `expenseId`, only when it belongs to `groupId`. */
	static findInGroup(
		groupId: string,
		expenseId: string,
	): ExpenseDTO | undefined {
		const row = getDb()
			.select(columns)
			.from(expense)
			.where(and(eq(expense.groupId, groupId), eq(expense.id, expenseId)))
			.get();
		return row
			? new ExpenseDTO({
					...row,
					shares: sharesFor([row.id]).get(row.id) ?? [],
				})
			: undefined;
	}

	/** Records an expense or a transfer with its shares, in one transaction. */
	static create(
		groupId: string,
		input: ExpenseInput,
		createdBy: string,
		clientId?: string,
	): ExpenseDTO {
		return getDb().transaction((transaction) => {
			const { shares, ...fields } = input;
			const row = transaction
				.insert(expense)
				.values({ ...fields, groupId, createdBy, clientId })
				.returning(columns)
				.get();
			transaction
				.insert(expenseShare)
				.values(shares.map((share) => ({ ...share, expenseId: row.id })))
				.run();
			return new ExpenseDTO({ ...row, shares });
		});
	}

	/**
	 * Records many expenses and transfers with their shares, all or none, as an import does. `newMembers` maps
	 * placeholder member ids used in `inputs` to the names of members to add first.
	 */
	static createMany(
		groupId: string,
		inputs: ExpenseInput[],
		createdBy: string,
		newMembers: Record<string, string> = {},
	): number {
		getDb().transaction((transaction) => {
			const ids = new Map<string, string>();
			for (const [placeholder, displayName] of Object.entries(newMembers)) {
				const member = transaction
					.insert(groupMember)
					.values({ groupId, displayName })
					.returning({ id: groupMember.id })
					.get();
				ids.set(placeholder, member.id);
			}
			const memberId = (id: string) => ids.get(id) ?? id;
			for (const { shares, ...fields } of inputs) {
				const row = transaction
					.insert(expense)
					.values({
						...fields,
						paidBy: memberId(fields.paidBy),
						groupId,
						createdBy,
					})
					.returning({ id: expense.id })
					.get();
				transaction
					.insert(expenseShare)
					.values(
						shares.map((share) => ({
							...share,
							memberId: memberId(share.memberId),
							expenseId: row.id,
						})),
					)
					.run();
			}
		});
		return inputs.length;
	}

	/**
	 * Files the group's expenses still under Other into the category `guess` finds for their description and merchant;
	 * returns how many moved.
	 */
	static categorizeUncategorized(
		groupId: string,
		guess: (
			description: string,
			merchantId: string | null,
		) => string | undefined,
	): number {
		const database = getDb();
		let moved = 0;
		database.transaction((transaction) => {
			for (const row of transaction
				.select({
					id: expense.id,
					description: expense.description,
					merchantId: expense.merchantId,
				})
				.from(expense)
				.where(
					and(
						eq(expense.groupId, groupId),
						eq(expense.kind, "expense"),
						eq(expense.category, "other"),
					),
				)
				.all()) {
				const category = guess(row.description, row.merchantId);
				if (category && category !== "other") {
					transaction
						.update(expense)
						.set({ category })
						.where(eq(expense.id, row.id))
						.run();
					moved += 1;
				}
			}
		});
		return moved;
	}

	get id(): string {
		return this.row.id;
	}

	/** Replaces the expense's fields and shares, in one transaction. */
	update(input: ExpenseInput): void {
		getDb().transaction((transaction) => {
			const { shares, ...fields } = input;
			transaction
				.update(expense)
				.set({ ...sameCurrency, ...fields })
				.where(eq(expense.id, this.row.id))
				.run();
			transaction
				.delete(expenseShare)
				.where(eq(expenseShare.expenseId, this.row.id))
				.run();
			transaction
				.insert(expenseShare)
				.values(shares.map((share) => ({ ...share, expenseId: this.row.id })))
				.run();
		});
	}

	/** Deletes the expense and its shares. */
	delete(): void {
		getDb().delete(expense).where(eq(expense.id, this.row.id)).run();
	}
}
