import { describe, expect, test } from "bun:test";

import { spendingKind } from "#lib/spending-kind.js";

describe("spendingKind", () => {
	test("keeps Finance, savings and income apart from spending", () => {
		expect(
			spendingKind({ kind: "expense", aside: false, category: "food" }),
		).toBe("spent");
		expect(
			spendingKind({ kind: "expense", aside: false, category: "finance" }),
		).toBe("finance");
		expect(
			spendingKind({ kind: "expense", aside: true, category: "finance" }),
		).toBe("aside");
		expect(
			spendingKind({ kind: "income", aside: false, category: "income" }),
		).toBe("income");
		expect(
			spendingKind({ kind: "income", aside: true, category: "finance" }),
		).toBeUndefined();
	});
});
