import { beforeEach, describe, expect, test } from "bun:test";

import { hasPassword } from "#lib/dto/account.js";
import { ExpenseDTO } from "#lib/dto/expense.js";
import { GroupMemberDTO } from "#lib/dto/group-member.js";
import { GroupDTO } from "#lib/dto/group.js";
import { UserDTO } from "#lib/dto/user.js";
import { getDb } from "#lib/server/db/lib.js";
import {
	account,
	passkey,
	session,
	twoFactor,
	user,
	verification,
} from "#lib/server/db/schema.js";

import { createUser, resetDatabase } from "../../database.js";

describe("UserDTO account changes", () => {
	beforeEach(resetDatabase);

	test("resetFactors removes the authenticator, passkeys and sessions", () => {
		const ada = createUser("ada");
		const database = getDb();
		database.update(user).set({ twoFactorEnabled: true }).run();
		database
			.insert(twoFactor)
			.values({ id: "totp", secret: "s", backupCodes: "[]", userId: ada.id })
			.run();
		database
			.insert(passkey)
			.values({
				id: "key",
				publicKey: "p",
				userId: ada.id,
				credentialID: "c",
				counter: 0,
				deviceType: "singleDevice",
				backedUp: false,
			})
			.run();
		database
			.insert(session)
			.values({
				id: "s",
				token: "t",
				userId: ada.id,
				expiresAt: new Date(Date.now() + 60_000),
			})
			.run();
		UserDTO.resetFactors(ada.id);
		expect(UserDTO.twoFactorEnabled(ada.id)).toBe(false);
		expect(database.select().from(twoFactor).all()).toEqual([]);
		expect(database.select().from(passkey).all()).toEqual([]);
		expect(database.select().from(session).all()).toEqual([]);
	});

	test("changeEmail moves the account and counts the address as verified", () => {
		const ada = createUser("ada");
		UserDTO.changeEmail(ada.id, "new@example.com");
		expect(UserDTO.idForEmail("new@example.com")).toBe(ada.id);
		expect(getDb().select().from(user).get()?.emailVerified).toBe(true);
	});

	test("adminCount counts admins only", () => {
		createUser("ada");
		const grace = createUser("grace");
		expect(UserDTO.adminCount()).toBe(0);
		UserDTO.setRole(grace.id, "admin");
		expect(UserDTO.adminCount()).toBe(1);
	});

	test("emailForPasswordReset finds a live token's account only", () => {
		const ada = createUser("ada");
		getDb()
			.insert(verification)
			.values([
				{
					id: "live",
					identifier: "reset-password:live",
					value: ada.id,
					expiresAt: new Date(Date.now() + 60_000),
				},
				{
					id: "old",
					identifier: "reset-password:old",
					value: ada.id,
					expiresAt: new Date(Date.now() - 60_000),
				},
			])
			.run();
		expect(UserDTO.emailForPasswordReset("live")).toBe("ada@example.com");
		expect(UserDTO.emailForPasswordReset("old")).toBeUndefined();
		expect(UserDTO.emailForPasswordReset("nope")).toBeUndefined();
	});

	test("hasPassword is true for a credential account with a password", () => {
		const ada = createUser("ada");
		expect(hasPassword(ada.id)).toBe(false);
		getDb()
			.insert(account)
			.values({
				id: "credential",
				accountId: ada.id,
				providerId: "credential",
				userId: ada.id,
				password: "hash",
			})
			.run();
		expect(hasPassword(ada.id)).toBe(true);
	});
});

