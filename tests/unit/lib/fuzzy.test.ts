import { describe, expect, test } from "bun:test";

import { fuzzyMatches } from "#lib/fuzzy.js";

describe("fuzzy search", () => {
	test("matches whatever the case, accents, word order or a typo", () => {
		expect(fuzzyMatches("Adeo*leroy Merlin", "merlin leroy")).toBe(true);
		expect(fuzzyMatches("Adeo*leroy Merlin", "leroymerlin")).toBe(true);
		expect(fuzzyMatches("Crêperie du Port", "creperie")).toBe(true);
		expect(fuzzyMatches("Luigi's Deli", "luigu")).toBe(true);
		expect(fuzzyMatches("Carrefour City", "carefour")).toBe(true);
		expect(fuzzyMatches("Intermarché Super", "intermarhce")).toBe(true);
		expect(fuzzyMatches("To Robo portfolio", "rob")).toBe(true);
		expect(fuzzyMatches("Anything", "")).toBe(true);
	});

	test("doesn't match unrelated words or short typos", () => {
		expect(fuzzyMatches("Carrefour City", "amazon")).toBe(false);
		expect(fuzzyMatches("Uber Eats", "ubr")).toBe(false);
		expect(fuzzyMatches("Leroy Merlin", "leroy amazon")).toBe(false);
	});
});
