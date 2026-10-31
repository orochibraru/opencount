import { describe, expect, test } from "bun:test";

import {
	alternatives,
	appendSources,
	knownValues,
	sourceValues,
	toggled,
} from "#lib/filter-params.js";

describe("filter params", () => {
	test("keeps only known repeated values, once each", () => {
		const url = new URL(
			"https://example.test/?category=food&category=nope&category=food&category=travel",
		);
		expect(knownValues(url, "category", ["travel", "food", "home"])).toEqual([
			"travel",
			"food",
		]);
		expect(knownValues(url, "merchant", ["lidl"])).toEqual([]);
	});

	test("toggles a value in and out", () => {
		expect(toggled(["food"], "travel")).toEqual(["food", "travel"]);
		expect(toggled(["food", "travel"], "food")).toEqual(["travel"]);
	});

	test("round-trips banks and accounts through the source values", () => {
		const params = new URLSearchParams();
		appendSources(params, sourceValues(["b1", "b2"], ["a1"]));
		expect(params.toString()).toBe("bank=b1&bank=b2&account=a1");
	});

	test("reads labels as alternatives", () => {
		expect(alternatives([])).toBe("");
		expect(alternatives(["Food"])).toBe("Food");
		expect(alternatives(["Food", "Travel"])).toBe("Food or Travel");
		expect(alternatives(["Food", "Travel", "Home"])).toBe(
			"Food, Travel or Home",
		);
	});
});
