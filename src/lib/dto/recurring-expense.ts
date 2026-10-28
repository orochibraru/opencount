import { and, asc, eq, inArray, lte } from "drizzle-orm";

import { BaseDTO } from "#lib/dto/base-dto.js";
import type { ExpenseInput, ExpenseShareRow } from "#lib/dto/expense.js";
import { nextOccurrence } from "#lib/recurrence.js";
import { databaseConnection } from "#lib/server/db/database.js";
import {
	expense,
	expenseShare,
	type recurrenceFrequencies,
	recurringExpense,
	recurringShare,
} from "#lib/server/db/schema.js";

export interface RecurringExpenseRow {
	id: string;
	description: string;
	category: ExpenseInput["category"];
	merchantId: string | null;
	amountMinor: number;
	paidBy: string;
	splitMode: ExpenseInput["splitMode"];
	frequency: (typeof recurrenceFrequencies)[number];
	nextOn: string;
	anchorDay: number;
	active: boolean;
	shares: ExpenseShareRow[];
}

const columns = {
	id: recurringExpense.id,
	groupId: recurringExpense.groupId,
	description: recurringExpense.description,
	category: recurringExpense.category,
	merchantId: recurringExpense.merchantId,
	amountMinor: recurringExpense.amountMinor,
	paidBy: recurringExpense.paidBy,
	splitMode: recurringExpense.splitMode,
	frequency: recurringExpense.frequency,
	nextOn: recurringExpense.nextOn,
	anchorDay: recurringExpense.anchorDay,
	active: recurringExpense.active,
	createdBy: recurringExpense.createdBy,
};

type SelectedRow = Omit<RecurringExpenseRow, "shares"> & {
	groupId: string;
	createdBy: string | null;
};

function withShares(rows: SelectedRow[]): RecurringExpenseDTO[] {
	const shares = new Map<string, ExpenseShareRow[]>();
	if (rows.length > 0) {
		for (const share of databaseConnection
			.get()
			.select()
			.from(recurringShare)
			.where(
				inArray(
					recurringShare.recurringId,
					rows.map((row) => row.id),
				),
			)
			.all()) {
			const list = shares.get(share.recurringId) ?? [];
			list.push({
				memberId: share.memberId,
				amountMinor: share.amountMinor,
				weight: share.weight,
			});
			shares.set(share.recurringId, list);
		}
	}
	return rows.map(
		(row) => new RecurringExpenseDTO(row, shares.get(row.id) ?? []),
	);
}

export class RecurringExpenseDTO extends BaseDTO<RecurringExpenseRow> {
	readonly #groupId: string;
	readonly #createdBy: string | null;

	/** Wraps one rule and its shares. */
	constructor(
		{ groupId, createdBy, ...row }: SelectedRow,
		shares: ExpenseShareRow[],
	) {
		super({ ...row, shares });
		this.#groupId = groupId;
		this.#createdBy = createdBy;
	}

	/**
	 * Saves `input` as a rule repeating `frequency`, its first copy due on the occurrence after `input.spentOn`, which
	 * is the expense the rule was made from.
	 */
	static create(
		groupId: string,
		input: ExpenseInput,
		frequency: RecurringExpenseRow["frequency"],
		createdBy: string,
	): RecurringExpenseDTO {
		const anchorDay = Number(input.spentOn.slice(8, 10));
		return databaseConnection.get().transaction((transaction) => {
			const row = transaction
				.insert(recurringExpense)
				.values({
					groupId,
					description: input.description,
					category: input.category,
					merchantId: input.merchantId,
					amountMinor: input.amountMinor,
					paidBy: input.paidBy,
					splitMode: input.splitMode,
					frequency,
					nextOn: nextOccurrence(input.spentOn, frequency, anchorDay),
					anchorDay,
					createdBy,
				})
				.returning(columns)
				.get();
			transaction
				.insert(recurringShare)
				.values(
					input.shares.map((share) => ({ ...share, recurringId: row.id })),
				)
				.run();
			return new RecurringExpenseDTO(row, input.shares);
		});
	}

