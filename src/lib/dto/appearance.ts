import { eq } from "drizzle-orm";

import { BaseDTO } from "#lib/dto/base-dto.js";
import { databaseConnection } from "#lib/server/db/database.js";
import { appearance, type homePages } from "#lib/server/db/schema.js";

export type Appearance = Omit<
	typeof appearance.$inferSelect,
	"userId" | "updatedAt" | "home" | "monthStartDay"
>;

export type HomePage = (typeof homePages)[number];

export const defaultAppearance: Appearance = {
	accent: "bordeaux",
	theme: "system",
	darkVariant: "default",
	font: "default",
	corners: "rounded",
};

export class AppearanceDTO extends BaseDTO<Appearance> {
	/** `userId`'s appearance, or the defaults when they never changed it. */
	static forUser(userId: string): AppearanceDTO {
		const row = databaseConnection
			.get()
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

	/** What `userId` picked as their home page, or `null` when they were never asked. */
	static homeFor(userId: string): HomePage | null {
		return (
			databaseConnection
				.get()
				.select({ home: appearance.home })
				.from(appearance)
				.where(eq(appearance.userId, userId))
				.get()?.home ?? null
		);
	}

	/** Stores `userId`'s choice of home page, keeping the rest of their appearance. */
	static saveHome(userId: string, home: HomePage): void {
		databaseConnection
			.get()
			.insert(appearance)
			.values({ userId, ...defaultAppearance, home })
			.onConflictDoUpdate({
				target: appearance.userId,
				set: { home, updatedAt: new Date() },
			})
			.run();
	}

	/** The day `userId`'s month starts on, 1 for calendar months or their payday for pay-to-pay months. */
	static monthStartFor(userId: string): number {
		return (
			databaseConnection
				.get()
				.select({ monthStartDay: appearance.monthStartDay })
				.from(appearance)
				.where(eq(appearance.userId, userId))
				.get()?.monthStartDay ?? 1
		);
	}

	/** Stores the day `userId`'s month starts on, keeping the rest of their appearance. */
	static saveMonthStart(userId: string, monthStartDay: number): void {
		databaseConnection
			.get()
			.insert(appearance)
			.values({ userId, ...defaultAppearance, monthStartDay })
			.onConflictDoUpdate({
				target: appearance.userId,
				set: { monthStartDay, updatedAt: new Date() },
			})
			.run();
	}

	/** Stores `userId`'s appearance. */
	static save(userId: string, values: Appearance): void {
		databaseConnection
			.get()
			.insert(appearance)
			.values({ userId, ...values })
			.onConflictDoUpdate({
				target: appearance.userId,
				set: { ...values, updatedAt: new Date() },
			})
			.run();
	}
}
