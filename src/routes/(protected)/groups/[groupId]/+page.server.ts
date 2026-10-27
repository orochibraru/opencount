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
import { parseForm } from "#lib/server/validation/form.js";

const expenseIdSchema = z.object({ id: z.string().min(1) });
const applyCategorySchema = z.object({
	category: z.string().min(1),
	ids: z.array(z.string().min(1)).min(1).max(500),
});
const pageSize = 50;
const limitSchema = z.coerce
	.number()
	.int()
	.min(pageSize)
	.max(10_000)
	.catch(pageSize);

const today = () => new Date().toISOString().slice(0, 10);

export const load = async ({ parent, url }) => {
	const { group, categories, myMemberId } = await parent();
	const wanted = url.searchParams.get("category");
	const category = categoryOptions(categories).some(
		(option) => option.value === wanted,
	)
		? (wanted ?? undefined)
		: undefined;
	const search = url.searchParams.get("q")?.trim().slice(0, 100) || undefined;
	const page = ExpenseDTO.page(group.id, {
		limit: limitSchema.parse(url.searchParams.get("limit") ?? pageSize),
		category,
		search,
	});
	return {
		expenses: page.entries.map((entry) => entry.toJSON()),
		hasMore: page.total > page.entries.length,
		matching: page.total,
		pageSize,
		category: category ?? null,
		search: search ?? "",
		totalSpent: ExpenseDTO.spentTotal(group.id),
		matchingTotals:
			(category || search) && page.total > 0
				? ExpenseDTO.summary(group.id, { category, search }, myMemberId)
				: null,
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
		const target = parseForm(expenseIdSchema, formData);
		const existing =
			target.success && ExpenseDTO.findInGroup(group.id, target.data.id);
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
		const merchantId = merchant
			? MerchantDTO.remember(group.id, merchant, input.category)
			: null;
		existing.update({ ...input, merchantId });
		const recategorized = existing.toJSON().category !== input.category;
		return {
			updated: true,
			category: input.category,
			similar: recategorized
				? ExpenseDTO.similarTo(
						group.id,
						{ id: existing.id, description: input.description, merchantId },
						input.category,
					).map((entry) => {
						const { id, description, spentOn, amountMinor, category } =
							entry.toJSON();
						return { id, description, spentOn, amountMinor, category };
					})
				: [],
		};
	},
	applyCategory: async ({ locals, params, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const { group } = groupForMember(params.groupId, locals.user.id);
		const formData = await request.formData();
		const parsed = applyCategorySchema.safeParse({
			category: formData.get("category"),
			ids: formData.getAll("ids"),
		});
		if (
			!parsed.success ||
			!categoryOptions(
				GroupCategoryDTO.forGroup(group.id).map((entry) => entry.toJSON()),
			).some((option) => option.value === parsed.data.category)
		) {
			return fail(400, { error: "Pick the expenses to move." });
		}
		return {
			moved: ExpenseDTO.recategorize(
				group.id,
				parsed.data.ids,
				parsed.data.category,
			),
		};
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
