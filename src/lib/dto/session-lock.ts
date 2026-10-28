import { and, eq, ne, sql } from "drizzle-orm";

import { BaseDTO } from "#lib/dto/base-dto.js";
import { databaseConnection } from "#lib/server/db/database.js";
import { session, sessionLock } from "#lib/server/db/schema.js";

export interface SessionLockRow {
	lastActiveAt: Date;
	locked: boolean;
	failedAttempts: number;
}

export class SessionLockDTO extends BaseDTO<SessionLockRow> {
	/** The lock state of `sessionId`, or `undefined` when it was never tracked. */
	static forSession(sessionId: string): SessionLockDTO | undefined {
		const row = databaseConnection
			.get()
			.select({
				lastActiveAt: sessionLock.lastActiveAt,
				locked: sessionLock.locked,
				failedAttempts: sessionLock.failedAttempts,
			})
			.from(sessionLock)
			.where(eq(sessionLock.sessionId, sessionId))
			.get();
		return row ? new SessionLockDTO(row) : undefined;
	}

	/** Records activity on `sessionId` at `at`, creating its row if needed. */
	static touch(sessionId: string, at: Date): void {
		databaseConnection
			.get()
			.insert(sessionLock)
			.values({ sessionId, lastActiveAt: at })
			.onConflictDoUpdate({
				target: sessionLock.sessionId,
				set: { lastActiveAt: at },
			})
			.run();
	}

	/** Locks `sessionId` until its passcode is entered. */
	static lock(sessionId: string): void {
		databaseConnection
			.get()
			.insert(sessionLock)
			.values({ sessionId, lastActiveAt: new Date(), locked: true })
			.onConflictDoUpdate({
				target: sessionLock.sessionId,
				set: { locked: true },
			})
			.run();
	}

	/** Locks every session of `userId` but `keepId`, so a new passcode is asked on their other devices. */
	static lockOthers(userId: string, keepId: string): void {
		const now = new Date();
		const others = databaseConnection
			.get()
			.select({ id: session.id })
			.from(session)
			.where(and(eq(session.userId, userId), ne(session.id, keepId)))
			.all();
		for (const { id } of others) {
			databaseConnection
				.get()
				.insert(sessionLock)
				.values({ sessionId: id, lastActiveAt: now, locked: true })
				.onConflictDoUpdate({
					target: sessionLock.sessionId,
					set: { locked: true },
				})
				.run();
		}
	}

	/** Unlocks `sessionId` and clears its failed attempts. */
	static unlock(sessionId: string): void {
		databaseConnection
			.get()
			.update(sessionLock)
			.set({ locked: false, failedAttempts: 0, lastActiveAt: new Date() })
			.where(eq(sessionLock.sessionId, sessionId))
			.run();
	}

	/** Counts one wrong passcode on `sessionId` and returns the new total. */
	static recordFailure(sessionId: string): number {
		return (
			databaseConnection
				.get()
				.update(sessionLock)
				.set({ failedAttempts: sql`${sessionLock.failedAttempts} + 1` })
				.where(eq(sessionLock.sessionId, sessionId))
				.returning({ failedAttempts: sessionLock.failedAttempts })
				.get()?.failedAttempts ?? 0
		);
	}

	/** Whether the session was locked on purpose, whatever its idle time. */
	get locked(): boolean {
		return this.row.locked;
	}

	/** When the session last made a request. */
	get lastActiveAt(): Date {
		return this.row.lastActiveAt;
	}

	/** Wrong passcodes entered since the last unlock. */
	get failedAttempts(): number {
		return this.row.failedAttempts;
	}
}
