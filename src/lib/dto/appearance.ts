import { eq } from "drizzle-orm";

import { BaseDTO } from "#lib/dto/base-dto.js";
import { getDb } from "#lib/server/db/lib.js";
import { appearance } from "#lib/server/db/schema.js";

export type Appearance = Omit<
	typeof appearance.$inferSelect,
	"userId" | "updatedAt"
>;

export const defaultAppearance: Appearance = {
	accent: "green",
	theme: "system",
	darkVariant: "default",
	font: "default",
	corners: "rounded",
};

export class AppearanceDTO extends BaseDTO<Appearance> {
	/** `userId`'s appearance, or the defaults when they never changed it. */
	static forUser(userId: string): AppearanceDTO {
		const row = getDb()
			.select({
				accent: appearance.accent,
				theme: appearance.theme,
				darkVariant: appearance.darkVariant,
				font: appearance.font,
				corners: appearance.corners,
			})
			.from(appearance)
			.where(eq(appearance.userId, userId))
			.get();
		return new AppearanceDTO(row ?? defaultAppearance);
	}

	/** Stores `userId`'s appearance. */
	static save(userId: string, values: Appearance): void {
		getDb()
			.insert(appearance)
			.values({ userId, ...values })
			.onConflictDoUpdate({
				target: appearance.userId,
				set: { ...values, updatedAt: new Date() },
			})
			.run();
	}
}
