import { PersonalExpenseDTO } from "#lib/dto/personal-expense.js";
import { RecurringSeriesDTO } from "#lib/dto/recurring-series.js";
import {
	type cadences,
	endAfter,
	type RecurringPayment,
	recurringSchedule,
	type RecurringType,
} from "#lib/recurring-schedule.js";

export interface RecurringSettings {
	label: string;
	type?: RecurringType;
	frequency?: (typeof cadences)[number] | null;
	endDate?: string | null;
	remainingInstallments?: number | null;
}

/** Someone's recurring payments: subscriptions, loans and instalments, filed by series. */
class RecurringBook {
	/** `userId`'s recurring series as of `today`, soonest first, ended ones last. */
	list(
		userId: string,
		today = new Date().toISOString().slice(0, 10),
	): RecurringPayment[] {
		return recurringSchedule(
			RecurringSeriesDTO.forUser(userId).map((entry) => entry.toJSON()),
			PersonalExpenseDTO.recurringLines(userId),
			today,
		);
	}

	/**
	 * Files `userId`'s expense `expenseId` and every line like it in the series named `settings.label`, made when new,
	 * then applies the rest of `settings`: a number of payments left becomes the end date. Undefined when the expense
	 * isn't theirs.
	 */
	file(
		userId: string,
		expenseId: string,
		settings: RecurringSettings,
	): RecurringPayment | undefined {
		if (!PersonalExpenseDTO.findForUser(expenseId, userId)) {
			return undefined;
		}
		const series = RecurringSeriesDTO.findOrCreate(
			userId,
			settings.label,
			settings.type,
		);
		PersonalExpenseDTO.fileRecurring(userId, expenseId, series.id);
		return this.update(userId, series.id, settings);
	}

	/** Changes `userId`'s series `seriesId` as `settings` say; undefined when it isn't theirs. */
	update(
		userId: string,
		seriesId: string,
		settings: Partial<RecurringSettings>,
	): RecurringPayment | undefined {
		const series = RecurringSeriesDTO.findForUser(seriesId, userId);
		if (!series) {
			return undefined;
		}
		series.update({
			...(settings.label !== undefined && { label: settings.label }),
			...(settings.type !== undefined && { type: settings.type }),
			...(settings.frequency !== undefined && {
				frequency: settings.frequency,
			}),
			...(settings.endDate !== undefined && { endDate: settings.endDate }),
		});
		const remaining = settings.remainingInstallments;
		if (remaining !== undefined) {
			const payment = this.#find(userId, seriesId);
			series.update({
				endDate:
					remaining && payment?.nextOn
						? endAfter(
								payment.nextOn,
								remaining,
								payment.cadence,
								payment.everyDays,
							)
						: null,
			});
		}
		return this.#find(userId, seriesId);
	}

	/**
	 * Saves what the recurring sheet sent for `userId`: files expense `expenseId` in a series when given, else changes
	 * series `seriesId`; an empty `remaining` leaves the end date as it is. Undefined when neither is theirs.
	 */
	save(
		userId: string,
		input: {
			expenseId: string;
			seriesId: string;
			label: string;
			type: RecurringType;
			frequency: (typeof cadences)[number] | null;
			remaining: number | "";
		},
	): RecurringPayment | undefined {
		const settings = {
			label: input.label,
			type: input.type,
			frequency: input.frequency,
			...(input.remaining !== "" && {
				remainingInstallments: input.remaining,
			}),
		};
		return input.expenseId
			? this.file(userId, input.expenseId, settings)
			: this.update(userId, input.seriesId, settings);
	}

	/** Whether `userId` has a series other than `exceptId` called `label`, whatever its case. */
	labelTaken(userId: string, label: string, exceptId: string): boolean {
		return RecurringSeriesDTO.forUser(userId).some(
			(entry) =>
				entry.id !== exceptId &&
				entry.toJSON().label.toLowerCase() === label.toLowerCase(),
		);
	}

	/** Takes `userId`'s expense `expenseId` and every line like it out of any series; false when it isn't theirs. */
	unfile(userId: string, expenseId: string): boolean {
		return PersonalExpenseDTO.fileRecurring(userId, expenseId, null) > 0;
	}

	/** Deletes `userId`'s series `seriesId`, its lines staying out of any series; false when it isn't theirs. */
	remove(userId: string, seriesId: string): boolean {
		const series = RecurringSeriesDTO.findForUser(seriesId, userId);
		series?.delete(userId);
		return series !== undefined;
	}

	/** `userId`'s series `seriesId` as a recurring payment. */
	#find(userId: string, seriesId: string): RecurringPayment | undefined {
		return this.list(userId).find((payment) => payment.id === seriesId);
	}
}

export const recurringBook = new RecurringBook();
