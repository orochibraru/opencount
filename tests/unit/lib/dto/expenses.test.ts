import { beforeEach, describe, expect, test } from "bun:test";

import { ExpenseDTO, type ExpenseInput } from "#lib/dto/expense.js";
import { GroupCategoryDTO } from "#lib/dto/group-category.js";
import { GroupMemberDTO } from "#lib/dto/group-member.js";
import { GroupDTO } from "#lib/dto/group.js";
import { MerchantDTO } from "#lib/dto/merchant.js";
import { RecurringExpenseDTO } from "#lib/dto/recurring-expense.js";

import { createUser, resetDatabase } from "../../database.js";

function ledger(groupId: string) {
	return ExpenseDTO.forGroup(groupId).map((entry) => {
		const row = entry.toJSON();
		return {
			paidBy: row.paidBy,
			amountMinor: row.amountMinor,
			shares: row.shares.map(({ memberId, amountMinor }) => ({
				memberId,
				amountMinor,
			})),
		};
	});
}

function setUp() {
	const ada = createUser("ada", "Ada");
	const grace = createUser("grace", "Grace");
	const group = GroupDTO.create({ name: "Flat", currency: "EUR", owner: ada });
	const adaMember = GroupMemberDTO.forGroup(group.id)[0];
	if (!adaMember) {
		throw new Error("The owner should be a member");
	}
	const sam = GroupMemberDTO.add(group.id, "Sam");
	return { ada, grace, group, adaMember, sam };
}

function expenseInput(
	paidBy: string,
	shares: ExpenseInput["shares"],
	overrides: Partial<ExpenseInput> = {},
): ExpenseInput {
	return {
		kind: "expense",
		description: "Rent",
		category: "bills",
		amountMinor: shares.reduce((sum, share) => sum + share.amountMinor, 0),
		paidBy,
		splitMode: "equal",
		spentOn: "2026-01-31",
		merchantId: null,
		shares,
		...overrides,
	};
}

describe("MerchantDTO", () => {
	beforeEach(resetDatabase);

	test("remember saves once per name, whatever the case, and ranks by use", () => {
		const { group } = setUp();
		const first = MerchantDTO.remember(group.id, " Le Port ", "food");
		expect(MerchantDTO.remember(group.id, "le port", "groceries")).toBe(first);
		MerchantDTO.remember(group.id, "Bakery", "food");
		expect(
			MerchantDTO.forGroup(group.id).map((merchant) => merchant.toJSON()),
		).toEqual([
			{ id: first, name: "le port", category: "groceries" },
			expect.objectContaining({ name: "Bakery" }),
		]);
	});

	test("finds a merchant by id or name only within its own group", () => {
		const { group } = setUp();
		const id = MerchantDTO.remember(group.id, "Pingo Doce", "groceries");
		expect(MerchantDTO.findInGroup(group.id, id)?.toJSON().name).toBe(
			"Pingo Doce",
		);
		expect(MerchantDTO.findByName(group.id, " pingo DOCE ")?.toJSON().id).toBe(
			id,
		);
		expect(MerchantDTO.findInGroup("elsewhere", id)).toBeUndefined();
		expect(MerchantDTO.findByName(group.id, "Lidl")).toBeUndefined();
	});
});

