import { count, desc, eq } from "drizzle-orm";

import { BaseDTO } from "#lib/dto/base-dto.js";
import { getDb } from "#lib/server/db/lib.js";
import {
	passkey,
	session,
	user,
	type userRoles,
} from "#lib/server/db/schema.js";

export type UserRole = (typeof userRoles)[number];

export interface UserRow {
	id: string;
	name: string;
	email: string;
	role: UserRole;
	twoFactorEnabled: boolean;
	passkeyCount: number;
	createdAt: Date;
}

export class UserDTO extends BaseDTO<UserRow> {
	/** Every account, newest first, with its security factors. */
	static list(): UserDTO[] {
		const database = getDb();
		const passkeyCounts = database
			.select({
				userId: passkey.userId,
				passkeyCount: count().as("passkey_count"),
			})
			.from(passkey)
			.groupBy(passkey.userId)
			.as("passkey_counts");
		return database
			.select({
				id: user.id,
				name: user.name,
				email: user.email,
				role: user.role,
				twoFactorEnabled: user.twoFactorEnabled,
				passkeyCount: passkeyCounts.passkeyCount,
				createdAt: user.createdAt,
			})
			.from(user)
			.leftJoin(passkeyCounts, eq(passkeyCounts.userId, user.id))
			.orderBy(desc(user.createdAt))
			.all()
			.map(
				(row) =>
					new UserDTO({
						...row,
						twoFactorEnabled: row.twoFactorEnabled ?? false,
						passkeyCount: row.passkeyCount ?? 0,
					}),
			);
	}

	/** How many accounts exist. */
	static count(): number {
		return getDb().select({ total: count() }).from(user).get()?.total ?? 0;
	}

	/** The id of the account using `email`, if any. */
	static idForEmail(email: string): string | undefined {
		return getDb()
			.select({ id: user.id })
			.from(user)
			.where(eq(user.email, email))
			.get()?.id;
	}

	/** Whether an account uses `email`. */
	static emailExists(email: string): boolean {
		return (
			getDb()
				.select({ id: user.id })
				.from(user)
				.where(eq(user.email, email))
				.get() !== undefined
		);
	}

	/** Gives `userId` the `role`. */
	static setRole(userId: string, role: UserRole): void {
		getDb().update(user).set({ role }).where(eq(user.id, userId)).run();
	}

	/** Records that `userId` proved ownership of their address. */
	static markEmailVerified(userId: string): void {
		getDb()
			.update(user)
			.set({ emailVerified: true })
			.where(eq(user.id, userId))
			.run();
	}

	/** Signs `userId` out everywhere. */
	static revokeSessions(userId: string): void {
		getDb().delete(session).where(eq(session.userId, userId)).run();
	}

	/** Deletes `userId` and, through the foreign keys, their sessions, factors and memberships' links. */
	static delete(userId: string): void {
		getDb().delete(user).where(eq(user.id, userId)).run();
	}
}
