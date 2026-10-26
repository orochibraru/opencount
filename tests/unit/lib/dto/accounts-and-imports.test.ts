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