describe("ExpenseDTO", () => {
	beforeEach(resetDatabase);

	test("create, update and delete keep shares in step", () => {
		const { group, adaMember, sam } = setUp();
		const merchantId = MerchantDTO.remember(group.id, "Landlord", "bills");
		const created = ExpenseDTO.create(
			group.id,
			expenseInput(
				adaMember.id,
				[
					{ memberId: adaMember.id, amountMinor: 500, weight: 1 },
					{ memberId: sam.id, amountMinor: 500, weight: 1 },
				],
				{ merchantId },
			),
			"ada",
		);
		const found = ExpenseDTO.findInGroup(group.id, created.id);
		expect(found?.toJSON()).toMatchObject({
			merchantId,
			recurringId: null,
			amountMinor: 1000,
		});
		found?.update(
			expenseInput(adaMember.id, [
				{ memberId: sam.id, amountMinor: 700, weight: 1 },
			]),
		);
		expect(ledger(group.id)).toEqual([
			{
				paidBy: adaMember.id,
				amountMinor: 700,
				shares: [{ memberId: sam.id, amountMinor: 700 }],
			},
		]);
		expect(
			Object.fromEntries(
				ExpenseDTO.balances(group.id, [adaMember.id, sam.id, "nobody"]),
			),
		).toEqual({ [adaMember.id]: 700, [sam.id]: -700, nobody: 0 });
		expect(ExpenseDTO.spentTotal(group.id)).toBe(700);
		expect(ExpenseDTO.page(group.id, { limit: 50 }).total).toBe(1);
		expect(
			ExpenseDTO.page(group.id, { limit: 50, category: "food" }).entries,
		).toEqual([]);
		found?.delete();
		expect(ExpenseDTO.forGroup(group.id)).toEqual([]);
	});

	test("a page can skip transfers and start further down", () => {
		const { group, adaMember, sam } = setUp();
		const share = [{ memberId: sam.id, amountMinor: 500, weight: 1 }];
		for (const [description, spentOn] of [
			["Dinner", "2026-02-03"],
			["Taxi", "2026-02-02"],
		]) {
			ExpenseDTO.create(
				group.id,
				expenseInput(adaMember.id, share, { description, spentOn }),
				"ada",
			);
		}
		ExpenseDTO.create(
			group.id,
			expenseInput(adaMember.id, share, {
				kind: "transfer",
				description: "Paid back",
				spentOn: "2026-02-04",
			}),
			"ada",
		);
		const expenses = ExpenseDTO.page(group.id, {
			limit: 1,
			offset: 1,
			kind: "expense",
		});
		expect(expenses.total).toBe(2);
		expect(expenses.entries.map((entry) => entry.toJSON().description)).toEqual(
			["Taxi"],
		);
	});

	test("a merchant goes on expenses of its group, never on transfers", () => {
		const { group, adaMember, sam } = setUp();
		const share = [{ memberId: sam.id, amountMinor: 500, weight: 1 }];
		const dinner = ExpenseDTO.create(
			group.id,
			expenseInput(adaMember.id, share),
			"ada",
		);
		const transfer = ExpenseDTO.create(
			group.id,
			expenseInput(adaMember.id, share, { kind: "transfer" }),
			"ada",
		);
		const merchantId = MerchantDTO.remember(group.id, "Bistro", "food");
		expect(
			ExpenseDTO.assignMerchant(group.id, [dinner.id, transfer.id], merchantId),
		).toBe(1);
		expect(ExpenseDTO.assignMerchant("elsewhere", [dinner.id], null)).toBe(0);
		expect(ExpenseDTO.assignMerchant(group.id, [], null)).toBe(0);
		expect(
			ExpenseDTO.findInGroup(group.id, dinner.id)?.toJSON().merchantId,
		).toBe(merchantId);
		ExpenseDTO.assignMerchant(group.id, [dinner.id], null);
		expect(
			ExpenseDTO.findInGroup(group.id, dinner.id)?.toJSON().merchantId,
		).toBeNull();
	});
});

describe("RecurringExpenseDTO", () => {
	beforeEach(resetDatabase);

	function rule() {
		const context = setUp();
		const input = expenseInput(context.adaMember.id, [
			{ memberId: context.adaMember.id, amountMinor: 600, weight: 1 },
			{ memberId: context.sam.id, amountMinor: 400, weight: 1 },
		]);
		return {
			...context,
			rule: RecurringExpenseDTO.create(
				context.group.id,
				input,
				"monthly",
				"ada",
			),
		};
	}

	test("starts the month after, on the same day", () => {
		const { group, rule: created } = rule();
		expect(created.toJSON()).toMatchObject({
			nextOn: "2026-02-28",
			anchorDay: 31,
			active: true,
		});
		expect(
			RecurringExpenseDTO.forGroup(group.id).map((entry) => entry.id),
		).toEqual([created.id]);
		expect(RecurringExpenseDTO.findInGroup("elsewhere", created.id)).toBe(
			undefined,
		);
	});

	test("materialize catches up once, even when two runs race", () => {
		const { group, rule: created } = rule();
		const racing = RecurringExpenseDTO.findInGroup(group.id, created.id);
		expect(created.materialize("2026-04-01")).toBe(2);
		expect(racing?.materialize("2026-04-01")).toBe(0);
		expect(
			ExpenseDTO.forGroup(group.id).map((entry) => entry.toJSON().spentOn),
		).toEqual(["2026-03-31", "2026-02-28"]);
		expect(ExpenseDTO.forGroup(group.id)[0]?.toJSON()).toMatchObject({
			recurringId: created.id,
			shares: expect.arrayContaining([
				expect.objectContaining({ amountMinor: 600 }),
				expect.objectContaining({ amountMinor: 400 }),
			]),
		});
		expect(RecurringExpenseDTO.due("2026-04-01")).toEqual([]);
		expect(
			RecurringExpenseDTO.due("2026-04-30").map((entry) => entry.id),
		).toEqual([created.id]);
	});

	test("pausing stops copies and resuming skips the paused months", () => {
		const { group, rule: created } = rule();
		created.setActive(false, "2026-02-01");
		expect(created.materialize("2026-06-01")).toBe(0);
		created.setActive(true, "2026-06-01");
		expect(created.toJSON().nextOn).toBe("2026-06-30");
		expect(ExpenseDTO.forGroup(group.id)).toEqual([]);
	});

	test("deleting a rule keeps the copies it added", () => {
		const { group, rule: created } = rule();
		created.materialize("2026-03-01");
		created.delete();
		expect(RecurringExpenseDTO.forGroup(group.id)).toEqual([]);
		expect(ExpenseDTO.forGroup(group.id)[0]?.toJSON().recurringId).toBe(null);
	});

	test("a member in a rule counts as involved", () => {
		const { sam } = rule();
		expect(sam.isInvolved()).toBe(true);
	});
});

