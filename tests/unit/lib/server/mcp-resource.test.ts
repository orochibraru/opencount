import { describe, expect, test } from "bun:test";

import { mcpResource } from "#lib/server/auth.js";

describe("mcpResource", () => {
	test("serves AI apps over HTTPS, or localhost while developing", () => {
		expect(mcpResource("https://money.example")).toBe(
			"https://money.example/mcp",
		);
		expect(mcpResource("http://localhost:5173")).toBe(
			"http://localhost:5173/mcp",
		);
		expect(mcpResource("http://192.168.1.20:3000")).toBeUndefined();
		expect(mcpResource(undefined)).toBeUndefined();
	});
});
