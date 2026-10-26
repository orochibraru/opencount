import { desc, eq } from "drizzle-orm";

import { BaseDTO } from "#lib/dto/base-dto.js";
import { getDb } from "#lib/server/db/lib.js";
import { passkey } from "#lib/server/db/schema.js";

export interface PasskeyRow {
	id: string;
	name: string | null;
	deviceType: string;
	backedUp: boolean;
	createdAt: Date | null;
}

export class PasskeyDTO extends BaseDTO<PasskeyRow> {
	/** `userId`'s passkeys, newest first. */
	static forUser(userId: string): PasskeyDTO[] {
		return getDb()
			.select({
				id: passkey.id,
				name: passkey.name,
				deviceType: passkey.deviceType,
				backedUp: passkey.backedUp,
				createdAt: passkey.createdAt,
			})
			.from(passkey)
			.where(eq(passkey.userId, userId))
			.orderBy(desc(passkey.createdAt))
			.all()
			.map((row) => new PasskeyDTO(row));
	}
}
