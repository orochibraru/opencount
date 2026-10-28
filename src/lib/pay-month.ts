export const monthStartDays = 28;

function utc(day: string): Date {
	return new Date(`${day}T00:00:00Z`);
}

function iso(time: number): string {
	return new Date(time).toISOString().slice(0, 10);
}

/** The first day of the month `day` falls in, when months start on day `startDay` (1 to 28): payday to payday. */
export function monthStartOn(day: string, startDay = 1): string {
	const date = utc(day);
	const year = date.getUTCFullYear();
	const month = date.getUTCMonth();
	return iso(
		Date.UTC(year, date.getUTCDate() >= startDay ? month : month - 1, startDay),
	);
}

/** The start of the month `months` after the one starting on `start`, or before it when negative. */
export function shiftMonth(start: string, months: number): string {
	const date = utc(start);
	return iso(
		Date.UTC(
			date.getUTCFullYear(),
			date.getUTCMonth() + months,
			date.getUTCDate(),
		),
	);
}

/** The last day of the month starting on `start`. */
export function monthEndFrom(start: string): string {
	const next = utc(shiftMonth(start, 1));
	next.setUTCDate(next.getUTCDate() - 1);
	return next.toISOString().slice(0, 10);
}

/**
 * How to name the month starting on `start`: "October 2026" for a calendar month, "25 Oct – 24 Nov" otherwise, with
 * the year when it isn't `today`'s.
 */
export function monthLabel(
	start: string,
	today = new Date().toISOString().slice(0, 10),
): string {
	const from = utc(start);
	if (from.getUTCDate() === 1) {
		return from.toLocaleDateString(undefined, {
			month: "long",
			year: "numeric",
			timeZone: "UTC",
		});
	}
	const end = utc(monthEndFrom(start));
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
