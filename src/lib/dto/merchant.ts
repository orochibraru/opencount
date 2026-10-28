import { and, desc, eq, sql } from "drizzle-orm";

import { BaseDTO } from "#lib/dto/base-dto.js";
import { databaseConnection } from "#lib/server/db/database.js";
import { merchant } from "#lib/server/db/schema.js";

export interface MerchantRow {
	id: string;
	name: string;
	category: string;
}

const columns = {
	id: merchant.id,
	name: merchant.name,
	category: merchant.category,
};

export class MerchantDTO extends BaseDTO<MerchantRow> {
	/** The merchants `groupId` has paid, most used first. */
	static forGroup(groupId: string): MerchantDTO[] {
		return databaseConnection
			.get()
			.select(columns)
			.from(merchant)
			.where(eq(merchant.groupId, groupId))
			.orderBy(desc(merchant.useCount), desc(merchant.lastUsedAt))
			.limit(500)
			.all()
			.map((row) => new MerchantDTO(row));
	}

	/** Merchant `id`, only when it belongs to `groupId`. */
	static findInGroup(groupId: string, id: string): MerchantDTO | undefined {
		const row = databaseConnection
			.get()
			.select(columns)
			.from(merchant)
			.where(and(eq(merchant.groupId, groupId), eq(merchant.id, id)))
			.get();
		return row ? new MerchantDTO(row) : undefined;
	}

	/** The merchant of `groupId` saved under `name`, whatever its case. */
	static findByName(groupId: string, name: string): MerchantDTO | undefined {
		const row = databaseConnection
			.get()
			.select(columns)
			.from(merchant)
			.where(
				and(
					eq(merchant.groupId, groupId),
					eq(merchant.nameKey, name.trim().toLocaleLowerCase()),
				),
			)
			.get();
		return row ? new MerchantDTO(row) : undefined;
	}

	/**
	 * Saves `name` as a merchant of `groupId`, or bumps the one already saved under that name whatever its case, and
	 * remembers `category` as what it was last filed under. Returns its id.
	 */
	static remember(groupId: string, name: string, category: string): string {
		const trimmed = name.trim();
		return databaseConnection
			.get()
			.insert(merchant)
			.values({
				groupId,
				name: trimmed,
				nameKey: trimmed.toLocaleLowerCase(),
				category,
				useCount: 1,
			})
			.onConflictDoUpdate({
				target: [merchant.groupId, merchant.nameKey],
				set: {
					name: trimmed,
					category,
					useCount: sql`${merchant.useCount} + 1`,
					lastUsedAt: new Date(),
				},
			})
			.returning({ id: merchant.id })
			.get().id;
	}
}
