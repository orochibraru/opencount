import { describe, expect, test } from "bun:test";

import { bucketOf, periodRange, summarize } from "#lib/analytics.js";
import { categoryOf, categoryOptions } from "#lib/categories.js";
import { nextOccurrence } from "#lib/recurrence.js";
import { guessCategory } from "#lib/smart-category.js";
import { tesseractLanguageName } from "#lib/tesseract-languages.js";

describe("periods", () => {
	test("each period covers the right days and bucket", () => {
		expect(periodRange("month", "2026-10-26", undefined)).toEqual({
			from: "2026-10-01",
			to: "2026-10-26",
			bucket: "day",
		});
		expect(periodRange("last-month", "2026-03-15", undefined)).toEqual({
			from: "2026-02-01",
			to: "2026-02-28",
			bucket: "day",
		});
		expect(periodRange("quarter", "2026-01-10", undefined)).toMatchObject({
			from: "2025-11-01",
			bucket: "week",
		});
		expect(periodRange("year", "2026-10-26", undefined).from).toBe(
			"2026-01-01",
		);
		expect(periodRange("all", "2026-10-26", "2024-05-02").from).toBe(
			"2024-05-02",
		);
		expect(periodRange("all", "2026-10-26", undefined).from).toBe("2026-10-26");
	});

	test("weeks start on Monday", () => {
		expect(bucketOf("2026-10-25", "week")).toBe("2026-10-19");
		expect(bucketOf("2026-10-26", "week")).toBe("2026-10-26");
		expect(bucketOf("2026-10-26", "month")).toBe("2026-10");
		expect(bucketOf("2026-10-26", "day")).toBe("2026-10-26");
	});
});

describe("summarize", () => {
	const expenses = [
		{
			category: "food",
			merchantId: "port",
			paidBy: "ada",
			amountMinor: 4000,
			spentOn: "2026-10-03",
			shares: [
				{ memberId: "ada", amountMinor: 2000 },
				{ memberId: "grace", amountMinor: 2000 },
			],
		},
		{
			category: "transport",
			merchantId: null,
			paidBy: "grace",
			amountMinor: 1500,
			spentOn: "2026-10-03",
			shares: [{ memberId: "grace", amountMinor: 1500 }],
		},
		{
			category: "food",
			merchantId: "port",
			paidBy: "ada",
			amountMinor: 999,
			spentOn: "2026-09-30",
			shares: [{ memberId: "ada", amountMinor: 999 }],
		},
	];

	test("sums the period only, by bucket, category, merchant and payer", () => {
		const summary = summarize(
			expenses,
			{ from: "2026-10-01", to: "2026-10-05", bucket: "day" },
			"ada",
		);
		expect(summary).toMatchObject({
			totalMinor: 5500,
			myShareMinor: 2000,
			count: 2,
			byCategory: [
				{ key: "food", totalMinor: 4000 },
				{ key: "transport", totalMinor: 1500 },
			],
			byMerchant: [{ key: "port", totalMinor: 4000 }],
			byPayer: [
				{ key: "ada", totalMinor: 4000 },
				{ key: "grace", totalMinor: 1500 },
			],
		});
		expect(summary.overTime).toEqual([
			{ key: "2026-10-01", totalMinor: 0 },
			{ key: "2026-10-02", totalMinor: 0 },
			{ key: "2026-10-03", totalMinor: 5500 },
			{ key: "2026-10-04", totalMinor: 0 },
			{ key: "2026-10-05", totalMinor: 0 },
		]);
	});

	test("buckets by week and month without gaps", () => {
		const weekly = summarize(
			expenses,
			{ from: "2026-09-28", to: "2026-10-12", bucket: "week" },
			null,
		);
		expect(weekly.overTime.map((entry) => entry.key)).toEqual([
			"2026-09-28",
			"2026-10-05",
			"2026-10-12",
		]);
		expect(weekly.overTime[0]?.totalMinor).toBe(6499);
		expect(weekly.myShareMinor).toBe(0);
		const monthly = summarize(
			expenses,
			{ from: "2026-08-15", to: "2026-10-26", bucket: "month" },
			"ada",
		);
		expect(monthly.overTime).toEqual([
			{ key: "2026-08", totalMinor: 0 },
			{ key: "2026-09", totalMinor: 999 },
			{ key: "2026-10", totalMinor: 5500 },
		]);
	});
});

