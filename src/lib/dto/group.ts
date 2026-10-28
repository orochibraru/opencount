import { and, count, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";

import { BaseDTO } from "#lib/dto/base-dto.js";
import { secrets } from "#lib/server/core/secrets.js";
import { databaseConnection } from "#lib/server/db/database.js";
import { expense, group, groupMember } from "#lib/server/db/schema.js";

export interface GroupRow {
	id: string;
	name: string;
	currency: string;
	createdBy: string | null;
	memberCount: number;
	archived: boolean;
	createdAt: Date;
}

export interface NewGroup {
	name: string;
	currency: string;
	owner: { id: string; name: string };
}

function inviteToken(groupId: string, nonce: string): string {
	return secrets.hashToken(`group-invite:${groupId}:${nonce}`);
}

function memberCounts() {
	return databaseConnection
		.get()
		.select({
			groupId: groupMember.groupId,
			memberCount: count().as("member_count"),
		})
		.from(groupMember)
		.groupBy(groupMember.groupId)
		.as("member_counts");
}

export class GroupDTO extends BaseDTO<GroupRow> {
	/** The groups `userId` is a member of and hasn't archived (or only the archived ones), newest first. */
	static forMember(userId: string, { archived = false } = {}): GroupDTO[] {
		const counts = memberCounts();
		return databaseConnection
			.get()
			.select({
				id: group.id,
				name: group.name,
				currency: group.currency,
				createdBy: group.createdBy,
				memberCount: counts.memberCount,
				archived: sql<boolean>`${groupMember.archivedAt} is not null`.mapWith(
					Boolean,
				),
				createdAt: group.createdAt,
			})
			.from(group)
			.innerJoin(groupMember, eq(groupMember.groupId, group.id))
			.innerJoin(counts, eq(counts.groupId, group.id))
			.where(
				and(
					eq(groupMember.userId, userId),
					archived
						? isNotNull(groupMember.archivedAt)
						: isNull(groupMember.archivedAt),
				),
			)
			.orderBy(desc(group.createdAt))
			.all()
			.map((row) => new GroupDTO(row));
	}

	/** Group `groupId`, only when `userId` is one of its members. */
	static findForMember(groupId: string, userId: string): GroupDTO | undefined {
		const counts = memberCounts();
		const row = databaseConnection
			.get()
			.select({
				id: group.id,
				name: group.name,
				currency: group.currency,
				createdBy: group.createdBy,
				memberCount: counts.memberCount,
				archived: sql<boolean>`${groupMember.archivedAt} is not null`.mapWith(
					Boolean,
				),
				createdAt: group.createdAt,
			})
			.from(group)
			.innerJoin(
				groupMember,
				and(eq(groupMember.groupId, group.id), eq(groupMember.userId, userId)),
			)
			.innerJoin(counts, eq(counts.groupId, group.id))
			.where(eq(group.id, groupId))
			.get();
		return row ? new GroupDTO(row) : undefined;
	}

	/** Group `groupId`'s name and currency when `token` is its live invite link token, for someone not in it yet. */
	static findByInvite(
		groupId: string,
		token: string,
	): { id: string; name: string; currency: string } | undefined {
		const row = databaseConnection
			.get()
			.select({
				id: group.id,
				name: group.name,
				currency: group.currency,
				inviteNonce: group.inviteNonce,
			})
			.from(group)
			.where(eq(group.id, groupId))
			.get();
		if (!row?.inviteNonce || inviteToken(row.id, row.inviteNonce) !== token) {
			return undefined;
		}
		return { id: row.id, name: row.name, currency: row.currency };
	}

	/** Creates a group with its owner as the first member, in one transaction. */
	static create({ name, currency, owner }: NewGroup): GroupDTO {
		return databaseConnection.get().transaction((transaction) => {
			const created = transaction
				.insert(group)
				.values({ name, currency, createdBy: owner.id })
				.returning()
				.get();
			transaction
				.insert(groupMember)
				.values({
					groupId: created.id,
					userId: owner.id,
					displayName: owner.name,
				})
				.run();
			return new GroupDTO({
				id: created.id,
				name: created.name,
				currency: created.currency,
				createdBy: created.createdBy,
				memberCount: 1,
				archived: false,
				createdAt: created.createdAt,
			});
		});
	}

	get id(): string {
		return this.row.id;
	}

	get currency(): string {
		return this.row.currency;
	}

	/** Whether `userId` created the group, which lets them delete it. */
	isOwnedBy(userId: string): boolean {
		return this.row.createdBy === userId;
	}

	/** Archives the group for `userId` only, or brings it back: the others keep seeing it as before. */
	setArchived(userId: string, archived: boolean): void {
		databaseConnection
			.get()
			.update(groupMember)
			.set({ archivedAt: archived ? new Date() : null })
			.where(
				and(
					eq(groupMember.groupId, this.row.id),
					eq(groupMember.userId, userId),
				),
			)
			.run();
	}

	/** Renames the group. */
	rename(name: string): void {
		databaseConnection
			.get()
			.update(group)
			.set({ name })
			.where(eq(group.id, this.row.id))
			.run();
	}

	/** Whether any expense was recorded, which freezes the currency. */
	hasExpenses(): boolean {
		return (
			databaseConnection
				.get()
				.select({ id: expense.id })
				.from(expense)
				.where(eq(expense.groupId, this.row.id))
				.get() !== undefined
		);
	}

	/** Changes the currency. */
	setCurrency(currency: string): void {
		databaseConnection
			.get()
			.update(group)
			.set({ currency })
			.where(eq(group.id, this.row.id))
			.run();
	}

	/** The token of the group's invite link, or `undefined` while it has none. */
	inviteToken(): string | undefined {
		const nonce = databaseConnection
			.get()
			.select({ nonce: group.inviteNonce })
			.from(group)
			.where(eq(group.id, this.row.id))
			.get()?.nonce;
		return nonce ? inviteToken(this.row.id, nonce) : undefined;
	}

	/** Makes a new invite link, which stops the previous one working. */
	resetInvite(): void {
		databaseConnection
			.get()
			.update(group)
			.set({ inviteNonce: secrets.randomToken() })
			.where(eq(group.id, this.row.id))
			.run();
	}

	/** Turns the invite link off. */
	disableInvite(): void {
		databaseConnection
			.get()
			.update(group)
			.set({ inviteNonce: null })
			.where(eq(group.id, this.row.id))
			.run();
	}

	/** Deletes the group with its members and expenses. */
	delete(): void {
		databaseConnection.get().transaction((transaction) => {
			transaction.delete(expense).where(eq(expense.groupId, this.row.id)).run();
			transaction.delete(group).where(eq(group.id, this.row.id)).run();
		});
	}
}
