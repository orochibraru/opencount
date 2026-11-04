import { and, asc, eq } from "drizzle-orm";

import { BaseDTO } from "#lib/dto/base-dto.js";
import type { SeriesSettings } from "#lib/recurring-schedule.js";
import { databaseConnection } from "#lib/server/db/database.js";
import { recurringSeries } from "#lib/server/db/schema.js";

export class RecurringSeriesDTO extends BaseDTO<SeriesSettings> {
	/** `userId`'s recurring series, oldest first. */
	static forUser(userId: string): RecurringSeriesDTO[] {
		return databaseConnection
			.get()
			.select({
				id: recurringSeries.id,
				label: recurringSeries.label,
				type: recurringSeries.type,
				frequency: recurringSeries.frequency,
				endDate: recurringSeries.endDate,
			})
			.from(recurringSeries)
			.where(eq(recurringSeries.userId, userId))
			.orderBy(asc(recurringSeries.createdAt))
			.all()
			.map((row) => new RecurringSeriesDTO(row));
	}

	/** Series `id`, only when it belongs to `userId`. */
	static findForUser(
		id: string,
		userId: string,
	): RecurringSeriesDTO | undefined {
		return RecurringSeriesDTO.forUser(userId).find((entry) => entry.id === id);
	}

	/** `userId`'s series called `label`, made with type `type` when they have none by that name yet. */
	static findOrCreate(
		userId: string,
		label: string,
		type: SeriesSettings["type"] = "other",
	): RecurringSeriesDTO {
		const existing = RecurringSeriesDTO.forUser(userId).find(
			(entry) => entry.toJSON().label.toLowerCase() === label.toLowerCase(),
		);
		if (existing) {
			return existing;
		}
		return new RecurringSeriesDTO(
			databaseConnection
				.get()
				.insert(recurringSeries)
				.values({ userId, label, type })
				.returning({
					id: recurringSeries.id,
					label: recurringSeries.label,
					type: recurringSeries.type,
					frequency: recurringSeries.frequency,
					endDate: recurringSeries.endDate,
				})
				.get(),
		);
	}

	get id(): string {
		return this.row.id;
	}

	/** Changes the series' label, type, frequency (null to read it from its lines) or end date (null for none). */
	update(
		values: Partial<
			Pick<SeriesSettings, "label" | "type" | "frequency" | "endDate">
		>,
	): void {
		databaseConnection
			.get()
			.update(recurringSeries)
			.set(values)
			.where(eq(recurringSeries.id, this.row.id))
			.run();
		Object.assign(this.row, values);
	}

	/** Deletes the series of `userId`; its lines stay, out of any series. */
	delete(userId: string): void {
		databaseConnection
			.get()
			.delete(recurringSeries)
			.where(
				and(
					eq(recurringSeries.id, this.row.id),
					eq(recurringSeries.userId, userId),
				),
			)
			.run();
	}
}
