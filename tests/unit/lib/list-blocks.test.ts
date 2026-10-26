import { describe, expect, test } from "bun:test";

import { listBlocks } from "#lib/list-blocks.js";

describe("listBlocks", () => {
	const entries = ["a1", "a2", "a3", "b1"];
	const day = (entry: string) => entry.slice(0, 1);

	test("groups consecutive entries with one heading each", () => {
		expect(
			listBlocks(entries, day).map((block) => [block.group, block.entries]),
		).toEqual([
			["a", ["a1", "a2", "a3"]],
			["b", ["b1"]],
		]);
	});

	test("splits a group where newly loaded entries begin, without a second heading", () => {
		expect(
			listBlocks(entries, day, 2).map((block) => ({
				entries: block.entries,
				heading: block.heading,
				loadedFromHere: block.loadedFromHere,
			})),
		).toEqual([
			{ entries: ["a1", "a2"], heading: true, loadedFromHere: false },
			{ entries: ["a3"], heading: false, loadedFromHere: true },
			{ entries: ["b1"], heading: true, loadedFromHere: false },
		]);
		expect(listBlocks(entries, day, 0)[0]?.loadedFromHere).toBe(false);
	});
});

describe("similarKey", () => {
	test("spells the same thing the same way", async () => {
		const { similarKey } = await import("#lib/similar-key.js");
		expect(similarKey("Sergio")).toBe("sergio");
		expect(similarKey("Sergios")).toBe("sergio");
		expect(similarKey("Sergio's")).toBe("sergio");
		expect(similarKey("  BIÈRES   Viking! ")).toBe("biere viking");
		expect(similarKey("bière viking")).toBe("biere viking");
		expect(similarKey("?")).toBe("");
	});
});
