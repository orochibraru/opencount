import { shiftClamped } from "#lib/pay-month.js";

export const cadences = ["weekly", "monthly", "quarterly", "yearly"] as const;

export type Cadence = (typeof cadences)[number] | "days";

export const recurringTypes = [
	"subscription",
	"loan",
	"bnpl",
	"other",
] as const;

export type RecurringType = (typeof recurringTypes)[number];

export const recurringTypeLabels: Record<RecurringType, string> = {
	subscription: "Subscription",
	loan: "Loan",
	bnpl: "Pay in instalments",
	other: "Other",
};

export interface SeriesSettings {
	id: string;
	label: string;
	type: RecurringType;
	frequency: (typeof cadences)[number] | null;
	endDate: string | null;
}

export interface RecurringLine {
	seriesId: string;
	kind: "expense" | "income";
	amountMinor: number;
	currency: string;
	spentOn: string;
	accountUid: string | null;
}

export interface RecurringPayment {
	id: string;
	label: string;
	type: RecurringType;
	kind: "expense" | "income";
	amountMinor: number;
	currency: string;
	accountUid: string | null;
	cadence: Cadence;
	everyDays: number;
	count: number;
	lastOn: string | null;
	nextOn: string | null;
	endDate: string | null;
	remaining: number | null;
	duplicate: boolean;
	ended: boolean;
}

const cadenceDays: Record<(typeof cadences)[number], number> = {
	weekly: 7,
	monthly: 30,
	quarterly: 91,
	yearly: 365,
};

const minimumGapDays = 3;

function addDays(day: string, days: number): string {
	const date = new Date(`${day}T00:00:00Z`);
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString().slice(0, 10);
}

function daysApart(from: string, to: string): number {
	return Math.round(
		(new Date(`${to}T00:00:00Z`).getTime() -
			new Date(`${from}T00:00:00Z`).getTime()) /
			86_400_000,
	);
}

function median(values: number[]): number {
	const sorted = values.toSorted((left, right) => left - right);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 1
		? (sorted[middle] ?? 0)
		: Math.round(((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2);
}

function cadenceOf(gap: number): Cadence {
	if (gap >= 6 && gap <= 8) {
		return "weekly";
	}
	if (gap >= 25 && gap <= 35) {
		return "monthly";
	}
	if (gap >= 85 && gap <= 95) {
		return "quarterly";
	}
	if (gap >= 350 && gap <= 380) {
		return "yearly";
	}
	return "days";
}

/** The day a payment due every `cadence` (or every `gap` days) comes after `day`. */
export function nextAfter(day: string, cadence: Cadence, gap: number): string {
	switch (cadence) {
		case "weekly":
			return addDays(day, 7);
		case "monthly":
			return shiftClamped(day, 1);
		case "quarterly":
			return shiftClamped(day, 3);
		case "yearly":
			return shiftClamped(day, 12);
		case "days":
			return addDays(day, gap);
	}
}

/** How many payments of a series due every `cadence` fall from `nextOn` to `endDate`, both included. */
function paymentsUntil(
	nextOn: string,
	endDate: string,
	cadence: Cadence,
	gap: number,
): number {
	let count = 0;
	for (
		let day = nextOn;
		day <= endDate && count < 1000;
		day = nextAfter(day, cadence, gap)
	) {
		count += 1;
	}
	return count;
}

/** The last day of a series due every `cadence` that makes `count` more payments from `nextOn`. */
export function endAfter(
	nextOn: string,
	count: number,
	cadence: Cadence,
	gap: number,
): string {
	let day = nextOn;
	for (let index = 1; index < count; index += 1) {
		day = nextAfter(day, cadence, gap);
	}
	return day;
}

/**
 * Each series in `series` as a recurring payment from its `lines` as of `today`: its latest amount and account, how
 * often it comes back (as set, else from the gaps between its lines, monthly when seen once), when it came last and
 * comes next, how many payments are left before its end date, whether it was charged twice in less than half its
 * period lately, and whether it is over; soonest first, ended ones last.
 */
export function recurringSchedule(
	series: SeriesSettings[],
	lines: RecurringLine[],
	today: string,
): RecurringPayment[] {
	const bySeries = Map.groupBy(lines, (line) => line.seriesId);
	return series
		.map((entry) => {
			const sorted = (bySeries.get(entry.id) ?? []).toSorted((left, right) =>
				left.spentOn.localeCompare(right.spentOn),
			);
			const latest = sorted.at(-1);
			const days = [...new Set(sorted.map((line) => line.spentOn))];
			const gaps = days
				.slice(1)
				.map((day, index) => daysApart(days[index] ?? day, day))
				.filter((gap) => gap >= minimumGapDays);
			const gap = entry.frequency
				? cadenceDays[entry.frequency]
				: gaps.length > 0
					? Math.max(1, median(gaps))
					: 30;
			const cadence: Cadence =
				entry.frequency ?? (gaps.length > 0 ? cadenceOf(gap) : "monthly");
			let nextOn = latest ? nextAfter(latest.spentOn, cadence, gap) : null;
			while (nextOn && daysApart(nextOn, today) > gap) {
				nextOn = nextAfter(nextOn, cadence, gap);
			}
			const ended = Boolean(
				entry.endDate && (!nextOn || nextOn > entry.endDate),
			);
			const recent = latest
				? sorted.filter(
						(line) => daysApart(line.spentOn, latest.spentOn) < gap / 2,
					)
				: [];
			return {
				id: entry.id,
				label: entry.label,
				type: entry.type,
				kind: latest?.kind ?? "expense",
				amountMinor: latest?.amountMinor ?? 0,
				currency: latest?.currency ?? "EUR",
				accountUid: latest?.accountUid ?? null,
				cadence,
				everyDays: gap,
				count: sorted.length,
				lastOn: latest?.spentOn ?? null,
				nextOn: ended ? null : nextOn,
				endDate: entry.endDate,
				remaining:
					entry.endDate && nextOn && !ended
						? paymentsUntil(nextOn, entry.endDate, cadence, gap)
						: entry.endDate
							? 0
							: null,
				duplicate:
					recent.length > 1 &&
					recent.every((line) => line.amountMinor === latest?.amountMinor),
				ended,
			};
		})
		.toSorted(
			(left, right) =>
				Number(left.ended) - Number(right.ended) ||
				(left.nextOn ?? "9999").localeCompare(right.nextOn ?? "9999") ||
				left.label.localeCompare(right.label),
		);
}

/** How often `payment` comes back, in words: "Monthly", "Every 14 days". */
export function cadenceLabel(
	payment: Pick<RecurringPayment, "cadence" | "everyDays">,
): string {
	switch (payment.cadence) {
		case "weekly":
			return "Weekly";
		case "monthly":
			return "Monthly";
		case "quarterly":
			return "Every 3 months";
		case "yearly":
			return "Yearly";
		case "days":
			return `Every ${payment.everyDays} days`;
	}
}

/** What `payment` costs in a month on average: its amount scaled from its period to a month. */
export function monthlyCost(payment: RecurringPayment): number {
	switch (payment.cadence) {
		case "weekly":
			return Math.round((payment.amountMinor * 52) / 12);
		case "monthly":
			return payment.amountMinor;
		case "quarterly":
			return Math.round(payment.amountMinor / 3);
		case "yearly":
			return Math.round(payment.amountMinor / 12);
		case "days":
			return Math.round(
				(payment.amountMinor * 365) / 12 / Math.max(1, payment.everyDays),
			);
	}
}
