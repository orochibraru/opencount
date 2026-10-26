import { and, asc, eq, sql } from "drizzle-orm";

import { BaseDTO } from "#lib/dto/base-dto.js";
import { getDb } from "#lib/server/db/lib.js";
import {
	expense,
	expenseShare,
	groupMember,
	recurringExpense,
	recurringShare,
	user,
} from "#lib/server/db/schema.js";

export interface GroupMemberRow {
	id: string;
	displayName: string;
	userId: string | null;
	email: string | null;
}

const columns = {
	id: groupMember.id,
	displayName: groupMember.displayName,
	userId: groupMember.userId,
	email: user.email,
};

export class GroupMemberDTO extends BaseDTO<GroupMemberRow> {
	/** The members of `groupId`, oldest first. */
	static forGroup(groupId: string): GroupMemberDTO[] {
		return getDb()
			.select(columns)
			.from(groupMember)
			.leftJoin(user, eq(user.id, groupMember.userId))
			.where(eq(groupMember.groupId, groupId))
			.orderBy(asc(groupMember.createdAt))
			.all()
			.map((row) => new GroupMemberDTO(row));
	}

	/** Member `memberId`, only when it belongs to `groupId`. */
	static findInGroup(
		groupId: string,
		memberId: string,
	): GroupMemberDTO | undefined {
		const row = getDb()
			.select(columns)
			.from(groupMember)
			.leftJoin(user, eq(user.id, groupMember.userId))
			.where(
				and(eq(groupMember.groupId, groupId), eq(groupMember.id, memberId)),
			)
			.get();
		return row ? new GroupMemberDTO(row) : undefined;
	}

	/** Adds a member to `groupId`, linked to an account when `userId` is given. */
	static add(
		groupId: string,
		displayName: string,
		userId: string | null = null,
	): GroupMemberDTO {
		const row = getDb()
			.insert(groupMember)
			.values({ groupId, displayName, userId })
			.returning()
			.get();
		return new GroupMemberDTO({
			id: row.id,
			displayName: row.displayName,
			userId: row.userId,
			email: null,
		});
	}

	/** Whether `userId` is already a member of `groupId`. */
	static isMember(groupId: string, userId: string): boolean {
		return (
			getDb()
				.select({ id: groupMember.id })
				.from(groupMember)
				.where(
					and(eq(groupMember.groupId, groupId), eq(groupMember.userId, userId)),
				)
				.get() !== undefined
		);
	}

	get id(): string {
		return this.row.id;
	}

	get userId(): string | null {
		return this.row.userId;
	}

	/** Renames the member. */
	rename(displayName: string): void {
		getDb()
			.update(groupMember)
			.set({ displayName })
			.where(eq(groupMember.id, this.row.id))
			.run();
	}

	/** Whether the member paid for or shares in any expense or repeating expense, which keeps them in the group. */
	isInvolved(): boolean {
		const database = getDb();
		const paid = database
			.select({ id: expense.id })
			.from(expense)
			.where(eq(expense.paidBy, this.row.id))
			.get();
		const shared = database
			.select({ id: expenseShare.expenseId })
			.from(expenseShare)
			.where(eq(expenseShare.memberId, this.row.id))
			.get();
		const repeats = database
			.select({ id: recurringExpense.id })
			.from(recurringExpense)
			.where(eq(recurringExpense.paidBy, this.row.id))
			.get();
		const repeatShared = database
			.select({ id: recurringShare.recurringId })
			.from(recurringShare)
			.where(eq(recurringShare.memberId, this.row.id))
			.get();
		return [paid, shared, repeats, repeatShared].some(
			(row) => row !== undefined,
		);
	}

	/** Removes the member from the group. */
	remove(): void {
		getDb().delete(groupMember).where(eq(groupMember.id, this.row.id)).run();
	}

	/** Links this member, who has no account yet, to `userId`'s. */
	linkTo(userId: string): void {
		getDb()
			.update(groupMember)
			.set({ userId })
			.where(eq(groupMember.id, this.row.id))
			.run();
	}

	/** Unlinks the member from their account: their name and expenses stay, the account loses access to the group. */
	unlink(): void {
		getDb()
			.update(groupMember)
			.set({ userId: null })
			.where(eq(groupMember.id, this.row.id))
			.run();
	}

	/**
	 * Links this unlinked member to `previous`'s account and folds `previous` into it: what `previous` paid, its
	 * shares (added to this member's where both share one expense) and its repeating expenses move here, then
	 * `previous` is removed. One transaction.
	 */
	takeOver(previous: GroupMemberDTO): void {
		const target = this.row.id;
		const source = previous.row.id;
		getDb().transaction((transaction) => {
			transaction
				.update(expense)
				.set({ paidBy: target })
				.where(eq(expense.paidBy, source))
				.run();
			transaction
				.update(recurringExpense)
				.set({ paidBy: target })
				.where(eq(recurringExpense.paidBy, source))
				.run();
			for (const share of transaction
				.select()
				.from(expenseShare)
				.where(eq(expenseShare.memberId, source))
				.all()) {
				const merged = transaction
					.update(expenseShare)
					.set({
						amountMinor: sql`${expenseShare.amountMinor} + ${share.amountMinor}`,
						weight: sql`${expenseShare.weight} + ${share.weight}`,
					})
					.where(
						and(
							eq(expenseShare.expenseId, share.expenseId),
							eq(expenseShare.memberId, target),
						),
					)
					.returning({ memberId: expenseShare.memberId })
					.get();
				const scope = and(
					eq(expenseShare.expenseId, share.expenseId),
					eq(expenseShare.memberId, source),
				);
				if (merged) {
					transaction.delete(expenseShare).where(scope).run();
				} else {
					transaction
						.update(expenseShare)
						.set({ memberId: target })
						.where(scope)
						.run();
				}
			}
			for (const share of transaction
				.select()
				.from(recurringShare)
				.where(eq(recurringShare.memberId, source))
				.all()) {
				const merged = transaction
					.update(recurringShare)
					.set({
						amountMinor: sql`${recurringShare.amountMinor} + ${share.amountMinor}`,
						weight: sql`${recurringShare.weight} + ${share.weight}`,
					})
					.where(
						and(
							eq(recurringShare.recurringId, share.recurringId),
							eq(recurringShare.memberId, target),
						),
					)
					.returning({ memberId: recurringShare.memberId })
					.get();
				const scope = and(
					eq(recurringShare.recurringId, share.recurringId),
					eq(recurringShare.memberId, source),
				);
				if (merged) {
					transaction.delete(recurringShare).where(scope).run();
				} else {
					transaction
						.update(recurringShare)
						.set({ memberId: target })
						.where(scope)
						.run();
				}
			}
			transaction.delete(groupMember).where(eq(groupMember.id, source)).run();
			transaction
				.update(groupMember)
				.set({ userId: previous.row.userId })
				.where(eq(groupMember.id, target))
				.run();
		});
	}
}
