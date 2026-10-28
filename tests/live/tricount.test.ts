import { describe, expect, test } from "bun:test";

import { tricountImporter } from "#lib/server/expenses/tricount.js";

const link = Bun.env.TRICOUNT_TEST_LINK ?? "";

interface RawEntry {
	type_transaction?: string;
	amount: { value: string };
	membership_owned: Record<string, { alias: { display_name: string } }>;
	allocations: {
		membership: Record<string, { alias: { display_name: string } }>;
		amount: { value: string };
	}[];
}

function name(
	wrapper: Record<string, { alias: { display_name: string } }>,
): string {
	return Object.values(wrapper)[0]?.alias.display_name.trim() ?? "?";
}

function cents(value: string): number {
	return Math.round(Math.abs(Number(value)) * 100);
}

describe.skipIf(!link)("a real Tricount share link", () => {
	test("imports with the balances Tricount itself has", async () => {
		const key = tricountImporter.key(link);
		expect(key).toBeDefined();
		const raw = await tricountImporter.fetch(key ?? "");
		const imported = tricountImporter.parse(raw);
		expect(imported.entries.length).toBeGreaterThan(0);
		expect(imported.participants.length).toBeGreaterThan(0);

		const ours = new Map<string, number>();
		for (const entry of imported.entries) {
			expect(
				entry.shares.reduce((total, share) => total + share.amountMinor, 0),
			).toBe(entry.amountMinor);
			ours.set(entry.paidBy, (ours.get(entry.paidBy) ?? 0) + entry.amountMinor);
			for (const share of entry.shares) {
				ours.set(
					share.participant,
					(ours.get(share.participant) ?? 0) - share.amountMinor,
				);
			}
		}

		const theirs = new Map<string, number>();
		const registry = (
			raw as {
				Response: {
					Registry?: { all_registry_entry: { RegistryEntry: RawEntry }[] };
				}[];
			}
		).Response.find((item) => item.Registry)?.Registry;
		for (const { RegistryEntry: entry } of registry?.all_registry_entry ?? []) {
			const sign = entry.type_transaction === "INCOME" ? -1 : 1;
			const payer = name(entry.membership_owned);
			theirs.set(
				payer,
				(theirs.get(payer) ?? 0) + sign * cents(entry.amount.value),
			);
			for (const allocation of entry.allocations) {
				const member = name(allocation.membership);
				theirs.set(
					member,
					(theirs.get(member) ?? 0) - sign * cents(allocation.amount.value),
				);
			}
		}
		for (const [participant, balance] of ours) {
			expect(
				Math.abs(balance - (theirs.get(participant) ?? 0)),
			).toBeLessThanOrEqual(imported.entries.length);
		}
	}, 60_000);
});