describe("GroupDTO invite links", () => {
	beforeEach(resetDatabase);

	test("a link works until it's reset or turned off", () => {
		const ada = createUser("ada");
		const group = GroupDTO.create({
			name: "Flat",
			currency: "EUR",
			owner: ada,
		});
		expect(group.inviteToken()).toBeUndefined();
		group.resetInvite();
		const token = group.inviteToken() ?? "";
		expect(GroupDTO.findByInvite(group.id, token)).toEqual({
			id: group.id,
			name: "Flat",
			currency: "EUR",
		});
		expect(GroupDTO.findByInvite(group.id, "forged")).toBeUndefined();
		group.resetInvite();
		expect(GroupDTO.findByInvite(group.id, token)).toBeUndefined();
		group.disableInvite();
		expect(group.inviteToken()).toBeUndefined();
	});

	test("linkTo gives an unlinked member an account", () => {
		const ada = createUser("ada");
		const grace = createUser("grace");
		const group = GroupDTO.create({
			name: "Flat",
			currency: "EUR",
			owner: ada,
		});
		GroupMemberDTO.add(group.id, "Grace").linkTo(grace.id);
		expect(GroupMemberDTO.isMember(group.id, grace.id)).toBe(true);
	});
});

describe("ExpenseDTO.createMany", () => {
	beforeEach(resetDatabase);

	test("adds new members first and records every expense with its currency", () => {
		const ada = createUser("ada");
		const group = GroupDTO.create({
			name: "Trip",
			currency: "EUR",
			owner: ada,
		});
		const adaMember = GroupMemberDTO.forGroup(group.id)[0]?.id ?? "";
		const added = ExpenseDTO.createMany(
			group.id,
			[
				{
					kind: "expense",
					description: "Taxi",
					category: "transport",
					amountMinor: 1000,
					originalCurrency: "USD",
					originalAmountMinor: 1100,
					exchangeRate: 1000 / 1100,
					paidBy: "new:1",
					splitMode: "exact",
					spentOn: "2026-03-01",
					merchantId: null,
					shares: [
						{ memberId: adaMember, amountMinor: 500, weight: 1 },
						{ memberId: "new:1", amountMinor: 500, weight: 1 },
					],
				},
			],
			ada.id,
			{ "new:1": "Bob" },
		);
		expect(added).toBe(1);
		const bob = GroupMemberDTO.forGroup(group.id).find(
			(member) => member.toJSON().displayName === "Bob",
		);
		const [taxi] = ExpenseDTO.forGroup(group.id).map((entry) => entry.toJSON());
		expect(taxi?.paidBy).toBe(bob?.id ?? "");
		expect(taxi?.originalCurrency).toBe("USD");
		expect(taxi?.shares.map((share) => share.memberId).sort()).toEqual(
			[adaMember, bob?.id ?? ""].sort(),
		);
	});

	test("update back to the group's currency clears the original amount", () => {
		const ada = createUser("ada");
		const group = GroupDTO.create({
			name: "Trip",
			currency: "EUR",
			owner: ada,
		});
		const adaMember = GroupMemberDTO.forGroup(group.id)[0]?.id ?? "";
		const input = {
			kind: "expense" as const,
			description: "Taxi",
			category: "transport",
			amountMinor: 1000,
			paidBy: adaMember,
			splitMode: "equal" as const,
			spentOn: "2026-03-01",
			merchantId: null,
			shares: [{ memberId: adaMember, amountMinor: 1000, weight: 1 }],
		};
		const created = ExpenseDTO.create(
			group.id,
			{
				...input,
				originalCurrency: "USD",
				originalAmountMinor: 1100,
				exchangeRate: 0.9,
			},
			ada.id,
		);
		created.update(input);
		expect(ExpenseDTO.findInGroup(group.id, created.id)?.toJSON()).toEqual(
			expect.objectContaining({
				originalCurrency: null,
				originalAmountMinor: null,
				exchangeRate: null,
			}),
		);
	});
});

