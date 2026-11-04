import { and, asc, eq } from "drizzle-orm";

import type { AccountType } from "#lib/account-types.js";
import { BaseDTO } from "#lib/dto/base-dto.js";
import { databaseConnection } from "#lib/server/db/database.js";
import { manualAccount } from "#lib/server/db/schema.js";

export interface ManualAccountRow {
	id: string;
	name: string;
	type: AccountType;
	currency: string;
	shared: boolean;
	balanceMinor: number;
	balanceAt: string;
}

const columns = {
	id: manualAccount.id,
	name: manualAccount.name,
	type: manualAccount.type,
	currency: manualAccount.currency,
	shared: manualAccount.shared,
	balanceMinor: manualAccount.balanceMinor,
	balanceAt: manualAccount.balanceAt,
};

export class ManualAccountDTO extends BaseDTO<ManualAccountRow> {
	/** The accounts `userId` added by hand, oldest first. */
	static forUser(userId: string): ManualAccountDTO[] {
		return databaseConnection
			.get()
			.select(columns)
			.from(manualAccount)
			.where(eq(manualAccount.userId, userId))
			.orderBy(asc(manualAccount.createdAt))
			.all()
			.map((row) => new ManualAccountDTO(row));
	}

	/** Account `id` added by hand, only when it belongs to `userId`. */
	static findForUser(id: string, userId: string): ManualAccountDTO | undefined {
		const row = databaseConnection
			.get()
			.select(columns)
			.from(manualAccount)
			.where(and(eq(manualAccount.id, id), eq(manualAccount.userId, userId)))
			.get();
		return row ? new ManualAccountDTO(row) : undefined;
	}

	/** Adds an account to `userId` by hand. */
	static create(
		userId: string,
		input: Omit<ManualAccountRow, "id">,
	): ManualAccountDTO {
		return new ManualAccountDTO(
			databaseConnection
				.get()
				.insert(manualAccount)
				.values({ ...input, userId })
				.returning(columns)
				.get(),
		);
	}

	get id(): string {
		return this.row.id;
	}

	/** Changes the account's name, type, shared flag or balance. */
	update(values: Partial<Omit<ManualAccountRow, "id" | "currency">>): void {
		databaseConnection
			.get()
			.update(manualAccount)
			.set(values)
			.where(eq(manualAccount.id, this.row.id))
			.run();
		Object.assign(this.row, values);
	}

	/** Deletes the account. */
	delete(): void {
		databaseConnection
			.get()
			.delete(manualAccount)
			.where(eq(manualAccount.id, this.row.id))
			.run();
	}
}
