import { and, asc, count, eq } from "drizzle-orm";

import type { CustomCategory } from "#lib/categories.js";
import { BaseDTO } from "#lib/dto/base-dto.js";
import { getDb } from "#lib/server/db/lib.js";
import {
	expense,
	groupCategory,
	merchant,
	recurringExpense,
} from "#lib/server/db/schema.js";

const columns = {
	id: groupCategory.id,
	name: groupCategory.name,
	icon: groupCategory.icon,
};

export class GroupCategoryDTO extends BaseDTO<CustomCategory> {
	/** The categories `groupId` added, oldest first. */
	static forGroup(groupId: string): GroupCategoryDTO[] {
		return getDb()
			.select(columns)
			.from(groupCategory)
			.where(eq(groupCategory.groupId, groupId))
			.orderBy(asc(groupCategory.createdAt))
			.all()
			.map((row) => new GroupCategoryDTO(row));
	}

	/** Category `id`, only when it belongs to `groupId`. */
	static findInGroup(
		groupId: string,
		id: string,
	): GroupCategoryDTO | undefined {
		const row = getDb()
			.select(columns)
			.from(groupCategory)
			.where(and(eq(groupCategory.groupId, groupId), eq(groupCategory.id, id)))
			.get();
		return row ? new GroupCategoryDTO(row) : undefined;
	}

	/** Adds a category to `groupId`. */
	static create(groupId: string, name: string, icon: string): GroupCategoryDTO {
		return new GroupCategoryDTO(
			getDb()
				.insert(groupCategory)
				.values({ groupId, name, icon })
				.returning(columns)
				.get(),
		);
	}

	/** How many expenses of `groupId` sit in each category, built-in or not. */
	static usage(groupId: string): Record<string, number> {
		return Object.fromEntries(
			getDb()
				.select({ category: expense.category, total: count() })
				.from(expense)
				.where(and(eq(expense.groupId, groupId), eq(expense.kind, "expense")))
				.groupBy(expense.category)
				.all()
				.map((row) => [row.category, row.total]),
		);
	}

	get id(): string {
		return this.row.id;
	}

	/** Renames the category and changes its icon. */
	update(name: string, icon: string): void {
		getDb()
			.update(groupCategory)
			.set({ name, icon })
			.where(eq(groupCategory.id, this.row.id))
			.run();
	}

	/** Deletes the category; its expenses, repeating expenses and merchants move to Other. One transaction. */
	delete(): void {
		getDb().transaction((transaction) => {
			for (const table of [expense, recurringExpense, merchant]) {
				transaction
					.update(table)
					.set({ category: "other" })
					.where(eq(table.category, this.row.id))
					.run();
			}
			transaction
				.delete(groupCategory)
				.where(eq(groupCategory.id, this.row.id))
				.run();
		});
	}
}
