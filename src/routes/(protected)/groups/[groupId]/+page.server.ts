import { fail } from "@sveltejs/kit";
import { z } from "zod";

import { categoryOptions } from "#lib/categories.js";
import { ExpenseDTO } from "#lib/dto/expense.js";
import { GroupCategoryDTO } from "#lib/dto/group-category.js";
import { MerchantDTO } from "#lib/dto/merchant.js";
import { RecurringExpenseDTO } from "#lib/dto/recurring-expense.js";
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
		const { merchant, repeat, ...input } = parsed.data;
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
		);
		rule?.materialize(today());
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
		const { merchant, repeat: _repeat, ...input } = parsed.data;
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
