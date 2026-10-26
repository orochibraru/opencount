export const periods = [
	"month",
	"last-month",
	"quarter",
	"year",
	"all",
] as const;

export type Period = (typeof periods)[number];

export const periodLabels: Record<Period, string> = {
	month: "This month",
	"last-month": "Last month",
	quarter: "3 months",
	year: "This year",
	all: "All time",
};

export type Bucket = "day" | "week" | "month";

export interface AnalyticsExpense {
	category: string;
	merchantId: string | null;
	paidBy: string;
	amountMinor: number;
	spentOn: string;
	shares: { memberId: string; amountMinor: number }[];
}

export interface Summary {
	from: string;
	to: string;
	bucket: Bucket;
	totalMinor: number;
	myShareMinor: number;
	count: number;
	overTime: { key: string; totalMinor: number }[];
	byCategory: { key: string; totalMinor: number }[];
	byMerchant: { key: string; totalMinor: number }[];
	byPayer: { key: string; totalMinor: number }[];
}

function utcDate(day: string): Date {
	return new Date(`${day}T00:00:00Z`);
}

function isoDay(date: Date): string {
	return date.toISOString().slice(0, 10);
}

function addDays(day: string, days: number): string {
	const date = utcDate(day);
	date.setUTCDate(date.getUTCDate() + days);
	return isoDay(date);
}

function monthStart(day: string, monthsBack = 0): string {
	const date = utcDate(day);
	return isoDay(
		new Date(
			Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - monthsBack, 1),
		),
	);
}

/** The first and last day (inclusive, YYYY-MM-DD) of `period` as seen on `today`, and how to bucket it over time. */
export function periodRange(
	period: Period,
	today: string,
	earliest: string | undefined,
): { from: string; to: string; bucket: Bucket } {
	switch (period) {
		case "month":
			return { from: monthStart(today), to: today, bucket: "day" };
		case "last-month":
			return {
				from: monthStart(today, 1),
				to: addDays(monthStart(today), -1),
				bucket: "day",
			};
		case "quarter":
			return { from: monthStart(today, 2), to: today, bucket: "week" };
		case "year":
			return { from: `${today.slice(0, 4)}-01-01`, to: today, bucket: "month" };
		case "all":
			return {
				from: earliest && earliest < today ? earliest : today,
				to: today,
				bucket: "month",
			};
	}
}

/** The bucket `day` falls in: the day itself, the Monday starting its week, or its month. */
export function bucketOf(day: string, bucket: Bucket): string {
	if (bucket === "day") {
		return day;
	}
	if (bucket === "month") {
		return day.slice(0, 7);
	}
	const weekday = (utcDate(day).getUTCDay() + 6) % 7;
	return addDays(day, -weekday);
}

function bucketsBetween(from: string, to: string, bucket: Bucket): string[] {
	const keys: string[] = [];
	let cursor = bucketOf(from, bucket);
	const last = bucketOf(to, bucket);
	while (cursor <= last) {
		keys.push(cursor);
		cursor =
			bucket === "day"
				? addDays(cursor, 1)
				: bucket === "week"
					? addDays(cursor, 7)
					: monthStart(`${cursor}-01`, -1).slice(0, 7);
	}
	return keys;
}

function ranked(totals: Map<string, number>): Summary["byCategory"] {
	return [...totals]
		.map(([key, totalMinor]) => ({ key, totalMinor }))
		.toSorted((left, right) => right.totalMinor - left.totalMinor);
}

function add(totals: Map<string, number>, key: string, amount: number): void {
	totals.set(key, (totals.get(key) ?? 0) + amount);
}

/**
 * Sums `expenses` spent between `range.from` and `range.to`: the total, `memberId`'s share, every bucket over time
 * (empty ones included, so gaps show) and the totals by category, merchant and payer, largest first.
 */
export function summarize(
	expenses: AnalyticsExpense[],
	range: { from: string; to: string; bucket: Bucket },
	memberId: string | null,
): Summary {
	const inRange = expenses.filter(
		(entry) => entry.spentOn >= range.from && entry.spentOn <= range.to,
	);
	const overTime = new Map(
		bucketsBetween(range.from, range.to, range.bucket).map((key) => [key, 0]),
	);
	const byCategory = new Map<string, number>();
	const byMerchant = new Map<string, number>();
	const byPayer = new Map<string, number>();
	let myShareMinor = 0;
	for (const entry of inRange) {
		add(overTime, bucketOf(entry.spentOn, range.bucket), entry.amountMinor);
		add(byCategory, entry.category, entry.amountMinor);
		if (entry.merchantId) {
			add(byMerchant, entry.merchantId, entry.amountMinor);
		}
		add(byPayer, entry.paidBy, entry.amountMinor);
		myShareMinor +=
			entry.shares.find((share) => share.memberId === memberId)?.amountMinor ??
			0;
	}
	return {
		...range,
		totalMinor: inRange.reduce((sum, entry) => sum + entry.amountMinor, 0),
		myShareMinor,
		count: inRange.length,
		overTime: [...overTime].map(([key, totalMinor]) => ({ key, totalMinor })),
		byCategory: ranked(byCategory),
		byMerchant: ranked(byMerchant).slice(0, 8),
		byPayer: ranked(byPayer),
	};
}
