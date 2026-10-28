import { describe, expect, test } from "bun:test";

import type { SpendingRow } from "#lib/dto/personal-expense.js";
import { moneyOverview } from "#lib/money-overview.js";

function row(
	spentOn: string,
	description: string,
	amountMinor: number,
	fields: Partial<SpendingRow> = {},
): SpendingRow {
	return {
		description,
		category: "other",
		kind: "expense",
		aside: false,
		amountMinor,
		currency: "EUR",
		spentOn,
		folderId: null,
		bankConnectionId: null,
		bankAccountUid: null,
		...fields,
	};
}

describe("moneyOverview", () => {
	const rows = [
		row("2026-08-05", "Netflix", 1_399, { category: "subscriptions" }),
		row("2026-09-02", "Carrefour City", 2_000, { category: "groceries" }),
		row("2026-09-05", "Netflix", 1_399, { category: "subscriptions" }),
		row("2026-09-08", "Carrefour City", 3_000, { category: "groceries" }),
		row("2026-09-20", "Rent", 80_000, { category: "lodging" }),
		row("2026-10-01", "Salary", 250_000, {
			kind: "income",
			category: "income",
		}),
		row("2026-10-02", "Carrefour city", 2_500, { category: "groceries" }),
		row("2026-10-05", "Netflix", 1_399, { category: "subscriptions" }),
		row("2026-10-06", "To robo portfolio", 1_000, {
			aside: true,
			category: "finance",
		}),
		row("2026-10-09", "Carrefour City", 4_000, { category: "groceries" }),
		row("2026-10-09", "Bakery", 450, { category: "food" }),
		row("2026-10-07", "ECH PRET", 120_000, { category: "finance" }),
		row("2026-10-09", "Dinner", 6_000, { currency: "USD" }),
		row("2026-10-11", "Later", 999),
	];
	const overview = moneyOverview(rows, "2026-10-10");

	test("sums this month's spending, income and savings in the main currency", () => {
		expect(overview.currency).toBe("EUR");
		expect(overview.spentMinor).toBe(2_500 + 1_399 + 4_000 + 450);
		expect(overview.incomeMinor).toBe(250_000);
		expect(overview.asideMinor).toBe(1_000);
		expect(overview.financeMinor).toBe(120_000);
		expect(overview.lastMonthSoFarMinor).toBe(2_000 + 1_399 + 3_000);
		expect(overview.lastMonthMinor).toBe(2_000 + 1_399 + 3_000 + 80_000);
		expect(overview.monthEnd).toBe("2026-10-31");
		expect(overview.forecastMinor).toBeGreaterThan(overview.spentMinor);
	});

	test("reports yesterday, the biggest habit, the top category and repeating payments", () => {
		expect(overview.yesterday).toEqual({
			day: "2026-10-09",
			spentMinor: 4_450,
			count: 2,
			biggest: { description: "Carrefour City", amountMinor: 4_000 },
		});
		expect(overview.habit).toEqual(
			expect.objectContaining({ description: "Carrefour City", count: 4 }),
		);
		expect(overview.topCategory).toEqual({
			category: "groceries",
			totalMinor: 6_500,
			lastMonthMinor: 5_000,
		});
		expect(overview.recurring).toEqual([
			{ description: "Netflix", amountMinor: 1_399 },
		]);
		expect(overview.daily).toHaveLength(10);
		expect(overview.daily.at(-2)).toEqual({
			key: "2026-10-09",
			totalMinor: 4_450,
		});
	});

	test("calls a monthly payment repeating, not a habit", () => {
		const rent = ["2026-08-01", "2026-09-01", "2026-10-01"].map((spentOn) =>
			row(spentOn, "Rent", 80_000),
		);
		const monthly = moneyOverview(rent, "2026-10-10");
		expect(monthly.habit).toBeNull();
		expect(monthly.recurring).toEqual([
			{ description: "Rent", amountMinor: 80_000 },
		]);
	});

	test("a payday month runs from payday, and so does last month's pace", () => {
		const payday = moneyOverview(
			[
				row("2026-09-24", "Before payday", 9_000),
				row("2026-09-26", "Groceries", 3_000),
				row("2026-10-24", "Dinner", 2_000),
				row("2026-10-26", "Bakery", 500),
			],
			"2026-10-27",
			25,
		);
		expect(payday.monthStart).toBe("2026-10-25");
		expect(payday.monthEnd).toBe("2026-11-24");
		expect(payday.spentMinor).toBe(500);
		expect(payday.lastMonthMinor).toBe(3_000 + 2_000);
		expect(payday.lastMonthSoFarMinor).toBe(3_000);
		expect(payday.daily.map((entry) => entry.key)).toEqual([
			"2026-10-25",
			"2026-10-26",
			"2026-10-27",
		]);
	});

	test("has nothing to say about an empty ledger", () => {
		const empty = moneyOverview([], "2026-02-10");
		expect(empty.spentMinor).toBe(0);
		expect(empty.forecastMinor).toBe(0);
		expect(empty.monthEnd).toBe("2026-02-28");
		expect(empty.habit).toBeNull();
		expect(empty.topCategory).toBeNull();
		expect(empty.yesterday.biggest).toBeNull();
	});
});
