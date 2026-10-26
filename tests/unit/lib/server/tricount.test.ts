import { afterEach, describe, expect, spyOn, test } from "bun:test";

import {
	fetchTricount,
	importCategory,
	parseTricount,
	TricountError,
	tricountKey,
} from "#lib/server/tricount.js";
import { parseTricountForm } from "#lib/server/validation/tricount.js";

function member(name: string) {
	return { RegistryMembershipNonUser: { alias: { display_name: name } } };
}

function entry(fields: Record<string, unknown>) {
	return {
		RegistryEntry: {
			description: "Dinner",
			date: "2026-03-14 20:15:00.000000",
			type_transaction: "NORMAL",
			category: "UNCATEGORIZED",
			amount: { value: "-30.00", currency: "EUR" },
			membership_owned: member("Ada"),
			allocations: [
				{
					membership: member("Ada"),
					amount: { value: "-10.00", currency: "EUR" },
				},
				{
					membership: member("Bob"),
					amount: { value: "-10.00", currency: "EUR" },
				},
				{
					membership: member("Cy"),
					amount: { value: "-10.00", currency: "EUR" },
				},
			],
			...fields,
		},
	};
}

function registry(entries: unknown[]) {
	return {
		Response: [
			{
				Registry: {
					title: "Lisbon",
					currency: "EUR",
					memberships: [member("Ada"), member("Bob"), member("Cy")],
					all_registry_entry: entries,
				},
			},
		],
	};
}

function form(fields: Record<string, string>): FormData {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		data.set(key, value);
	}
	return data;
}

describe("tricountKey", () => {
	test("takes the key from a link or as typed", () => {
		expect(tricountKey("https://tricount.com/tSharedKey")).toBe("tSharedKey");
		expect(tricountKey("https://tricount.com/en/tSharedKey/")).toBe(
			"tSharedKey",
		);
		expect(tricountKey(" tSharedKey ")).toBe("tSharedKey");
		expect(tricountKey("not a key")).toBeUndefined();
		expect(tricountKey("https://")).toBeUndefined();
	});
});

describe("importCategory", () => {
	test("matches Tricount categories and names, Other otherwise", () => {
		expect(importCategory("RESTAURANTS_BARS")).toBe("food");
		expect(importCategory(null, "GROCERIES")).toBe("groceries");
		expect(importCategory("ACCOMMODATION")).toBe("lodging");
		expect(importCategory("UNCATEGORIZED", "Taxi to the airport")).toBe(
			"transport",
		);
		expect(importCategory("UNCATEGORIZED", "Courses au supermarché")).toBe(
			"groceries",
		);
		expect(importCategory(undefined, "Something")).toBe("other");
	});
});

describe("parseTricount", () => {
	test("reads expenses, payments and incomes with their shares", () => {
		const parsed = parseTricount(
			registry([
				entry({ category: "FOOD_AND_DRINK" }),
				entry({
					description: "",
					type_transaction: "BALANCE",
					amount: { value: "-12.00", currency: "EUR" },
					membership_owned: member("Bob"),
					allocations: [
						{
							membership: member("Ada"),
							amount: { value: "-12.00", currency: "EUR" },
						},
					],
				}),
				entry({
					description: "Deposit back",
					type_transaction: "INCOME",
					amount: { value: "20.00", currency: "EUR" },
					allocations: [
						{
							membership: member("Ada"),
							amount: { value: "10.00", currency: "EUR" },
						},
						{
							membership: member("Bob"),
							amount: { value: "10.00", currency: "EUR" },
						},
					],
				}),
				entry({ status: "DELETED" }),
				entry({ amount: { value: "0.00", currency: "EUR" } }),
				entry({ allocations: [] }),
			]),
		);
		expect(parsed.title).toBe("Lisbon");
		expect(parsed.currency).toBe("EUR");
		expect(parsed.participants).toEqual(["Ada", "Bob", "Cy"]);
		expect(parsed.entries).toEqual([
			{
				kind: "expense",
				description: "Dinner",
				category: "food",
				spentOn: "2026-03-14",
				amountMinor: 3000,
				original: null,
				paidBy: "Ada",
				shares: [
					{ participant: "Ada", amountMinor: 1000 },
					{ participant: "Bob", amountMinor: 1000 },
					{ participant: "Cy", amountMinor: 1000 },
				],
			},
			expect.objectContaining({
				kind: "transfer",
				description: "Payment",
				paidBy: "Bob",
				shares: [{ participant: "Ada", amountMinor: 1200 }],
			}),
			expect.objectContaining({
				kind: "transfer",
				description: "Deposit back",
				amountMinor: 1000,
				paidBy: "Bob",
				shares: [{ participant: "Ada", amountMinor: 1000 }],
			}),
		]);
	});

	test("keeps the original currency and fixes rounding on the first share", () => {
		const [parsed] = parseTricount(
			registry([
				entry({
					amount: { value: "-10.00", currency: "EUR" },
					amount_local: { value: "-11.00", currency: "USD" },
					allocations: [
						{
							membership: member("Ada"),
							amount: { value: "-3.33", currency: "EUR" },
						},
						{
							membership: member("Bob"),
							amount: { value: "-3.33", currency: "EUR" },
						},
						{
							membership: member("Dee"),
							amount: { value: "-3.33", currency: "EUR" },
						},
					],
				}),
			]),
		).entries;
		expect(parsed?.original).toEqual({ currency: "USD", amountMinor: 1100 });
		expect(parsed?.shares.map((share) => share.amountMinor)).toEqual([
			334, 333, 333,
		]);
	});

	test("refuses what isn't a Tricount, or holds nothing", () => {
		expect(() => parseTricount({ hello: "world" })).toThrow(TricountError);
		expect(() => parseTricount(registry([]))).toThrow("no expenses");
	});
});