describe("ExpenseDTO client ids and sorting", () => {
	beforeEach(resetDatabase);

	test("remembers a device's client id and files what's under Other", () => {
		const ada = createUser("ada");
		const group = GroupDTO.create({
			name: "Trip",
			currency: "EUR",
			owner: ada,
		});
		const adaMember = GroupMemberDTO.forGroup(group.id)[0]?.id ?? "";
		const input = (description: string, category = "other") => ({
			kind: "expense" as const,
			description,
			category,
			amountMinor: 1000,
			paidBy: adaMember,
			splitMode: "equal" as const,
			spentOn: "2026-03-01",
			merchantId: null,
			shares: [{ memberId: adaMember, amountMinor: 1000, weight: 1 }],
		});
		const clientId = crypto.randomUUID();
		ExpenseDTO.create(group.id, input("Taxi to the airport"), ada.id, clientId);
		ExpenseDTO.create(group.id, input("Mystery"), ada.id);
		ExpenseDTO.create(group.id, input("Hotel night", "food"), ada.id);
		expect(ExpenseDTO.hasClientId(group.id, clientId)).toBe(true);
		expect(ExpenseDTO.hasClientId(group.id, crypto.randomUUID())).toBe(false);
		const moved = ExpenseDTO.categorizeUncategorized(group.id, (description) =>
			description.startsWith("Taxi")
				? "transport"
				: description.startsWith("Hotel")
					? "lodging"
					: undefined,
		);
		expect(moved).toBe(1);
		const categories = Object.fromEntries(
			ExpenseDTO.forGroup(group.id).map((entry) => [
				entry.toJSON().description,
				entry.toJSON().category,
			]),
		);
		expect(categories).toEqual({
			"Taxi to the airport": "transport",
			Mystery: "other",
			"Hotel night": "food",
		});
	});
});

