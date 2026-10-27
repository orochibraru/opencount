import type { SpendingRow } from "#lib/dto/personal-expense.js";
import { monthEndFrom, monthStartOn, shiftMonth } from "#lib/pay-month.js";
import { similarKey } from "#lib/similar-key.js";

export interface MoneyOverview {
	currency: string;
	today: string;
	monthStart: string;
	spentMinor: number;
	incomeMinor: number;
	asideMinor: number;
	lastMonthSoFarMinor: number;
	forecastMinor: number;
	lastMonthMinor: number;
	monthEnd: string;
	yesterday: {
		day: string;
		spentMinor: number;
		count: number;
		biggest: { description: string; amountMinor: number } | null;
	};
	habit: {
		description: string;
		totalMinor: number;
		count: number;
		weeklyMinor: number;
	} | null;
	topCategory: {
		category: string;
		totalMinor: number;
		lastMonthMinor: number;
	} | null;
	recurring: { description: string; amountMinor: number }[];
	daily: { key: string; totalMinor: number }[];
}

const habitWindowDays = 90;
const recurringWindowDays = 100;

function utc(day: string): Date {
	return new Date(`${day}T00:00:00Z`);
}

function shift(day: string, days: number): string {
	const date = utc(day);
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
	return Math.round((utc(to).getTime() - utc(from).getTime()) / 86_400_000);
}

function sum(rows: SpendingRow[]): number {
	return rows.reduce((total, row) => total + row.amountMinor, 0);
}

function mainCurrency(rows: SpendingRow[]): string {
	const totals = new Map<string, number>();
	for (const row of rows) {
		totals.set(row.currency, (totals.get(row.currency) ?? 0) + row.amountMinor);
	}
	return (
		[...totals].toSorted((left, right) => right[1] - left[1])[0]?.[0] ?? "EUR"
	);
}

function byKey(rows: SpendingRow[]): Map<string, SpendingRow[]> {
	const groups = new Map<string, SpendingRow[]>();
	for (const row of rows) {
		const key = similarKey(row.description);
		if (key !== "") {
			groups.set(key, [...(groups.get(key) ?? []), row]);
		}
	}
	return groups;
}

function recurringPayments(rows: SpendingRow[]): MoneyOverview["recurring"] {
	return [...byKey(rows).values()]
		.flatMap((group) => {
			const latest = group.at(-1);
			const months = new Set(group.map((row) => row.spentOn.slice(0, 7)));
			const steady =
				latest !== undefined &&
				months.size >= 2 &&
				group.length <= months.size + 1 &&
				group.every(
					(row) =>
						Math.abs(row.amountMinor - latest.amountMinor) <=
						latest.amountMinor * 0.05,
				);
			return steady
				? [
						{
							description: latest.description,
							amountMinor: latest.amountMinor,
						},
					]
				: [];
		})
		.toSorted((left, right) => right.amountMinor - left.amountMinor)
		.slice(0, 5);
}

function biggestHabit(
	recent: SpendingRow[],
	observedDays: number,
): MoneyOverview["habit"] {
	return (
		[...byKey(recent).values()]
			.filter(
				(group) =>
					group.length >= 3 &&
					group.length >
						new Set(group.map((row) => row.spentOn.slice(0, 7))).size,
			)
			.map((group) => ({
				description: group.at(-1)?.description ?? "",
				totalMinor: sum(group),
				count: group.length,
				weeklyMinor: Math.round((sum(group) * 7) / observedDays),
			}))
			.toSorted((left, right) => right.totalMinor - left.totalMinor)[0] ?? null
	);
}

function topCategory(
	thisMonth: SpendingRow[],
	lastMonth: SpendingRow[],
): MoneyOverview["topCategory"] {
	const totals = new Map<string, number>();
	for (const row of thisMonth) {
		totals.set(row.category, (totals.get(row.category) ?? 0) + row.amountMinor);
	}
	const top = [...totals].toSorted((left, right) => right[1] - left[1])[0];
	return top
		? {
				category: top[0],
				totalMinor: top[1],
				lastMonthMinor: sum(lastMonth.filter((row) => row.category === top[0])),
			}
		: null;
}

/**
 * Where someone's money stands on `today`, from their personal ledger `rows` (oldest first) in their main currency, with
 * months starting on day `startDay` (payday to payday when not 1):
 * this month's spending, income and savings, a forecast for the month's end, yesterday's report, their biggest habit,
 * their top category, the payments that repeat every month, and spending day by day.
 */
export function moneyOverview(
	rows: SpendingRow[],
	today: string,
	startDay = 1,
): MoneyOverview {
	const currency = mainCurrency(rows);
	const own = rows.filter(
		(row) => row.currency === currency && row.spentOn <= today,
	);
	const spent = own.filter((row) => row.kind === "expense" && !row.aside);
	const monthStart = monthStartOn(today, startDay);
	const elapsedDays = daysBetween(monthStart, today);
	const monthEnd = monthEndFrom(monthStart);
	const lastMonthStart = shiftMonth(monthStart, -1);
	const lastMonthEnd = shift(monthStart, -1);
	const thisMonth = spent.filter((row) => row.spentOn >= monthStart);
	const lastMonth = spent.filter(
		(row) => row.spentOn >= lastMonthStart && row.spentOn <= lastMonthEnd,
	);
	const spentMinor = sum(thisMonth);

	const windowStart = shift(today, -habitWindowDays + 1);
	const firstDay = spent[0]?.spentOn ?? today;
	const observedDays = Math.max(
		1,
		daysBetween(firstDay > windowStart ? firstDay : windowStart, today) + 1,
	);
	const recent = spent.filter((row) => row.spentOn >= windowStart);
	const dailyAverage = sum(recent) / observedDays;
	const forecastMinor = Math.round(
		spentMinor + dailyAverage * daysBetween(today, monthEnd),
	);

	const yesterdayDay = shift(today, -1);
	const yesterdayRows = spent.filter((row) => row.spentOn === yesterdayDay);
	const biggest = yesterdayRows.toSorted(
		(left, right) => right.amountMinor - left.amountMinor,
	)[0];

	const daily = new Map<string, number>();
	for (let day = monthStart; day <= today; day = shift(day, 1)) {
		daily.set(day, 0);
	}
	for (const row of thisMonth) {
		daily.set(row.spentOn, (daily.get(row.spentOn) ?? 0) + row.amountMinor);
	}

	return {
		currency,
		today,
		monthStart,
		spentMinor,
		incomeMinor: sum(
			own.filter(
				(row) =>
					row.kind === "income" && !row.aside && row.spentOn >= monthStart,
			),
		),
		asideMinor: sum(
			own.filter(
				(row) =>
					row.kind === "expense" && row.aside && row.spentOn >= monthStart,
			),
		),
		lastMonthSoFarMinor: sum(
			lastMonth.filter(
				(row) => daysBetween(lastMonthStart, row.spentOn) <= elapsedDays,
			),
		),
		forecastMinor,
		lastMonthMinor: sum(lastMonth),
		monthEnd,
		yesterday: {
			day: yesterdayDay,
			spentMinor: sum(yesterdayRows),
			count: yesterdayRows.length,
			biggest: biggest
				? {
						description: biggest.description,
						amountMinor: biggest.amountMinor,
					}
				: null,
		},
		habit: biggestHabit(recent, observedDays),
		topCategory: topCategory(thisMonth, lastMonth),
		recurring: recurringPayments(
			spent.filter(
				(row) => row.spentOn >= shift(today, -recurringWindowDays + 1),
			),
		),
		daily: [...daily].map(([key, totalMinor]) => ({ key, totalMinor })),
	};
}
