import { describe, expect, test } from "bun:test";

import {
	cadenceLabel,
	endAfter,
	monthlyCost,
	type RecurringLine,
	recurringSchedule,
	type SeriesSettings,
} from "#lib/recurring-schedule.js";

function series(fields: Partial<SeriesSettings> = {}): SeriesSettings {
	return {
		id: "loan",
		label: "Car loan",
		type: "loan",
		frequency: null,
		endDate: null,
		...fields,
	};
}

function line(spentOn: string, fields: Partial<RecurringLine> = {}) {
	return {
		seriesId: "loan",
		kind: "expense" as const,
		amountMinor: 30_000,
		currency: "EUR",
		spentOn,
		accountUid: "main",
		...fields,
	};
}

describe("recurring schedule", () => {
	test("reads a monthly series from its lines and says when it comes next", () => {
		const [loan] = recurringSchedule(
			[series()],
			[line("2026-08-05"), line("2026-09-05"), line("2026-10-06")],
			"2026-10-20",
		);
		expect(loan).toEqual(
			expect.objectContaining({
				cadence: "monthly",
				lastOn: "2026-10-06",
				nextOn: "2026-11-06",
				amountMinor: 30_000,
				accountUid: "main",
				remaining: null,
				duplicate: false,
				ended: false,
			}),
		);
		expect(cadenceLabel(loan!)).toBe("Monthly");
		expect(monthlyCost(loan!)).toBe(30_000);
	});

	test("counts the payments left until its end date and ends after it", () => {
		const lines = [line("2026-09-05"), line("2026-10-05")];
		const [loan] = recurringSchedule(
			[series({ endDate: "2027-01-05" })],
			lines,
			"2026-10-20",
		);
		expect(loan?.remaining).toBe(3);
		const [over] = recurringSchedule(
			[series({ endDate: "2026-10-05" })],
			lines,
			"2026-10-20",
		);
		expect(over).toEqual(
			expect.objectContaining({ ended: true, nextOn: null, remaining: 0 }),
		);
		expect(endAfter("2026-11-05", 3, "monthly", 30)).toBe("2027-01-05");
	});

	test("takes a set frequency over the gaps, and flags a double charge", () => {
		const [weekly] = recurringSchedule(
			[series({ frequency: "weekly" })],
			[line("2026-10-01")],
			"2026-10-03",
		);
		expect(weekly?.nextOn).toBe("2026-10-08");
		const [twice] = recurringSchedule(
			[series({ type: "subscription" })],
			[line("2026-09-01"), line("2026-10-01"), line("2026-10-03")],
			"2026-10-05",
		);
		expect(twice?.duplicate).toBe(true);
	});

	test("lists series soonest first and ended ones last", () => {
		const payments = recurringSchedule(
			[
				series({ id: "old", label: "Old", endDate: "2026-01-01" }),
				series({ id: "late", label: "Late" }),
				series({ id: "soon", label: "Soon" }),
			],
			[
				line("2025-12-01", { seriesId: "old" }),
				line("2026-10-25", { seriesId: "late" }),
				line("2026-10-10", { seriesId: "soon" }),
			],
			"2026-10-26",
		);
		expect(payments.map((payment) => payment.label)).toEqual([
			"Soon",
			"Late",
			"Old",
		]);
	});
});
