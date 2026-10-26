import { describe, expect, test } from "bun:test";

import { computeBalances, settleUp } from "#lib/balances.js";
import { currencyDigits, formatMoney, parseMoney } from "#lib/money.js";
import { splitByWeight } from "#lib/split.js";

describe("money", () => {
	test("parses what people type, per currency", () => {
		expect(parseMoney("12", "EUR")).toBe(1200);
		expect(parseMoney("12,5", "EUR")).toBe(1250);
		expect(parseMoney(" 1 234.56 ", "EUR")).toBe(123_456);
		expect(parseMoney("1200", "JPY")).toBe(1200);
		expect(parseMoney("12.345", "EUR")).toBeUndefined();
		expect(parseMoney("12.5", "JPY")).toBeUndefined();
		expect(parseMoney("abc", "EUR")).toBeUndefined();
		expect(currencyDigits("NOPE")).toBe(2);
	});

	test("formats minor units, signed when asked", () => {
		expect(formatMoney(1250, "EUR")).toContain("12");
		expect(formatMoney(1250, "EUR", { signed: true })).toStartWith("+");
		expect(formatMoney(0, "EUR", { signed: true })).not.toStartWith("+");
	});
});

describe("split", () => {
	test("equal splits hand leftover cents to the first members", () => {
		const parts = splitByWeight(1000, [
			{ memberId: "a", weight: 1 },
			{ memberId: "b", weight: 1 },
			{ memberId: "c", weight: 1 },
		]);
		expect([...parts]).toEqual([
			["a", 334],
			["b", 333],
			["c", 333],
		]);
	});

	test("weights split proportionally and zero weights are left out", () => {
		const parts = splitByWeight(900, [
			{ memberId: "a", weight: 2 },
			{ memberId: "b", weight: 1 },
			{ memberId: "c", weight: 0 },
		]);
		expect(Object.fromEntries(parts)).toEqual({ a: 600, b: 300 });
		expect(splitByWeight(500, [{ memberId: "a", weight: 0 }]).size).toBe(0);
	});
});

describe("balances", () => {
	test("balances sum to zero and settle in few transfers", () => {
		const balances = computeBalances(
			["ada", "bob", "cy"],
			[
				{
					paidBy: "ada",
					amountMinor: 9000,
					shares: [
						{ memberId: "ada", amountMinor: 3000 },
						{ memberId: "bob", amountMinor: 3000 },
						{ memberId: "cy", amountMinor: 3000 },
					],
				},
				{
					paidBy: "bob",
					amountMinor: 3000,
					shares: [
						{ memberId: "bob", amountMinor: 1500 },
						{ memberId: "cy", amountMinor: 1500 },
					],
				},
			],
		);
		expect(Object.fromEntries(balances)).toEqual({
			ada: 6000,
			bob: -1500,
			cy: -4500,
		});
		expect(settleUp(balances)).toEqual([
			{ from: "cy", to: "ada", amountMinor: 4500 },
			{ from: "bob", to: "ada", amountMinor: 1500 },
		]);
		expect(settleUp(new Map([["ada", 0]]))).toEqual([]);
	});
});