	/** The rules of `groupId`, next due first. */
	static forGroup(groupId: string): RecurringExpenseDTO[] {
		return withShares(
			databaseConnection
				.get()
				.select(columns)
				.from(recurringExpense)
				.where(eq(recurringExpense.groupId, groupId))
				.orderBy(asc(recurringExpense.nextOn))
				.all(),
		);
	}

	/** Rule `id`, only when it belongs to `groupId`. */
	static findInGroup(
		groupId: string,
		id: string,
	): RecurringExpenseDTO | undefined {
		return withShares(
			databaseConnection
				.get()
				.select(columns)
				.from(recurringExpense)
				.where(
					and(
						eq(recurringExpense.groupId, groupId),
						eq(recurringExpense.id, id),
					),
				)
				.all(),
		)[0];
	}

	/** The active rules with a copy due on or before `today`. */
	static due(today: string): RecurringExpenseDTO[] {
		return withShares(
			databaseConnection
				.get()
				.select(columns)
				.from(recurringExpense)
				.where(
					and(
						eq(recurringExpense.active, true),
						lte(recurringExpense.nextOn, today),
					),
				)
				.all(),
		);
	}

	get id(): string {
		return this.row.id;
	}

	/**
	 * Adds the copies due up to `today`, one transaction each, and returns how many it added. Each copy only lands if
	 * the rule still expects that date, so two runs at once can't add the same copy twice.
	 */
	materialize(today: string): number {
		let added = 0;
		while (this.row.active && this.row.nextOn <= today) {
			const spentOn = this.row.nextOn;
			const nextOn = nextOccurrence(
				spentOn,
				this.row.frequency,
				this.row.anchorDay,
			);
			const landed = databaseConnection.get().transaction((transaction) => {
				const advanced = transaction
					.update(recurringExpense)
					.set({ nextOn })
					.where(
						and(
							eq(recurringExpense.id, this.row.id),
							eq(recurringExpense.nextOn, spentOn),
						),
					)
					.returning({ id: recurringExpense.id })
					.get();
				if (!advanced) {
					return false;
				}
				const created = transaction
					.insert(expense)
					.values({
						groupId: this.#groupId,
						description: this.row.description,
						category: this.row.category,
						merchantId: this.row.merchantId,
						amountMinor: this.row.amountMinor,
						paidBy: this.row.paidBy,
						splitMode: this.row.splitMode,
						spentOn,
						recurringId: this.row.id,
						createdBy: this.#createdBy,
					})
					.returning({ id: expense.id })
					.get();
				transaction
					.insert(expenseShare)
					.values(
						this.row.shares.map((share) => ({
							...share,
							expenseId: created.id,
						})),
					)
					.run();
				return true;
			});
			if (!landed) {
				break;
			}
			this.row.nextOn = nextOn;
			added += 1;
		}
		return added;
	}

	/** Pauses the rule, or resumes it from `today` on, skipping the copies it would have added while paused. */
	setActive(active: boolean, today: string): void {
		let nextOn = this.row.nextOn;
		while (active && nextOn < today) {
			nextOn = nextOccurrence(nextOn, this.row.frequency, this.row.anchorDay);
		}
		databaseConnection
			.get()
			.update(recurringExpense)
			.set({ active, nextOn })
			.where(eq(recurringExpense.id, this.row.id))
			.run();
		this.row.active = active;
		this.row.nextOn = nextOn;
	}

	/** Deletes the rule; the copies it already added stay. */
	delete(): void {
		databaseConnection.get().transaction((transaction) => {
			transaction
				.update(expense)
				.set({ recurringId: null })
				.where(eq(expense.recurringId, this.row.id))
				.run();
			transaction
				.delete(recurringExpense)
				.where(eq(recurringExpense.id, this.row.id))
				.run();
		});
	}
}
