import { eq } from "drizzle-orm";

import { BaseDTO } from "#lib/dto/base-dto.js";
import { databaseConnection } from "#lib/server/db/database.js";
import { appearance, type homePages } from "#lib/server/db/schema.js";

export type Appearance = Omit<
	typeof appearance.$inferSelect,
	| "userId"
	| "updatedAt"
	| "home"
	| "monthStartDay"
	| "monthFromPay"
	| "expectedPayday"
>;

export interface MonthSetting {
	startDay: number;
	fromPay: boolean;
}

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

	/** How `userId`'s months start: on day `startDay`, 1 for calendar months, or on the days their pay came in. */
	static monthSettingFor(userId: string): MonthSetting {
		const row = databaseConnection
			.get()
			.select({
				startDay: appearance.monthStartDay,
				fromPay: appearance.monthFromPay,
			})
			.from(appearance)
			.where(eq(appearance.userId, userId))
			.get();
		return row ?? { startDay: 1, fromPay: false };
	}

	/** The day `userId` said their next pay should land, or null when the app works it out. */
	static expectedPaydayFor(userId: string): string | null {
		return (
			databaseConnection
				.get()
				.select({ expectedPayday: appearance.expectedPayday })
				.from(appearance)
				.where(eq(appearance.userId, userId))
				.get()?.expectedPayday ?? null
		);
	}

	/** Stores the day `userId` expects their next pay, or null to let the app work it out. */
	static saveExpectedPayday(
		userId: string,
		expectedPayday: string | null,
	): void {
		databaseConnection
			.get()
			.insert(appearance)
			.values({ userId, ...defaultAppearance, expectedPayday })
			.onConflictDoUpdate({
				target: appearance.userId,
				set: { expectedPayday, updatedAt: new Date() },
			})
			.run();
	}

	/** Stores how `userId`'s months start, keeping the rest of their appearance. */
	static saveMonthStart(
		userId: string,
		{ startDay, fromPay }: MonthSetting,
	): void {
		databaseConnection
			.get()
			.insert(appearance)
			.values({
				userId,
				...defaultAppearance,
				monthStartDay: startDay,
				monthFromPay: fromPay,
			})
			.onConflictDoUpdate({
				target: appearance.userId,
				set: {
					monthStartDay: startDay,
					monthFromPay: fromPay,
					updatedAt: new Date(),
				},
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
