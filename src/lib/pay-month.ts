export const monthStartDays = 28;

const sameMonthDays = 20;
const earlyPayDays = 10;

export interface MonthStarts {
	startDay: number;
	paydays: string[];
}

function utc(day: string): Date {
	return new Date(`${day}T00:00:00Z`);
}

function iso(time: number): string {
	return new Date(time).toISOString().slice(0, 10);
}

function addDays(day: string, days: number): string {
	const date = utc(day);
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString().slice(0, 10);
}

function daysApart(from: string, to: string): number {
	return Math.round((utc(to).getTime() - utc(from).getTime()) / 86_400_000);
}

/** The same day of the month as `day`, `months` later or earlier, held to the target month's last day. */
export function shiftClamped(day: string, months: number): string {
	const date = utc(day);
	const year = date.getUTCFullYear();
	const month = date.getUTCMonth() + months;
	const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
	return iso(Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay)));
}

/** Days the pay came in, oldest first, a second payment within a few weeks of the last one folded into its month. */
function monthOpenings(paydays: string[]): string[] {
	const openings: string[] = [];
	for (const day of [...new Set(paydays)].toSorted()) {
		const last = openings.at(-1);
		if (!last || daysApart(last, day) >= sameMonthDays) {
			openings.push(day);
		}
	}
	return openings;
}

/**
 * Where someone's months start: on the 1st, on a fixed payday, or on the days their pay actually came in, months before
 * the first and after the last one falling on the same day of the month.
 */
export class MonthCalendar {
	readonly #startDay: number;
	readonly #openings: string[];

	/** A calendar starting months on `startDay`, or on `paydays` once there is one. */
	constructor({ startDay = 1, paydays = [] }: Partial<MonthStarts> = {}) {
		this.#startDay = startDay;
		this.#openings = monthOpenings(paydays);
	}

	/** Whether months follow the days the pay came in rather than a fixed day. */
	get followsPay(): boolean {
		return this.#openings.length > 0;
	}

	/** The first day of the month `day` falls in. */
	startOf(day: string): string {
		const first = this.#openings[0];
		if (!first) {
			const date = utc(day);
			const month = date.getUTCMonth();
			return iso(
				Date.UTC(
					date.getUTCFullYear(),
					date.getUTCDate() >= this.#startDay ? month : month - 1,
					this.#startDay,
				),
			);
		}
		if (day < first) {
			let months = 1;
			while (shiftClamped(first, -months) > day) {
				months += 1;
			}
			return shiftClamped(first, -months);
		}
		const index = this.#openings.findLastIndex((opening) => opening <= day);
		const opening = this.#openings[index] ?? first;
		const following = this.#openings[index + 1];
		const limit = following ? addDays(following, -earlyPayDays) : undefined;
		let start = opening;
		for (let months = 1; ; months += 1) {
			const next = shiftClamped(opening, months);
			if (next > day || (limit && next >= limit)) {
				return start;
			}
			start = next;
		}
	}

	/** The first day of the month after the one starting on `start`. */
	next(start: string): string {
		let day = addDays(start, 1);
		while (this.startOf(day) === start) {
			day = addDays(day, 1);
		}
		return day;
	}

	/** The first day of the month before the one starting on `start`. */
	previous(start: string): string {
		return this.startOf(addDays(start, -1));
	}

	/** The last day of the month starting on `start`. */
	endOf(start: string): string {
		return addDays(this.next(start), -1);
	}

	/**
	 * How to name the month starting on `start`: "October 2026" for a calendar month, "25 Oct – 24 Nov" otherwise, with
	 * the year when it isn't `today`'s.
	 */
	label(start: string, today = new Date().toISOString().slice(0, 10)): string {
		const from = utc(start);
		const end = utc(this.endOf(start));
		if (
			from.getUTCDate() === 1 &&
			end.getUTCMonth() === from.getUTCMonth() &&
			utc(addDays(this.endOf(start), 1)).getUTCDate() === 1
		) {
			return from.toLocaleDateString(undefined, {
				month: "long",
				year: "numeric",
				timeZone: "UTC",
			});
		}
		const thisYear = utc(today).getUTCFullYear();
		const short = { day: "numeric", month: "short", timeZone: "UTC" } as const;
		const withYear = { ...short, year: "numeric" } as const;
		const yearShown =
			from.getUTCFullYear() !== thisYear || end.getUTCFullYear() !== thisYear;
		const sameYear = from.getUTCFullYear() === end.getUTCFullYear();
		return `${from.toLocaleDateString(undefined, yearShown && !sameYear ? withYear : short)} – ${end.toLocaleDateString(
			undefined,
			yearShown ? withYear : short,
		)}`;
	}
}