describe("parseTricountForm", () => {
	const preview = () =>
		parseTricount(
			registry([
				entry({}),
				entry({
					type_transaction: "BALANCE",
					amount: { value: "-5.00", currency: "EUR" },
					membership_owned: member("Bob"),
					allocations: [
						{
							membership: member("Cy"),
							amount: { value: "-5.00", currency: "EUR" },
						},
					],
				}),
				entry({
					amount: { value: "-10.00", currency: "EUR" },
					amount_local: { value: "-1500", currency: "JPY" },
					allocations: [
						{
							membership: member("Bob"),
							amount: { value: "-10.00", currency: "EUR" },
						},
					],
				}),
			]),
		);

	test("maps people to members, merges their shares and drops payments to oneself", () => {
		const parsed = parseTricountForm(
			form({
				data: JSON.stringify(preview()),
				"map:0": "member-ada",
				"map:1": "member-bob",
				"map:2": "member-bob",
			}),
			{ currency: "EUR", memberIds: ["member-ada", "member-bob"] },
		);
		expect(parsed.success).toBe(true);
		if (!parsed.success) {
			return;
		}
		expect(parsed.data.newMembers).toEqual({});
		expect(parsed.data.expenses).toHaveLength(2);
		expect(parsed.data.expenses[0]?.shares).toEqual([
			{ memberId: "member-ada", amountMinor: 1000, weight: 1 },
			{ memberId: "member-bob", amountMinor: 2000, weight: 1 },
		]);
		expect(parsed.data.expenses[1]).toEqual(
			expect.objectContaining({
				originalCurrency: "JPY",
				originalAmountMinor: 1500,
				exchangeRate: 10 / 1500,
			}),
		);
	});

	test("adds people as new members on request", () => {
		const parsed = parseTricountForm(
			form({ data: JSON.stringify(preview()), "map:0": "member-ada" }),
			{ currency: "EUR", memberIds: ["member-ada"] },
		);
		expect(parsed.success && parsed.data.newMembers).toEqual({
			"new:1": "Bob",
			"new:2": "Cy",
		});
		expect(parsed.success && parsed.data.expenses[1]?.paidBy).toBe("new:1");
	});

	test("refuses another currency, an unknown member or a tampered preview", () => {
		const data = JSON.stringify(preview());
		expect(
			parseTricountForm(form({ data }), { currency: "USD", memberIds: [] })
				.success,
		).toBe(false);
		expect(
			parseTricountForm(form({ data, "map:0": "stranger" }), {
				currency: "EUR",
				memberIds: [],
			}).success,
		).toBe(false);
		expect(
			parseTricountForm(form({ data: "{" }), { currency: "EUR", memberIds: [] })
				.success,
		).toBe(false);
		const tampered = preview();
		tampered.entries[0]?.shares.push({ participant: "Ada", amountMinor: 1 });
		expect(
			parseTricountForm(form({ data: JSON.stringify(tampered) }), {
				currency: "EUR",
				memberIds: [],
			}).success,
		).toBe(false);
	});
});

describe("fetchTricount", () => {
	afterEach(() => {
		spyOn(globalThis, "fetch").mockRestore();
	});

	test("opens an anonymous session, then reads the registry", async () => {
		const fetched = spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(
				Response.json({
					Response: [
						{ Token: { token: "session" } },
						{ UserPerson: { id: 42 } },
					],
				}),
			)
			.mockResolvedValueOnce(Response.json(registry([entry({})])));
		expect(parseTricount(await fetchTricount("tSharedKey")).title).toBe(
			"Lisbon",
		);
		const registryUrl = new URL(String(fetched.mock.calls[1]?.[0]));
		expect(registryUrl.pathname).toBe("/v1/user/42/registry");
		expect(registryUrl.searchParams.get("public_identifier_token")).toBe(
			"tSharedKey",
		);
	});

	test("says so when Tricount refuses", async () => {
		spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response("nope", { status: 500 }),
		);
		await expect(fetchTricount("tSharedKey")).rejects.toThrow(TricountError);
	});

	test("says so when the link is unknown", async () => {
		spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(
				Response.json({
					Response: [
						{ Token: { token: "session" } },
						{ UserPerson: { id: 1 } },
					],
				}),
			)
			.mockResolvedValueOnce(new Response("", { status: 404 }));
		await expect(fetchTricount("tSharedKey")).rejects.toThrow("doesn't know");
	});
});