describe("personal folders, stats and similar expenses", () => {
	beforeEach(resetDatabase);

	test("folders hold expenses with their own totals, and similar ones are found", async () => {
		const { PersonalExpenseDTO } = await import("#lib/dto/personal-expense.js");
		const { PersonalFolderDTO } = await import("#lib/dto/personal-folder.js");
		const ada = createUser("ada");
		const grace = createUser("grace");
		const folderId = PersonalFolderDTO.create(ada.id, "Kitchen");
		const add = (description: string, amountMinor: number, extra = {}) =>
			PersonalExpenseDTO.create(ada.id, {
				description,
				category: "other",
				amountMinor,
				currency: "EUR",
				spentOn: "2026-10-05",
				...extra,
			});
		const tiles = add("Tiles", 12_000, { folderId, category: "shopping" });
		add("tiles ", 3_000);
		add("Lunch", 1_500, { spentOn: "2026-09-02", category: "food" });

		expect(
			PersonalFolderDTO.forUser(ada.id).map((folder) => folder.toJSON()),
		).toEqual([{ id: folderId, name: "Kitchen", expenseCount: 1 }]);
		expect(PersonalFolderDTO.findForUser(folderId, grace.id)).toBeUndefined();

		const inFolder = PersonalExpenseDTO.page(ada.id, { limit: 50, folderId });
		expect(inFolder.total).toBe(1);
		expect(inFolder.entries[0]?.toJSON().folderName).toBe("Kitchen");
		expect(PersonalExpenseDTO.page(ada.id, { limit: 2 })).toEqual(
			expect.objectContaining({ total: 3 }),
		);

		const stats = PersonalExpenseDTO.stats(ada.id, undefined, "2026-10");
		expect(stats.totals).toEqual([{ currency: "EUR", minor: 16_500 }]);
		expect(stats.thisMonth).toEqual([{ currency: "EUR", minor: 15_000 }]);
		expect(stats.byMonth.map((row) => row.month)).toEqual([
			"2026-10",
			"2026-09",
		]);
		expect(stats.byCategory[0]).toEqual({
			category: "shopping",
			currency: "EUR",
			minor: 12_000,
		});

		const similar = PersonalExpenseDTO.similarTo(
			ada.id,
			{ id: tiles, description: "TILES" },
			"shopping",
		);
		expect(similar.map((entry) => entry.toJSON().description)).toEqual([
			"tiles ",
		]);
		expect(
			PersonalExpenseDTO.recategorize(
				ada.id,
				similar.map((entry) => entry.id),
				"shopping",
			),
		).toBe(1);
		expect(PersonalExpenseDTO.recategorize(grace.id, [tiles], "food")).toBe(0);
		expect(PersonalExpenseDTO.recategorize(ada.id, [], "food")).toBe(0);

		const folder = PersonalFolderDTO.findForUser(folderId, ada.id);
		folder?.rename("Kitchen 2026");
		expect(PersonalFolderDTO.forUser(ada.id)[0]?.toJSON().name).toBe(
			"Kitchen 2026",
		);
		folder?.delete();
		expect(
			PersonalExpenseDTO.findForUser(tiles, ada.id)?.toJSON().folderId,
		).toBeNull();
	});

	test("ExpenseDTO finds similar expenses by description or merchant and re-files them", () => {
		const ada = createUser("ada");
		const group = GroupDTO.create({
			name: "Flat",
			currency: "EUR",
			owner: ada,
		});
		const member = GroupMemberDTO.forGroup(group.id)[0]?.id ?? "";
		const add = (description: string, category: string) =>
			ExpenseDTO.create(
				group.id,
				{
					kind: "expense",
					description,
					category,
					amountMinor: 500,
					paidBy: member,
					splitMode: "equal",
					spentOn: "2026-10-01",
					merchantId: null,
					shares: [{ memberId: member, amountMinor: 500, weight: 1 }],
				},
				ada.id,
			);
		const first = add("Croquettes", "shopping");
		const second = add("croquette's", "other");
		add("Croquettes", "shopping");
		const found = ExpenseDTO.similarTo(
			group.id,
			{ id: first.id, description: "Croquettes", merchantId: null },
			"shopping",
		);
		expect(found.map((entry) => entry.id)).toEqual([second.id]);
		expect(ExpenseDTO.categoryHistory(group.id).get("croquette")).toBe(
			"shopping",
		);
		expect(ExpenseDTO.recategorize(group.id, [second.id], "shopping")).toBe(1);
		expect(ExpenseDTO.recategorize(group.id, [], "shopping")).toBe(0);
		expect(
			ExpenseDTO.page(group.id, { limit: 50, category: "shopping" }).total,
		).toBe(3);
	});

	test("page searches descriptions and merchant names in the database", async () => {
		const { MerchantDTO } = await import("#lib/dto/merchant.js");
		const ada = createUser("ada");
		const group = GroupDTO.create({
			name: "Flat",
			currency: "EUR",
			owner: ada,
		});
		const member = GroupMemberDTO.forGroup(group.id)[0]?.id ?? "";
		const add = (description: string, merchantId: string | null = null) =>
			ExpenseDTO.create(
				group.id,
				{
					kind: "expense",
					description,
					category: "other",
					amountMinor: 500,
					paidBy: member,
					splitMode: "equal",
					spentOn: "2026-10-01",
					merchantId,
					shares: [{ memberId: member, amountMinor: 500, weight: 1 }],
				},
				ada.id,
			);
		add(
			"Weekly groceries",
			MerchantDTO.remember(group.id, "Lidl", "groceries"),
		);
		add("Dinner at Luigi");
		add("100% cotton sheets");
		const found = (search: string) =>
			ExpenseDTO.page(group.id, { limit: 50, search }).entries.map(
				(entry) => entry.toJSON().description,
			);
		expect(found("LIDL")).toEqual(["Weekly groceries"]);
		expect(found("luigi")).toEqual(["Dinner at Luigi"]);
		expect(found("100%")).toEqual(["100% cotton sheets"]);
		expect(found("%")).toEqual(["100% cotton sheets"]);
		expect(found("nothing")).toEqual([]);
		expect(ExpenseDTO.summary(group.id, { search: "luigi" }, member)).toEqual({
			spentMinor: 500,
			balanceMinor: 0,
		});
		expect(ExpenseDTO.summary(group.id, { search: "e" }, null)).toEqual({
			spentMinor: 1500,
			balanceMinor: 0,
		});
	});
});
