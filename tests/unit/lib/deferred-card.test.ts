import { describe, expect, test } from "bun:test";

import { cardRoleOf } from "#lib/deferred-card.js";
import { flowOf } from "#lib/spending-kind.js";

describe("deferred card", () => {
	test("tells a statement from a purchase from anything else", () => {
		expect(cardRoleOf("RELEVE CARTE")).toBe("statement");
		expect(cardRoleOf("Relevé de carte 10/2026")).toBe("statement");
		expect(cardRoleOf("DEBIT CARTE DIFFERE")).toBe("statement");
		expect(cardRoleOf("BAKERY CARTE 1234")).toBe("deferred");
		expect(cardRoleOf("SHOP CARTE X1234")).toBe("deferred");
		expect(cardRoleOf("PAIEMENT CB 0211 PARIS")).toBeNull();
		expect(cardRoleOf("CARTE CADEAU")).toBeNull();
	});

	test("names how each line moves money", () => {
		const line = {
			kind: "expense" as const,
			aside: false,
			category: "food",
			cardRole: null,
		};
		expect(flowOf(line)).toBe("spending");
		expect(flowOf({ ...line, cardRole: "deferred" })).toBe("spending");
		expect(flowOf({ ...line, cardRole: "statement" })).toBe("card_statement");
		expect(flowOf({ ...line, category: "internal" })).toBe("transfer_internal");
		expect(flowOf({ ...line, aside: true })).toBe("transfer_to_savings");
		expect(flowOf({ ...line, kind: "income", aside: true })).toBe(
			"transfer_from_savings",
		);
		expect(flowOf({ ...line, kind: "income" })).toBe("income");
		expect(flowOf({ ...line, category: "finance" })).toBe("finance");
	});
});
