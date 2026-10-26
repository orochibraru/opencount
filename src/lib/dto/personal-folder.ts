import { and, asc, count, eq, isNull } from "drizzle-orm";

import { BaseDTO } from "#lib/dto/base-dto.js";
import { getDb } from "#lib/server/db/lib.js";
import { personalExpense, personalFolder } from "#lib/server/db/schema.js";

export interface PersonalFolderRow {
	id: string;
	name: string;
	expenseCount: number;
}

export class PersonalFolderDTO extends BaseDTO<PersonalFolderRow> {
	/** `userId`'s folders, oldest first, with how many expenses each holds. */
	static forUser(userId: string): PersonalFolderDTO[] {
		return getDb()
			.select({
				id: personalFolder.id,
				name: personalFolder.name,
				expenseCount: count(personalExpense.id),
			})
			.from(personalFolder)
			.leftJoin(
				personalExpense,
				and(
					eq(personalExpense.folderId, personalFolder.id),
					isNull(personalExpense.hiddenAt),
				),
			)
			.where(eq(personalFolder.userId, userId))
			.groupBy(personalFolder.id)
			.orderBy(asc(personalFolder.createdAt))
			.all()
			.map((row) => new PersonalFolderDTO(row));
	}

	/** Folder `id`, only when it belongs to `userId`. */
	static findForUser(
		id: string,
		userId: string,
	): PersonalFolderDTO | undefined {
		return PersonalFolderDTO.forUser(userId).find((folder) => folder.id === id);
	}

	/** Makes a folder called `name` for `userId` and returns its id. */
	static create(userId: string, name: string): string {
		return getDb()
			.insert(personalFolder)
			.values({ userId, name })
			.returning({ id: personalFolder.id })
			.get().id;
	}

	get id(): string {
		return this.row.id;
	}

	/** Renames the folder. */
	rename(name: string): void {
		getDb()
			.update(personalFolder)
			.set({ name })
			.where(eq(personalFolder.id, this.row.id))
			.run();
	}

	/** Deletes the folder; its expenses stay, out of any folder, in one transaction. */
	delete(): void {
		getDb().transaction((transaction) => {
			transaction
				.update(personalExpense)
				.set({ folderId: null })
				.where(eq(personalExpense.folderId, this.row.id))
				.run();
			transaction
				.delete(personalFolder)
				.where(eq(personalFolder.id, this.row.id))
				.run();
		});
	}
}