describe("GroupCategoryDTO", () => {
	beforeEach(resetDatabase);

	test("create, rename and delete move expenses back to Other", () => {
		const { group, adaMember } = setUp();
		const category = GroupCategoryDTO.create(group.id, "Kids", "baby");
		ExpenseDTO.create(
			group.id,
			expenseInput(
				adaMember.id,
				[{ memberId: adaMember.id, amountMinor: 100, weight: 1 }],
				{ category: category.id },
			),
			"ada",
		);
		expect(GroupCategoryDTO.usage(group.id)).toEqual({ [category.id]: 1 });
		GroupCategoryDTO.findInGroup(group.id, category.id)?.update(
			"Children",
			"heart",
		);
		expect(GroupCategoryDTO.forGroup(group.id)[0]?.toJSON()).toEqual({
			id: category.id,
			name: "Children",
			icon: "heart",
		});
		expect(GroupCategoryDTO.findInGroup("elsewhere", category.id)).toBe(
			undefined,
		);
		category.delete();
		expect(GroupCategoryDTO.forGroup(group.id)).toEqual([]);
		expect(GroupCategoryDTO.usage(group.id)).toEqual({ other: 1 });
	});
});

describe("archiving", () => {
	beforeEach(resetDatabase);

	test("archiving hides the group for that member only", () => {
		const { ada, group } = setUp();
		group.setArchived(ada.id, true);
		expect(GroupDTO.forMember(ada.id)).toEqual([]);
		expect(
			GroupDTO.forMember(ada.id, { archived: true })[0]?.toJSON(),
		).toMatchObject({ id: group.id, archived: true });
		expect(GroupDTO.findForMember(group.id, ada.id)?.toJSON().archived).toBe(
			true,
		);
		group.setArchived(ada.id, false);
		expect(GroupDTO.forMember(ada.id)).toHaveLength(1);
	});
});

