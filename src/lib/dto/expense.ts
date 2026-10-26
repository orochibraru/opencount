import { and, desc, eq, inArray } from "drizzle-orm";

import type { LedgerEntry } from "#lib/balances.js";
import { BaseDTO } from "#lib/dto/base-dto.js";
import { getDb } from "#lib/server/db/lib.js";
import {
	expense,
	type expenseKinds,
	expenseShare,
	type splitModes,
} from "#lib/server/db/schema.js";

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
	paidBy: string;
	splitMode: (typeof splitModes)[number];
	spentOn: string;
	merchantId: string | null;
	recurringId: string | null;
	shares: ExpenseShareRow[];
}

export type ExpenseInput = Omit<ExpenseRow, "id" | "recurringId"> & {
	recurringId?: string | null;
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
	paidBy: expense.paidBy,
	splitMode: expense.splitMode,
	spentOn: expense.spentOn,
	merchantId: expense.merchantId,
	recurringId: expense.recurringId,
};

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
	): ExpenseDTO {
		return getDb().transaction((transaction) => {
			const { shares, ...fields } = input;
			const row = transaction
				.insert(expense)
				.values({ ...fields, groupId, createdBy })
				.returning(columns)
				.get();
			transaction
				.insert(expenseShare)
				.values(shares.map((share) => ({ ...share, expenseId: row.id })))
				.run();
			return new ExpenseDTO({ ...row, shares });
		});
	}

	/** The group's ledger, for balances. */
	static ledger(groupId: string): LedgerEntry[] {
		return ExpenseDTO.forGroup(groupId).map((entry) => entry.toLedgerEntry());
	}

	get id(): string {
		return this.row.id;
	}

	/** The expense as a ledger entry. */
	toLedgerEntry(): LedgerEntry {
		return {
			paidBy: this.row.paidBy,
			amountMinor: this.row.amountMinor,
			shares: this.row.shares.map((share) => ({
				memberId: share.memberId,
				amountMinor: share.amountMinor,
			})),
		};
	}

	/** Replaces the expense's fields and shares, in one transaction. */
	update(input: ExpenseInput): void {
		getDb().transaction((transaction) => {
			const { shares, ...fields } = input;
			transaction
				.update(expense)
				.set(fields)
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
