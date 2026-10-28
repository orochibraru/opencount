import { and, asc, eq, gt } from "drizzle-orm";

import { BaseDTO } from "#lib/dto/base-dto.js";
import { databaseConnection } from "#lib/server/db/database.js";
import { bankConnection, type BankSyncReport } from "#lib/server/db/schema.js";

type ConnectionRow = typeof bankConnection.$inferSelect;

export type BankConnectionRow = Omit<ConnectionRow, "sessionId" | "userId">;

export class BankConnectionDTO extends BaseDTO<BankConnectionRow> {
	#sessionId: string;
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
			databaseConnection
				.get()
				.insert(bankConnection)
				.values({
					userId,
					sessionId: link.sessionId,
					bankName: link.bankName,
					bankCountry: link.bankCountry,
					accounts: link.accounts,
					validUntil: link.validUntil,
				})
				.returning()
				.get(),
		);
	}

	/** `userId`'s linked banks, oldest first. */
	static forUser(userId: string): BankConnectionDTO[] {
		return databaseConnection
			.get()
			.select()
			.from(bankConnection)
			.where(eq(bankConnection.userId, userId))
			.orderBy(asc(bankConnection.createdAt))
			.all()
			.map((row) => new BankConnectionDTO(row));
	}

	/** Linked bank `id`, whoever it belongs to: for the worker. */
	static find(id: string): BankConnectionDTO | undefined {
		const row = databaseConnection
			.get()
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
		const row = databaseConnection
			.get()
			.select()
			.from(bankConnection)
			.where(and(eq(bankConnection.id, id), eq(bankConnection.userId, userId)))
			.get();
		return row ? new BankConnectionDTO(row) : undefined;
	}

	/** The ids of every link whose consent hasn't run out. */
	static activeIds(now = new Date()): string[] {
		return databaseConnection
			.get()
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

	/**
	 * The first day to fetch: a few days before the last sync to catch late bookings, or none the first time, so the
	 * bank hands over as much history as it keeps.
	 */
	fetchFrom(): string | undefined {
		return this.row.syncedAt
			? new Date(this.row.syncedAt.getTime() - 3 * 24 * 60 * 60 * 1000)
					.toISOString()
					.slice(0, 10)
			: undefined;
	}

	/** Whether a sync was asked for or is running, less than 15 minutes ago, so a worker that died doesn't spin forever. */
	syncing(now = new Date()): boolean {
		return (
			this.row.syncState !== "idle" &&
			this.row.syncStateAt !== null &&
			now.getTime() - this.row.syncStateAt.getTime() < 15 * 60 * 1000
		);
	}

	/** Records that a sync is waiting for the worker. */
	markQueued(at = new Date()): void {
		this.#update({ syncState: "queued", syncStateAt: at });
	}

	/** Records that the worker started syncing. */
	markRunning(at = new Date()): void {
		this.#update({ syncState: "running", syncStateAt: at });
	}

	/** Records a sync that worked: `added` new lines, and what each account returned in `report`. */
	markSynced(
		added: number,
		report: BankSyncReport[] = [],
		at = new Date(),
	): void {
		this.#update({
			syncedAt: at,
			lastError: null,
			lastAdded: added,
			lastReport: report,
			syncState: "idle",
			syncStateAt: at,
		});
	}

	/** Records why the last sync failed. */
	markFailed(message: string, at = new Date()): void {
		this.#update({ lastError: message, syncState: "idle", syncStateAt: at });
	}

	/** Moves the link onto a new consent, whose first sync fetches all the history the bank keeps. */
	replaceSession(
		link: Pick<ConnectionRow, "sessionId" | "accounts" | "validUntil">,
	): void {
		const values = {
			accounts: link.accounts,
			validUntil: link.validUntil,
			syncedAt: null,
			lastError: null,
			lastReport: [],
		};
		databaseConnection
			.get()
			.update(bankConnection)
			.set({ ...values, sessionId: link.sessionId })
			.where(eq(bankConnection.id, this.row.id))
			.run();
		Object.assign(this.row, values);
		this.#sessionId = link.sessionId;
	}

	/** Remembers the bank's logo, an https address. */
	setLogo(logo: string): void {
		this.#update({ bankLogo: logo });
	}

	/** Writes `values` to the link and to this copy of it. */
	#update(values: Partial<BankConnectionRow>): void {
		databaseConnection
			.get()
			.update(bankConnection)
			.set(values)
			.where(eq(bankConnection.id, this.row.id))
			.run();
		Object.assign(this.row, values);
	}

	/** Forgets the link; the expenses it brought stay. */
	delete(): void {
		databaseConnection
			.get()
			.delete(bankConnection)
			.where(eq(bankConnection.id, this.row.id))
			.run();
	}
}
