import { describe, expect, test } from "bun:test";

import {
	type AccountView,
	balanceTotals,
	ownShare,
} from "#lib/account-types.js";

function account(fields: Partial<AccountView>): AccountView {
	return {
		id: "a",
		connectionId: "c",
		bankName: "Bank",
		bankLogo: null,
		syncing: false,
		failed: false,
		name: "Account",
		type: "checking",
		currency: "EUR",
		shared: false,
		balance: {
			minor: 10_000,
			currency: "EUR",
			at: "2026-11-01",
			manual: false,
		},
		syncedAt: null,
		...fields,
	};
}

describe("balance totals", () => {
	test("leave shared accounts out unless asked, then count them at half", () => {
		const accounts = [
			account({ id: "mine" }),
			account({ id: "save", type: "savings" }),
			account({ id: "joint", type: "joint", shared: true }),
			account({
				id: "usd",
				balance: { minor: 500, currency: "USD", at: "", manual: false },
			}),
			account({ id: "empty", balance: null }),
		];
		expect(balanceTotals(accounts, "EUR", false)).toEqual({
			toSpendMinor: 10_000,
			savedMinor: 10_000,
			sharedMinor: 5_000,
			sharedCount: 1,
		});
		expect(balanceTotals(accounts, "EUR", true).toSpendMinor).toBe(15_000);
		expect(ownShare(account({ shared: true, balance: null }))).toBe(0);
	});
});
