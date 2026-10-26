import { and, count, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";

import { BaseDTO } from "#lib/dto/base-dto.js";
import { getDb } from "#lib/server/db/lib.js";
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

function memberCounts() {
	return getDb()
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
		return getDb()
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
		const row = getDb()
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

	/** Creates a group with its owner as the first member, in one transaction. */
	static create({ name, currency, owner }: NewGroup): GroupDTO {
		return getDb().transaction((transaction) => {
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
		getDb()
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
		getDb().update(group).set({ name }).where(eq(group.id, this.row.id)).run();
	}

	/** Whether any expense was recorded, which freezes the currency. */
	hasExpenses(): boolean {
		return (
			getDb()
				.select({ id: expense.id })
				.from(expense)
				.where(eq(expense.groupId, this.row.id))
				.get() !== undefined
		);
	}

	/** Changes the currency. */
	setCurrency(currency: string): void {
		getDb()
			.update(group)
			.set({ currency })
			.where(eq(group.id, this.row.id))
			.run();
	}

	/** Deletes the group with its members and expenses. */
	delete(): void {
		getDb().transaction((transaction) => {
			transaction.delete(expense).where(eq(expense.groupId, this.row.id)).run();
			transaction.delete(group).where(eq(group.id, this.row.id)).run();
		});
	}
}
