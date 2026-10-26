import { resolve } from "$app/paths";
import { fail, redirect } from "@sveltejs/kit";
import { z } from "zod";

import { BankConnectionDTO } from "#lib/dto/bank-connection.js";
import { ExpenseDTO } from "#lib/dto/expense.js";
import { GroupDTO } from "#lib/dto/group.js";
import { JobDTO } from "#lib/dto/job.js";
import { PersonalExpenseDTO } from "#lib/dto/personal-expense.js";
import { convertMinor, formatMoney } from "#lib/money.js";
import { publicOrigin } from "#lib/server/auth.js";
import {
	BankError,
	bankLinkPurpose,
	closeBankSession,
	isBankSyncConfigured,
	startBankLink,
} from "#lib/server/enable-banking.js";
import { exchangeRate } from "#lib/server/exchange-rates.js";
import { groupForMember } from "#lib/server/group-access.js";
import { signPayload } from "#lib/server/secrets.js";
import { parseForm } from "#lib/server/validation/form.js";
import { parsePersonalForm } from "#lib/server/validation/personal.js";
import { splitByWeight } from "#lib/split.js";

const idSchema = z.object({ id: z.string().min(1) });
const shareSchema = z.object({
	id: z.string().min(1),
	groupId: z.string().min(1, "Pick a group."),
});
const bankSchema = z.object({
	name: z.string().min(1, "Pick a bank."),
	country: z.string().regex(/^[A-Z]{2}$/, "Pick a country."),
});

export const load = async ({ parent }) => {
	const { user } = await parent();
	const expenses = PersonalExpenseDTO.forUser(user.id).map((entry) =>
		entry.toJSON(),
	);
	return {
		expenses,
		connections: BankConnectionDTO.forUser(user.id).map((entry) =>
			entry.toJSON(),
		),
		bankSyncAvailable: isBankSyncConfigured(),
		shareGroups: GroupDTO.forMember(user.id).map((entry) => {
			const { id, name, currency } = entry.toJSON();
			return { id, name, currency };
		}),
		defaultCurrency: expenses[0]?.currency ?? "EUR",
	};
};

export const actions = {
	create: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const parsed = parsePersonalForm(await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		PersonalExpenseDTO.create(locals.user.id, parsed.data);
		return { created: true };
	},
	update: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const formData = await request.formData();
		const existing = PersonalExpenseDTO.findForUser(
			String(formData.get("id") ?? ""),
			locals.user.id,
		);
		if (!existing) {
			return fail(404, { error: "That expense no longer exists." });
		}
		const parsed = parsePersonalForm(formData);
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		existing.update(parsed.data);
		return { updated: true };
	},
	delete: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const parsed = parseForm(idSchema, await request.formData());
		const existing = parsed.success
			? PersonalExpenseDTO.findForUser(parsed.data.id, locals.user.id)
			: undefined;
		if (!existing) {
			return fail(404, { error: "That expense no longer exists." });
		}
		existing.delete();
		return { deleted: true };
	},
	share: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const parsed = parseForm(shareSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		const personal = PersonalExpenseDTO.findForUser(
			parsed.data.id,
			locals.user.id,
		);
		if (!personal) {
			return fail(404, { error: "That expense no longer exists." });
		}
		const { group, members } = groupForMember(
			parsed.data.groupId,
			locals.user.id,
		);
		const me = members.find((member) => member.userId === locals.user?.id);
		if (!me) {
			return fail(404, { error: "You're not in that group anymore." });
		}
		const entry = personal.toJSON();
		const rate =
			entry.currency === group.currency
				? 1
				: await exchangeRate(entry.currency, group.currency, entry.spentOn);
		if (rate === undefined) {
			return fail(400, {
				error: `Couldn't get the ${entry.currency} rate. Add it to the group by hand.`,
			});
		}
		const amountMinor = convertMinor(
			entry.amountMinor,
			entry.currency,
			group.currency,
			rate,
		);
		const parts = splitByWeight(
			amountMinor,
			members.map((member) => ({ memberId: member.id, weight: 1 })),
		);
		const created = ExpenseDTO.create(
			group.id,
			{
				kind: "expense",
				description: entry.description,
				category: entry.category,
				amountMinor,
				...(entry.currency !== group.currency && {
					originalCurrency: entry.currency,
					originalAmountMinor: entry.amountMinor,
					exchangeRate: rate,
				}),
				paidBy: me.id,
				splitMode: "equal",
				spentOn: entry.spentOn,
				merchantId: null,
				shares: members.map((member) => ({
					memberId: member.id,
					amountMinor: parts.get(member.id) ?? 0,
					weight: 1,
				})),
			},
			locals.user.id,
		);
		personal.markShared(created.id);
		const recipients = members
			.map((member) => member.userId)
			.filter(
				(userId): userId is string =>
					userId !== null && userId !== locals.user?.id,
			);
		if (recipients.length > 0) {
			JobDTO.enqueue("push.send", {
				userIds: recipients,
				title: group.toJSON().name,
				body: `${locals.user.name} added ${entry.description}, ${formatMoney(amountMinor, group.currency)}`,
				url: resolve("/(protected)/groups/[groupId]", { groupId: group.id }),
			});
		}
		return { sharedIn: group.toJSON().name };
	},
	connectBank: async ({ locals, request, url }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		if (!isBankSyncConfigured()) {
			return fail(400, { error: "Bank sync isn't set up on this server." });
		}
		const parsed = parseForm(bankSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		let target: string;
		try {
			target = await startBankLink(
				parsed.data,
				new URL(
					resolve("/(protected)/personal/bank"),
					publicOrigin() ?? url.origin,
				).href,
				signPayload(
					{ userId: locals.user.id },
					bankLinkPurpose,
					30 * 60 * 1000,
				),
			);
		} catch (error) {
			if (error instanceof BankError) {
				return fail(400, { error: error.message });
			}
			throw error;
		}
		redirect(303, target);
	},
	syncBank: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const parsed = parseForm(idSchema, await request.formData());
		const connection = parsed.success
			? BankConnectionDTO.findForUser(parsed.data.id, locals.user.id)
			: undefined;
		if (!connection) {
			return fail(404, { error: "That bank isn't linked anymore." });
		}
		JobDTO.enqueue(
			"bank.sync",
			{ connectionId: connection.id },
			{ maxAttempts: 1 },
		);
		return { syncing: true };
	},
	disconnectBank: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const parsed = parseForm(idSchema, await request.formData());
		const connection = parsed.success
			? BankConnectionDTO.findForUser(parsed.data.id, locals.user.id)
			: undefined;
		if (!connection) {
			return fail(404, { error: "That bank isn't linked anymore." });
		}
		if (isBankSyncConfigured()) {
			await closeBankSession(connection.sessionId);
		}
		connection.delete();
		return { disconnected: true };
	},
};
