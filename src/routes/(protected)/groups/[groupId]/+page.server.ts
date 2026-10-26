import { resolve } from "$app/paths";
import { fail } from "@sveltejs/kit";
import { z } from "zod";

import { categoryOptions } from "#lib/categories.js";
import { ExpenseDTO } from "#lib/dto/expense.js";
import { GroupCategoryDTO } from "#lib/dto/group-category.js";
import { JobDTO } from "#lib/dto/job.js";
import { MerchantDTO } from "#lib/dto/merchant.js";
import { RecurringExpenseDTO } from "#lib/dto/recurring-expense.js";
import { formatMoney } from "#lib/money.js";
import { publicOrigin } from "#lib/server/auth.js";
import { groupForMember } from "#lib/server/group-access.js";
import { isOcrConfigured } from "#lib/server/ocr.js";
import { readUploadedReceipt } from "#lib/server/receipt-upload.js";
import { parseExpenseForm } from "#lib/server/validation/expense.js";

const expenseIdSchema = z.object({ id: z.string().min(1) });

const today = () => new Date().toISOString().slice(0, 10);

export const load = async ({ parent }) => {
	const { group } = await parent();
	return {
		expenses: ExpenseDTO.forGroup(group.id).map((entry) => entry.toJSON()),
		merchants: MerchantDTO.forGroup(group.id).map((entry) => entry.toJSON()),
		receiptsEnabled: isOcrConfigured(),
	};
};

export const actions = {
	inviteLink: ({ locals, params, url }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const { group } = groupForMember(params.groupId, locals.user.id);
		if (!group.inviteToken()) {
			group.resetInvite();
		}
		return {
			url: new URL(
				resolve("/(protected)/join/[groupId]/[token]", {
					groupId: group.id,
					token: group.inviteToken() ?? "",
				}),
				publicOrigin() ?? url.origin,
			).href,
		};
	},
	create: async ({ locals, params, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const { group, members } = groupForMember(params.groupId, locals.user.id);
		const parsed = parseExpenseForm(await request.formData(), {
			currency: group.currency,
			memberIds: members.map((member) => member.id),
			categories: categoryOptions(
				GroupCategoryDTO.forGroup(group.id).map((entry) => entry.toJSON()),
			).map((option) => option.value),
		});
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		const { merchant, repeat, clientId, ...input } = parsed.data;
		if (clientId && ExpenseDTO.hasClientId(group.id, clientId)) {
			return { created: true };
		}
		const merchantId = merchant
			? MerchantDTO.remember(group.id, merchant, input.category)
			: null;
		const rule = repeat
			? RecurringExpenseDTO.create(
					group.id,
					{ ...input, merchantId },
					repeat,
					locals.user.id,
				)
			: undefined;
		ExpenseDTO.create(
			group.id,
			{ ...input, merchantId, recurringId: rule?.id ?? null },
			locals.user.id,
			clientId,
		);
		rule?.materialize(today());
		const recipients = members
			.map((member) => member.userId)
			.filter((userId) => userId !== null && userId !== locals.user?.id);
		if (recipients.length > 0) {
			JobDTO.enqueue("push.send", {
				userIds: recipients as string[],
				title: group.toJSON().name,
				body: `${locals.user.name} added ${input.description}, ${formatMoney(input.amountMinor, group.currency)}`,
				url: resolve("/(protected)/groups/[groupId]", { groupId: group.id }),
			});
		}
		return { created: true };
	},
	update: async ({ locals, params, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const { group, members } = groupForMember(params.groupId, locals.user.id);
		const formData = await request.formData();
		const existing = ExpenseDTO.findInGroup(
			group.id,
			String(formData.get("id") ?? ""),
		);
		if (!existing) {
			return fail(404, { error: "That expense no longer exists." });
		}
		const parsed = parseExpenseForm(formData, {
			currency: group.currency,
			memberIds: members.map((member) => member.id),
			categories: categoryOptions(
				GroupCategoryDTO.forGroup(group.id).map((entry) => entry.toJSON()),
			).map((option) => option.value),
		});
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		const {
			merchant,
			repeat: _repeat,
			clientId: _clientId,
			...input
		} = parsed.data;
		existing.update({
			...input,
			merchantId: merchant
				? MerchantDTO.remember(group.id, merchant, input.category)
				: null,
		});
		return { updated: true };
	},
	delete: async ({ locals, params, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const { group } = groupForMember(params.groupId, locals.user.id);
		const parsed = expenseIdSchema.safeParse(
			Object.fromEntries(await request.formData()),
		);
		const existing = parsed.success
			? ExpenseDTO.findInGroup(group.id, parsed.data.id)
			: undefined;
		if (!existing) {
			return fail(404, { error: "That expense no longer exists." });
		}
		existing.delete();
		return { deleted: true };
	},
	scan: async ({ locals, params, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		groupForMember(params.groupId, locals.user.id);
		if (!isOcrConfigured()) {
			return fail(400, { error: "Receipt reading is off on this server." });
		}
		const result = await readUploadedReceipt(await request.formData());
		if ("error" in result) {
			return fail(400, { error: result.error });
		}
		return { reading: result.reading };
	},
};
