import { and, asc, eq, gt } from "drizzle-orm";

import { BaseDTO } from "#lib/dto/base-dto.js";
import { getDb } from "#lib/server/db/lib.js";
import { bankConnection } from "#lib/server/db/schema.js";

type ConnectionRow = typeof bankConnection.$inferSelect;

export type BankConnectionRow = Omit<ConnectionRow, "sessionId" | "userId">;

export class BankConnectionDTO extends BaseDTO<BankConnectionRow> {
	readonly #sessionId: string;
	readonly #userId: string;

	/** Wraps one link, keeping its session id and owner out of `toJSON()`. */
	constructor({ sessionId, userId, ...row }: ConnectionRow) {
		super(row);
		this.#sessionId = sessionId;
		this.#userId = userId;
	}

	/** Records a linked bank for `userId`. */
	static create(
		userId: string,
		link: Pick<
			ConnectionRow,
			"sessionId" | "bankName" | "bankCountry" | "accounts" | "validUntil"
		>,
	): BankConnectionDTO {
		return new BankConnectionDTO(
			getDb()
				.insert(bankConnection)
				.values({ ...link, userId })
				.returning()
				.get(),
		);
	}

	/** `userId`'s linked banks, oldest first. */
	static forUser(userId: string): BankConnectionDTO[] {
		return getDb()
			.select()
			.from(bankConnection)
			.where(eq(bankConnection.userId, userId))
			.orderBy(asc(bankConnection.createdAt))
			.all()
			.map((row) => new BankConnectionDTO(row));
	}

	/** Linked bank `id`, whoever it belongs to: for the worker. */
	static find(id: string): BankConnectionDTO | undefined {
		const row = getDb()
			.select()
			.from(bankConnection)
			.where(eq(bankConnection.id, id))
			.get();
		return row ? new BankConnectionDTO(row) : undefined;
	}

	/** Linked bank `id`, only when it belongs to `userId`. */
	static findForUser(
		id: string,
		userId: string,
	): BankConnectionDTO | undefined {
		const row = getDb()
			.select()
			.from(bankConnection)
			.where(and(eq(bankConnection.id, id), eq(bankConnection.userId, userId)))
			.get();
		return row ? new BankConnectionDTO(row) : undefined;
	}

	/** The ids of every link whose consent hasn't run out. */
	static activeIds(now = new Date()): string[] {
		return getDb()
			.select({ id: bankConnection.id })
			.from(bankConnection)
			.where(gt(bankConnection.validUntil, now))
			.all()
			.map((row) => row.id);
	}

	get id(): string {
		return this.row.id;
	}

	get userId(): string {
		return this.#userId;
	}

	get sessionId(): string {
		return this.#sessionId;
	}

	get accounts(): ConnectionRow["accounts"] {
		return this.row.accounts;
	}

	get bankName(): string {
		return this.row.bankName;
	}

	/** Whether the consent at the bank ran out. */
	expired(now = new Date()): boolean {
		return this.row.validUntil.getTime() <= now.getTime();
	}

	/** The first day to fetch: a few days before the last sync to catch late bookings, or 90 days back the first time. */
	fetchFrom(now = new Date()): string {
		const from = this.row.syncedAt
			? new Date(this.row.syncedAt.getTime() - 3 * 24 * 60 * 60 * 1000)
			: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
		return from.toISOString().slice(0, 10);
	}

	/** Records a sync that worked. */
	markSynced(at = new Date()): void {
		getDb()
			.update(bankConnection)
			.set({ syncedAt: at, lastError: null })
			.where(eq(bankConnection.id, this.row.id))
			.run();
	}

	/** Records why the last sync failed. */
	markFailed(message: string): void {
		getDb()
			.update(bankConnection)
			.set({ lastError: message })
			.where(eq(bankConnection.id, this.row.id))
			.run();
	}

	/** Forgets the link; the expenses it brought stay. */
	delete(): void {
		getDb()
			.delete(bankConnection)
			.where(eq(bankConnection.id, this.row.id))
			.run();
	}
}
