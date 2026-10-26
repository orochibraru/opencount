import { and, count, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";

import { BaseDTO } from "#lib/dto/base-dto.js";
import { getDb } from "#lib/server/db/lib.js";
import {
	bankConnection,
	expense,
	group,
	personalExpense,
	personalFolder,
} from "#lib/server/db/schema.js";
import { similarKey } from "#lib/similar-key.js";

export interface PersonalExpenseRow {
	id: string;
	description: string;
	category: string;
	amountMinor: number;
	currency: string;
	spentOn: string;
	folderId: string | null;
	folderName: string | null;
	bankName: string | null;
	fromBank: boolean;
	sharedGroupId: string | null;
	sharedGroupName: string | null;
}

export type PersonalExpenseInput = Pick<
	PersonalExpenseRow,
	"description" | "category" | "amountMinor" | "currency" | "spentOn"
> & { folderId?: string | null };

export interface BankExpense extends PersonalExpenseInput {
	bankRef: string;
}

export interface MoneyTotal {
	currency: string;
	minor: number;
}

export interface PersonalStats {
	totals: MoneyTotal[];
	thisMonth: MoneyTotal[];
	byCategory: (MoneyTotal & { category: string })[];
	byMonth: (MoneyTotal & { month: string })[];
}

function select() {
	return getDb()
		.select({
			id: personalExpense.id,
			description: personalExpense.description,
			category: personalExpense.category,
			amountMinor: personalExpense.amountMinor,
			currency: personalExpense.currency,
			spentOn: personalExpense.spentOn,
			folderId: personalExpense.folderId,
			folderName: personalFolder.name,
			bankName: bankConnection.bankName,
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

function visible(userId: string, folderId?: string) {
	return and(
		eq(personalExpense.userId, userId),
		isNull(personalExpense.hiddenAt),
		folderId ? eq(personalExpense.folderId, folderId) : undefined,
	);
}

const minor = sql<number>`sum(${personalExpense.amountMinor})`.mapWith(Number);

export class PersonalExpenseDTO extends BaseDTO<PersonalExpenseRow> {
	/** The latest `limit` of `userId`'s own expenses, in folder `folderId` when given, with how many there are. */
	static page(
		userId: string,
		{ limit, folderId }: { limit: number; folderId?: string },
	): { entries: PersonalExpenseDTO[]; total: number } {
		const scope = visible(userId, folderId);
		return {
			entries: select()
				.where(scope)
				.orderBy(desc(personalExpense.spentOn), desc(personalExpense.createdAt))
				.limit(limit)
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

	/** Totals of `userId`'s expenses, in folder `folderId` when given: in all, this month, by category and by month. */
	static stats(
		userId: string,
		folderId?: string,
		month = new Date().toISOString().slice(0, 7),
	): PersonalStats {
		const database = getDb();
		const scope = visible(userId, folderId);
		const monthOf = sql<string>`substr(${personalExpense.spentOn}, 1, 7)`;
		return {
			totals: database
				.select({ currency: personalExpense.currency, minor })
				.from(personalExpense)
				.where(scope)
				.groupBy(personalExpense.currency)
				.orderBy(desc(minor))
				.all(),
			thisMonth: database
				.select({ currency: personalExpense.currency, minor })
				.from(personalExpense)
				.where(and(scope, sql`${monthOf} = ${month}`))
				.groupBy(personalExpense.currency)
				.orderBy(desc(minor))
				.all(),
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
			byMonth: database
				.select({ month: monthOf, currency: personalExpense.currency, minor })
				.from(personalExpense)
				.where(scope)
				.groupBy(monthOf, personalExpense.currency)
				.orderBy(desc(monthOf))
				.all(),
		};
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
