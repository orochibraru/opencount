import { and, desc, eq, isNull } from "drizzle-orm";

import { BaseDTO } from "#lib/dto/base-dto.js";
import { getDb } from "#lib/server/db/lib.js";
import {
	bankConnection,
	expense,
	group,
	personalExpense,
} from "#lib/server/db/schema.js";

export interface PersonalExpenseRow {
	id: string;
	description: string;
	category: string;
	amountMinor: number;
	currency: string;
	spentOn: string;
	bankName: string | null;
	fromBank: boolean;
	sharedGroupId: string | null;
	sharedGroupName: string | null;
}

export type PersonalExpenseInput = Pick<
	PersonalExpenseRow,
	"description" | "category" | "amountMinor" | "currency" | "spentOn"
>;

export interface BankExpense extends PersonalExpenseInput {
	bankRef: string;
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
			bankName: bankConnection.bankName,
			bankRef: personalExpense.bankRef,
			sharedGroupId: group.id,
			sharedGroupName: group.name,
			userId: personalExpense.userId,
		})
		.from(personalExpense)
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

export class PersonalExpenseDTO extends BaseDTO<PersonalExpenseRow> {
	/** `userId`'s own expenses, newest first. */
	static forUser(userId: string): PersonalExpenseDTO[] {
		return select()
			.where(
				and(
					eq(personalExpense.userId, userId),
					isNull(personalExpense.hiddenAt),
				),
			)
			.orderBy(desc(personalExpense.spentOn), desc(personalExpense.createdAt))
			.all()
			.map((row) => new PersonalExpenseDTO(toRow(row)));
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
			.set(input)
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
