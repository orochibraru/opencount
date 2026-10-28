import { and, asc, count, eq, isNull } from "drizzle-orm";

import type { CustomCategory } from "#lib/categories.js";
import { BaseDTO } from "#lib/dto/base-dto.js";
import { databaseConnection } from "#lib/server/db/database.js";
import { personalCategory, personalExpense } from "#lib/server/db/schema.js";

const columns = {
	id: personalCategory.id,
	name: personalCategory.name,
	icon: personalCategory.icon,
};

export class PersonalCategoryDTO extends BaseDTO<CustomCategory> {
	/** The categories `userId` added to their personal ledger, oldest first. */
	static forUser(userId: string): PersonalCategoryDTO[] {
		return databaseConnection
			.get()
			.select(columns)
			.from(personalCategory)
			.where(eq(personalCategory.userId, userId))
			.orderBy(asc(personalCategory.createdAt))
			.all()
			.map((row) => new PersonalCategoryDTO(row));
	}

	/** Category `id`, only when it belongs to `userId`. */
	static findForUser(
		id: string,
		userId: string,
	): PersonalCategoryDTO | undefined {
		const row = databaseConnection
			.get()
			.select(columns)
			.from(personalCategory)
			.where(
				and(eq(personalCategory.id, id), eq(personalCategory.userId, userId)),
			)
			.get();
		return row ? new PersonalCategoryDTO(row) : undefined;
	}

	/** Adds a category to `userId`'s personal ledger. */
	static create(
		userId: string,
		name: string,
		icon: string,
	): PersonalCategoryDTO {
		return new PersonalCategoryDTO(
			databaseConnection
				.get()
				.insert(personalCategory)
				.values({ userId, name, icon })
				.returning(columns)
				.get(),
		);
	}

	/** How many of `userId`'s personal expenses sit in each category, built-in or not. */
	static usage(userId: string): Record<string, number> {
		return Object.fromEntries(
			databaseConnection
				.get()
				.select({ category: personalExpense.category, total: count() })
				.from(personalExpense)
				.where(
					and(
						eq(personalExpense.userId, userId),
						isNull(personalExpense.hiddenAt),
					),
				)
				.groupBy(personalExpense.category)
				.all()
				.map((row) => [row.category, row.total]),
		);
	}

	get id(): string {
		return this.row.id;
	}

	/** Renames the category and changes its icon. */
	update(name: string, icon: string): void {
		databaseConnection
			.get()
			.update(personalCategory)
			.set({ name, icon })
			.where(eq(personalCategory.id, this.row.id))
			.run();
	}

	/** Deletes the category and moves its expenses to Other, in one transaction. */
	delete(): void {
		databaseConnection.get().transaction((transaction) => {
			transaction
				.update(personalExpense)
				.set({ category: "other" })
				.where(eq(personalExpense.category, this.row.id))
				.run();
			transaction
				.delete(personalCategory)
				.where(eq(personalCategory.id, this.row.id))
				.run();
		});
	}
}