describe("nextOccurrence", () => {
	test("monthly rules keep their day, clamped to short months", () => {
		expect(nextOccurrence("2026-01-31", "monthly", 31)).toBe("2026-02-28");
		expect(nextOccurrence("2026-02-28", "monthly", 31)).toBe("2026-03-31");
		expect(nextOccurrence("2026-12-15", "monthly", 15)).toBe("2027-01-15");
	});

	test("yearly rules survive leap days and weekly ones add seven days", () => {
		expect(nextOccurrence("2024-02-29", "yearly", 29)).toBe("2025-02-28");
		expect(nextOccurrence("2027-02-28", "yearly", 29)).toBe("2028-02-29");
		expect(nextOccurrence("2026-12-29", "weekly", 29)).toBe("2027-01-05");
	});
});

describe("guessCategory", () => {
	test("finds built-in categories in English and French, accents or not", () => {
		expect(guessCategory("Dîner au port")).toBe("food");
		expect(guessCategory("Uber Eats order")).toBe("food");
		expect(guessCategory("Uber to the airport")).toBe("transport");
		expect(guessCategory("Croquettes Saïko")).toBe("pets");
		expect(guessCategory("Bières Viking")).toBe("food");
		expect(guessCategory("Yt premium")).toBe("subscriptions");
		expect(guessCategory("Leroy Merlin escalier")).toBe("home");
		expect(guessCategory("Coiffeur")).toBe("care");
		expect(guessCategory("Apotheke am Markt")).toBe("health");
		expect(guessCategory("Supermercado Día")).toBe("groceries");
		expect(guessCategory("Plaquettes Mazda")).toBe("transport");
		expect(guessCategory("Concert Muse")).toBe("culture");
		expect(guessCategory("Livres")).toBe("culture");
		expect(guessCategory("Guitare")).toBe("culture");
		expect(guessCategory("Courses Carrefour")).toBe("groceries");
		expect(guessCategory("Hôtel Ibis")).toBe("lodging");
		expect(guessCategory("Frais bancaires")).toBe("finance");
		expect(guessCategory("Retrait DAB 12/10")).toBe("finance");
		expect(guessCategory("Assurance vie")).toBe("finance");
		expect(guessCategory("Assurance habitation")).toBe("bills");
		expect(guessCategory("Überweisung an Max")).toBe("finance");
		expect(guessCategory("Trade Republic")).toBe("finance");
		expect(guessCategory("Amende ANTAI excès de vitesse")).toBe("taxes");
		expect(guessCategory("Parking ticket Camden")).toBe("taxes");
		expect(guessCategory("Impôts DGFIP")).toBe("taxes");
		expect(guessCategory("Bußgeld")).toBe("taxes");
		expect(guessCategory("Taxi Paris")).toBe("transport");
		expect(guessCategory("Something else")).toBeUndefined();
	});

	test("matches whole words only", () => {
		expect(guessCategory("Barcelona")).toBeUndefined();
		expect(guessCategory("Cocktail bar")).toBe("food");
	});

	test("a group's own categories win over built-in keywords", () => {
		const custom = [
			{ id: "rent", name: "Rent", icon: "house" },
			{ id: "empty", name: " ", icon: "tag" },
		];
		expect(guessCategory("March rent", custom)).toBe("rent");
		expect(guessCategory("Car rental", custom)).toBe("transport");
	});
});

describe("categories", () => {
	const custom = [
		{ id: "kids", name: "Kids", icon: "baby" },
		{ id: "odd", name: "Odd", icon: "unknown" },
	];

	test("built-in, custom and unknown categories resolve", () => {
		expect(categoryOf("food").label).toBe("Food & drinks");
		expect(categoryOf("kids", custom).label).toBe("Kids");
		expect(categoryOf("odd", custom).icon).toBeDefined();
		expect(categoryOf("gone", custom).value).toBe("other");
		expect(categoryOptions(custom).map((option) => option.value)).toEqual([
			"food",
			"groceries",
			"transport",
			"lodging",
			"activities",
			"shopping",
			"bills",
			"home",
			"health",
			"pets",
			"subscriptions",
			"care",
			"education",
			"culture",
			"finance",
			"taxes",
			"income",
			"other",
			"kids",
			"odd",
		]);
	});
});

describe("tesseractLanguageName", () => {
	test("names codes, variants and Tesseract's special packs", () => {
		expect(tesseractLanguageName("fra", "en")).toBe("French");
		expect(tesseractLanguageName("chi_sim_vert", "en")).toBe(
			"Chinese (Simplified, vertical)",
		);
		expect(tesseractLanguageName("frk", "en")).toBe("German (Fraktur)");
		expect(tesseractLanguageName("zzz_abc", "en")).toBe("zzz_abc");
		expect(tesseractLanguageName("fra", "not a locale!")).toBe("fra");
	});
});
