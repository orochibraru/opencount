import { desc, eq, sql } from "drizzle-orm";

import { BaseDTO } from "#lib/dto/base-dto.js";
import { getDb } from "#lib/server/db/lib.js";
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
		return getDb()
			.select(columns)
			.from(merchant)
			.where(eq(merchant.groupId, groupId))
			.orderBy(desc(merchant.useCount), desc(merchant.lastUsedAt))
			.limit(500)
			.all()
			.map((row) => new MerchantDTO(row));
	}

	/**
	 * Saves `name` as a merchant of `groupId`, or bumps the one already saved under that name whatever its case, and
	 * remembers `category` as what it was last filed under. Returns its id.
	 */
	static remember(groupId: string, name: string, category: string): string {
		const trimmed = name.trim();
		return getDb()
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
