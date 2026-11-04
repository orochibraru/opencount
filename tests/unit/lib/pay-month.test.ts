import { describe, expect, test } from "bun:test";

import { MonthCalendar } from "#lib/pay-month.js";

describe("pay months", () => {
	test("a calendar month starts on the 1st and ends on its last day", () => {
		const calendar = new MonthCalendar();
		expect(calendar.startOf("2026-10-15")).toBe("2026-10-01");
		expect(calendar.endOf("2026-02-01")).toBe("2026-02-28");
		expect(calendar.label("2026-10-01")).toContain("2026");
	});

	test("a payday month runs from payday to the day before the next one", () => {
		const calendar = new MonthCalendar({ startDay: 25 });
		expect(calendar.startOf("2026-10-25")).toBe("2026-10-25");
		expect(calendar.startOf("2026-10-24")).toBe("2026-09-25");
		expect(calendar.startOf("2026-01-10")).toBe("2025-12-25");
		expect(calendar.endOf("2026-10-25")).toBe("2026-11-24");
		expect(calendar.next("2026-12-25")).toBe("2027-01-25");
		expect(calendar.previous("2026-01-25")).toBe("2025-12-25");
		expect(calendar.label("2026-10-25", "2026-11-01")).not.toContain("2026");
		expect(
			calendar.label("2025-09-25", "2026-11-01").match(/2025/g),
		).toHaveLength(1);
		const acrossYears = calendar.label("2025-12-25", "2026-11-01");
		expect(acrossYears).toContain("2025");
		expect(acrossYears).toContain("2026");
	});

	test("months follow the days the pay actually came in", () => {
		const calendar = new MonthCalendar({
			startDay: 1,
			paydays: ["2026-08-28", "2026-09-25", "2026-09-30", "2026-10-23"],
		});
		expect(calendar.followsPay).toBe(true);
		expect(calendar.startOf("2026-09-24")).toBe("2026-08-28");
		expect(calendar.startOf("2026-10-01")).toBe("2026-09-25");
		expect(calendar.endOf("2026-09-25")).toBe("2026-10-22");
		expect(calendar.startOf("2026-11-04")).toBe("2026-10-23");
		expect(calendar.startOf("2026-11-23")).toBe("2026-11-23");
		expect(calendar.startOf("2026-08-01")).toBe("2026-07-28");
		expect(calendar.previous("2026-10-23")).toBe("2026-09-25");
	});

	test("a missing payday is filled in on the same day of the month", () => {
		const calendar = new MonthCalendar({
			paydays: ["2026-01-31", "2026-04-30"],
		});
		expect(calendar.startOf("2026-03-15")).toBe("2026-02-28");
		expect(calendar.startOf("2026-04-10")).toBe("2026-03-31");
		expect(calendar.startOf("2026-04-30")).toBe("2026-04-30");
	});
});
