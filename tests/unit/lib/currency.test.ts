import { afterEach, describe, expect, spyOn, test } from "bun:test";

import { convertMinor, minorToDecimal } from "#lib/money.js";
import { exchangeRate } from "#lib/server/exchange-rates.js";
import { parseExpenseForm } from "#lib/server/validation/expense.js";

function form(fields: Record<string, string | string[]>): FormData {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		for (const item of [value].flat()) {
			data.append(key, item);
		}
	}
	return data;
}

const context = {
	currency: "EUR",
	memberIds: ["ada", "bob", "cy"],
	categories: ["other"],
};

const base = {
	description: "Taxi",
	paidBy: "ada",
	spentOn: "2026-03-01",
	participants: ["ada", "bob", "cy"],
};

describe("money conversions", () => {
	test("convertMinor scales by the rate and the currencies' digits", () => {
		expect(convertMinor(1100, "USD", "EUR", 0.9)).toBe(990);
		expect(convertMinor(1500, "JPY", "EUR", 0.0062)).toBe(930);
		expect(convertMinor(930, "EUR", "JPY", 1 / 0.0062)).toBe(1500);
	});

	test("minorToDecimal writes the currency's digits", () => {
		expect(minorToDecimal(1250, "EUR")).toBe("12.50");
		expect(minorToDecimal(1500, "JPY")).toBe("1500");
	});
});

describe("parseExpenseForm in another currency", () => {
	test("converts the total and keeps the original", () => {
		const parsed = parseExpenseForm(
			form({ ...base, amount: "11", currency: "USD", exchangeRate: "0,9" }),
			context,
		);
		expect(parsed.success && parsed.data).toEqual(
			expect.objectContaining({
				amountMinor: 990,
				originalCurrency: "USD",
				originalAmountMinor: 1100,
				exchangeRate: 0.9,
			}),
		);
		expect(
			parsed.success &&
				parsed.data.shares.reduce(
					(total, share) => total + share.amountMinor,
					0,
				),
		).toBe(990);
	});

	test("converts exact amounts and gives the rounding to the first person", () => {
		const parsed = parseExpenseForm(
			form({
				...base,
				amount: "10",
				currency: "USD",
				exchangeRate: "0.333",
				splitMode: "exact",
				"exact:ada": "3.34",
				"exact:bob": "3.33",
				"exact:cy": "3.33",
			}),
			context,
		);
		expect(parsed.success && parsed.data.amountMinor).toBe(333);
		expect(
			parsed.success && parsed.data.shares.map((share) => share.amountMinor),
		).toEqual([111, 111, 111]);
	});

	test("asks for a usable rate and a total that survives conversion", () => {
		expect(
			parseExpenseForm(
				form({ ...base, amount: "11", currency: "USD" }),
				context,
			),
		).toEqual({
			success: false,
			errors: { exchangeRate: ["Enter the exchange rate."] },
		});
		expect(
			parseExpenseForm(
				form({ ...base, amount: "1", currency: "JPY", exchangeRate: "0.001" }),
				context,
			),
		).toEqual({
			success: false,
			errors: { amount: ["That's less than the smallest EUR amount."] },
		});
	});

	test("stays in the group's currency without one", () => {
		const parsed = parseExpenseForm(form({ ...base, amount: "12" }), context);
		expect(parsed.success && parsed.data.originalCurrency).toBeUndefined();
		expect(parsed.success && parsed.data.amountMinor).toBe(1200);
	});
});

const runs = globalThis as unknown as { __rateTestRuns?: number };

describe("exchangeRate", () => {
	afterEach(() => {
		spyOn(globalThis, "fetch").mockRestore();
	});

	test("asks Frankfurter once per pair and day", async () => {
		const fetched = spyOn(globalThis, "fetch").mockResolvedValue(
			Response.json({ rates: { EUR: 0.92 } }),
		);
		runs.__rateTestRuns = (runs.__rateTestRuns ?? 0) + 1;
		const day = `2026-04-${String(runs.__rateTestRuns).padStart(2, "0")}`;
		expect(await exchangeRate("USD", "EUR", day)).toBe(0.92);
		expect(await exchangeRate("USD", "EUR", day)).toBe(0.92);
		expect(fetched).toHaveBeenCalledTimes(1);
	});

	test("answers nothing when the service fails", async () => {
		spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("down", { status: 503 }),
		);
		expect(await exchangeRate("GBP", "EUR", "2026-03-02")).toBeUndefined();
	});
});

describe("parsePersonalForm", () => {
	test("takes the amount in the expense's own currency", async () => {
		const { parsePersonalForm } =
			await import("#lib/server/validation/personal.js");
		expect(
			parsePersonalForm(
				form({
					description: "Book",
					amount: "1500",
					currency: "JPY",
					category: "shopping",
					spentOn: "2026-10-01",
				}),
			),
		).toEqual({
			success: true,
			data: {
				description: "Book",
				amountMinor: 1500,
				currency: "JPY",
				category: "shopping",
				spentOn: "2026-10-01",
			},
		});
		expect(
			parsePersonalForm(
				form({
					description: "Book",
					amount: "0",
					currency: "EUR",
					spentOn: "2026-10-01",
				}),
			),
		).toEqual({
			success: false,
			errors: { amount: ["Enter an amount above zero."] },
		});
		expect(parsePersonalForm(form({ amount: "1" })).success).toBe(false);
	});
});