describe("claiming a member", () => {
	beforeEach(resetDatabase);

	test("takeOver folds the account's member into the placeholder", () => {
		const { grace, group, adaMember } = setUp();
		const graceMember = GroupMemberDTO.add(group.id, "Grace", grace.id);
		const placeholder = GroupMemberDTO.add(group.id, "G");
		ExpenseDTO.create(
			group.id,
			expenseInput(graceMember.id, [
				{ memberId: graceMember.id, amountMinor: 300, weight: 1 },
				{ memberId: placeholder.id, amountMinor: 200, weight: 1 },
			]),
			"grace",
		);
		ExpenseDTO.create(
			group.id,
			expenseInput(adaMember.id, [
				{ memberId: graceMember.id, amountMinor: 50, weight: 1 },
			]),
			"ada",
		);
		RecurringExpenseDTO.create(
			group.id,
			expenseInput(graceMember.id, [
				{ memberId: graceMember.id, amountMinor: 10, weight: 1 },
				{ memberId: placeholder.id, amountMinor: 20, weight: 2 },
			]),
			"weekly",
			"grace",
		);
		RecurringExpenseDTO.create(
			group.id,
			expenseInput(adaMember.id, [
				{ memberId: graceMember.id, amountMinor: 5, weight: 1 },
			]),
			"yearly",
			"ada",
		);
		placeholder.takeOver(graceMember);

		const members = GroupMemberDTO.forGroup(group.id).map((member) =>
			member.toJSON(),
		);
		expect(members.map((member) => member.displayName).toSorted()).toEqual([
			"Ada",
			"G",
			"Sam",
		]);
		expect(members.find((member) => member.displayName === "G")?.userId).toBe(
			grace.id,
		);
		expect(ledger(group.id)).toEqual(
			expect.arrayContaining([
				{
					paidBy: placeholder.id,
					amountMinor: 500,
					shares: [{ memberId: placeholder.id, amountMinor: 500 }],
				},
				{
					paidBy: adaMember.id,
					amountMinor: 50,
					shares: [{ memberId: placeholder.id, amountMinor: 50 }],
				},
			]),
		);
		expect(
			RecurringExpenseDTO.forGroup(group.id).flatMap(
				(entry) => entry.toJSON().shares,
			),
		).toEqual(
			expect.arrayContaining([
				{ memberId: placeholder.id, amountMinor: 30, weight: 3 },
				{ memberId: placeholder.id, amountMinor: 5, weight: 1 },
			]),
		);
	});

	test("unlink keeps the member but drops the account", () => {
		const { grace, group } = setUp();
		const graceMember = GroupMemberDTO.add(group.id, "Grace", grace.id);
		graceMember.unlink();
		expect(GroupDTO.findForMember(group.id, grace.id)).toBe(undefined);
		expect(GroupMemberDTO.findInGroup(group.id, graceMember.id)?.userId).toBe(
			null,
		);
	});
});

describe("group upkeep", () => {
	beforeEach(resetDatabase);

	test("rename, currency, ownership and delete", () => {
		const { ada, grace, group, adaMember, sam } = setUp();
		expect(group.isOwnedBy(ada.id)).toBe(true);
		expect(group.isOwnedBy(grace.id)).toBe(false);
		expect(group.currency).toBe("EUR");
		group.rename("Flat 2");
		group.setCurrency("CHF");
		expect(GroupDTO.findForMember(group.id, ada.id)?.toJSON()).toMatchObject({
			name: "Flat 2",
			currency: "CHF",
		});
		expect(group.hasExpenses()).toBe(false);
		ExpenseDTO.create(
			group.id,
			expenseInput(adaMember.id, [
				{ memberId: sam.id, amountMinor: 100, weight: 1 },
			]),
			ada.id,
		);
		expect(group.hasExpenses()).toBe(true);
		group.delete();
		expect(GroupDTO.findForMember(group.id, ada.id)).toBe(undefined);
	});

	test("members can be renamed, checked and removed", () => {
		const { ada, grace, group, sam } = setUp();
		expect(GroupMemberDTO.isMember(group.id, ada.id)).toBe(true);
		expect(GroupMemberDTO.isMember(group.id, grace.id)).toBe(false);
		sam.rename("Samuel");
		expect(
			GroupMemberDTO.findInGroup(group.id, sam.id)?.toJSON(),
		).toMatchObject({ displayName: "Samuel" });
		expect(sam.isInvolved()).toBe(false);
		sam.remove();
		expect(GroupMemberDTO.findInGroup(group.id, sam.id)).toBe(undefined);
	});
});

describe("recurring.run", () => {
	beforeEach(resetDatabase);

	test("adds due copies and schedules itself for tomorrow", async () => {
		const { jobHandlers } = await import("#lib/server/jobs/handlers.js");
		const { JobDTO } = await import("#lib/dto/job.js");
		const { group, adaMember } = setUp();
		const today = new Date().toISOString().slice(0, 10);
		const lastMonth = new Date();
		lastMonth.setUTCMonth(lastMonth.getUTCMonth() - 1);
		RecurringExpenseDTO.create(
			group.id,
			expenseInput(
				adaMember.id,
				[{ memberId: adaMember.id, amountMinor: 100, weight: 1 }],
				{ spentOn: lastMonth.toISOString().slice(0, 10) },
			),
			"weekly",
			"ada",
		);
		await jobHandlers["recurring.run"]({});
		expect(ExpenseDTO.forGroup(group.id).length).toBeGreaterThanOrEqual(4);
		expect(
			ExpenseDTO.forGroup(group.id).every(
				(entry) => entry.toJSON().spentOn <= today,
			),
		).toBe(true);
		expect(JobDTO.isQueued("recurring.run")).toBe(true);
	});
});
