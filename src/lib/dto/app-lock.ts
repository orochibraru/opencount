import { eq } from "drizzle-orm";

import { BaseDTO } from "#lib/dto/base-dto.js";
import { databaseConnection } from "#lib/server/db/database.js";
import { appLock } from "#lib/server/db/schema.js";

export interface AppLockRow {
	lockAfterMinutes: number;
}

export class AppLockDTO extends BaseDTO<AppLockRow> {
	readonly #passcodeHash: string;

	/** Wraps one app lock, keeping its passcode hash out of `toJSON()`. */
	constructor({ passcodeHash, ...row }: AppLockRow & { passcodeHash: string }) {
		super(row);
		this.#passcodeHash = passcodeHash;
	}

	/** `userId`'s app lock, or `undefined` when they have none. */
	static forUser(userId: string): AppLockDTO | undefined {
		const row = databaseConnection
			.get()
			.select({
				passcodeHash: appLock.passcodeHash,
				lockAfterMinutes: appLock.lockAfterMinutes,
			})
			.from(appLock)
			.where(eq(appLock.userId, userId))
			.get();
		return row ? new AppLockDTO(row) : undefined;
	}

	/** Stores `userId`'s passcode hash and delay, replacing any earlier one. */
	static save(
		userId: string,
		values: AppLockRow & { passcodeHash: string },
	): void {
		databaseConnection
			.get()
			.insert(appLock)
			.values({ userId, ...values })
			.onConflictDoUpdate({
				target: appLock.userId,
				set: { ...values, updatedAt: new Date() },
			})
			.run();
	}

	/** Changes how long `userId` can stay idle before the app locks. */
	static saveDelay(userId: string, lockAfterMinutes: number): void {
		databaseConnection
			.get()
			.update(appLock)
			.set({ lockAfterMinutes, updatedAt: new Date() })
			.where(eq(appLock.userId, userId))
			.run();
	}

	/** Removes `userId`'s app lock. */
	static remove(userId: string): void {
		databaseConnection
			.get()
			.delete(appLock)
			.where(eq(appLock.userId, userId))
			.run();
	}

	/** The stored passcode hash, which never leaves the server. */
	get passcodeHash(): string {
		return this.#passcodeHash;
	}

	/** Minutes of inactivity before the app locks. */
	get lockAfterMinutes(): number {
		return this.row.lockAfterMinutes;
	}
}
