import { resolve } from "$app/paths";
import { fail, redirect } from "@sveltejs/kit";
import { z } from "zod";

import { categories } from "#lib/categories.js";
import { AppearanceDTO } from "#lib/dto/appearance.js";
import { BankConnectionDTO } from "#lib/dto/bank-connection.js";
import { ExpenseDTO } from "#lib/dto/expense.js";
import { GroupDTO } from "#lib/dto/group.js";
import { JobDTO } from "#lib/dto/job.js";
import { PersonalCategoryDTO } from "#lib/dto/personal-category.js";
import { PersonalExpenseDTO } from "#lib/dto/personal-expense.js";
import { PersonalFolderDTO } from "#lib/dto/personal-folder.js";
import { convertMinor, formatMoney } from "#lib/money.js";
import { exchangeRates } from "#lib/server/expenses/exchange-rates.js";
import { groupAccess } from "#lib/server/expenses/group-access.js";
import { personalPage } from "#lib/server/expenses/personal-page.js";
import { idSchema, parseForm } from "#lib/server/validation/form.js";
import {
	monthStartSchema,
	parsePersonalForm,
} from "#lib/server/validation/personal.js";
import { splitByWeight } from "#lib/split.js";

const folderSchema = z.object({
	id: z.string().default(""),
	name: z
		.string()
		.trim()
		.min(1, "Give the folder a name.")
		.max(60, "Keep it under 60 characters."),
});
const moveSchema = z.object({
	id: z.string().min(1),
	folderId: z.string().default(""),
});
const applyCategorySchema = z.object({
	category: z.string().min(1),
	ids: z.array(z.string().min(1)).min(1).max(500),
});

function knownCategory(userId: string, category: string): boolean {
	return (
		categories.some((option) => option.value === category) ||
		PersonalCategoryDTO.findForUser(category, userId) !== undefined
	);
}

function ownsFolder(userId: string, folderId: string | null | undefined) {
	return (
		!folderId || PersonalFolderDTO.findForUser(folderId, userId) !== undefined
	);
}
const shareSchema = z.object({
	id: z.string().min(1),
	groupId: z.string().min(1, "Pick a group."),
});

export const load = async ({ parent, url }) => {
	const { user } = await parent();
	return {
		...personalPage.load(user.id, url),
		banks: BankConnectionDTO.forUser(user.id).map((entry) => {
			const { id, bankName, bankLogo, lastError } = entry.toJSON();
			return {
				id,
				bankName,
				bankLogo,
				failed: lastError !== null,
				syncing: entry.syncing(),
			};
		}),
		shareGroups: GroupDTO.forMember(user.id).map((entry) => {
			const { id, name, currency } = entry.toJSON();
			return { id, name, currency };
		}),
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
		if (!ownsFolder(locals.user.id, parsed.data.folderId)) {
			return fail(404, { error: "That folder no longer exists." });
		}
		if (!knownCategory(locals.user.id, parsed.data.category)) {
			return fail(400, { errors: { category: ["Pick a category."] } });
		}
		PersonalExpenseDTO.create(locals.user.id, parsed.data);
		return { created: true };
	},
	update: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const formData = await request.formData();
		const target = parseForm(idSchema, formData);
		const existing =
			target.success &&
			PersonalExpenseDTO.findForUser(target.data.id, locals.user.id);
		if (!existing) {
			return fail(404, { error: "That expense no longer exists." });
		}
		const parsed = parsePersonalForm(formData);
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		if (!ownsFolder(locals.user.id, parsed.data.folderId)) {
			return fail(404, { error: "That folder no longer exists." });
		}
		if (!knownCategory(locals.user.id, parsed.data.category)) {
			return fail(400, { errors: { category: ["Pick a category."] } });
		}
		const current = existing.toJSON();
		existing.update(
			current.fromBank
				? {
						...parsed.data,
						description: current.description,
						amountMinor: current.amountMinor,
						currency: current.currency,
						kind: current.kind,
					}
				: parsed.data,
		);
		const recategorized = current.category !== parsed.data.category;
		return {
			updated: true,
			category: parsed.data.category,
			similar: recategorized
				? PersonalExpenseDTO.similarTo(
						locals.user.id,
						{ id: existing.id, description: current.description },
						parsed.data.category,
					).map((entry) => {
						const { id, description, spentOn, amountMinor, currency } =
							entry.toJSON();
						return { id, description, spentOn, amountMinor, currency };
					})
				: [],
		};
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
	monthStart: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const parsed = parseForm(monthStartSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		AppearanceDTO.saveMonthStart(locals.user.id, parsed.data.monthStartDay);
		return { monthStartDay: parsed.data.monthStartDay };
	},
	moveToFolder: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const parsed = parseForm(moveSchema, await request.formData());
		const existing = parsed.success
			? PersonalExpenseDTO.findForUser(parsed.data.id, locals.user.id)
			: undefined;
		if (!parsed.success || !existing) {
			return fail(404, { error: "That expense no longer exists." });
		}
		if (!ownsFolder(locals.user.id, parsed.data.folderId)) {
			return fail(404, { error: "That folder no longer exists." });
		}
		existing.moveTo(parsed.data.folderId || null);
		return { moved: true };
	},
	applyCategory: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const formData = await request.formData();
		const parsed = applyCategorySchema.safeParse({
			category: formData.get("category"),
			ids: formData.getAll("ids"),
		});
		if (
			!parsed.success ||
			!knownCategory(locals.user.id, parsed.data.category)
		) {
			return fail(400, { error: "Pick the expenses to move." });
		}
		return {
			moved: PersonalExpenseDTO.recategorize(
				locals.user.id,
				parsed.data.ids,
				parsed.data.category,
			),
		};
	},
	saveFolder: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const parsed = parseForm(folderSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		if (!parsed.data.id) {
			return {
				folderId: PersonalFolderDTO.create(locals.user.id, parsed.data.name),
			};
		}
		const folder = PersonalFolderDTO.findForUser(
			parsed.data.id,
			locals.user.id,
		);
		if (!folder) {
			return fail(404, { error: "That folder no longer exists." });
		}
		folder.rename(parsed.data.name);
		return { folderId: folder.id };
	},
	deleteFolder: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const parsed = parseForm(idSchema, await request.formData());
		const folder = parsed.success
			? PersonalFolderDTO.findForUser(parsed.data.id, locals.user.id)
			: undefined;
		if (!folder) {
			return fail(404, { error: "That folder no longer exists." });
		}
		folder.delete();
		redirect(303, resolve("/(protected)/personal"));
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
		const { group, members } = groupAccess.forMember(
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
				: await exchangeRates.rate(
						entry.currency,
						group.currency,
						entry.spentOn,
					);
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
				category: categories.some((option) => option.value === entry.category)
					? entry.category
					: "other",
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
};
