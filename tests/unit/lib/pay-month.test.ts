import { describe, expect, test } from "bun:test";

import {
	monthEndFrom,
	monthLabel,
	monthStartOn,
	shiftMonth,
} from "#lib/pay-month.js";

describe("pay months", () => {
	test("a calendar month starts on the 1st and ends on its last day", () => {
		expect(monthStartOn("2026-10-15")).toBe("2026-10-01");
		expect(monthEndFrom("2026-02-01")).toBe("2026-02-28");
		expect(monthLabel("2026-10-01")).toContain("2026");
	});

	test("a payday month runs from payday to the day before the next one", () => {
		expect(monthStartOn("2026-10-25", 25)).toBe("2026-10-25");
		expect(monthStartOn("2026-10-24", 25)).toBe("2026-09-25");
		expect(monthStartOn("2026-01-10", 25)).toBe("2025-12-25");
		expect(monthEndFrom("2026-10-25")).toBe("2026-11-24");
		expect(shiftMonth("2026-12-25", 1)).toBe("2027-01-25");
		expect(shiftMonth("2026-01-25", -1)).toBe("2025-12-25");
		expect(monthLabel("2026-10-25")).toContain("–");
	});
});
