import { fail } from "@sveltejs/kit";
import { z } from "zod";

import { settleUp } from "#lib/balances.js";
import { ExpenseDTO } from "#lib/dto/expense.js";
import { groupAccess } from "#lib/server/expenses/group-access.js";
import { parseForm } from "#lib/server/validation/form.js";

const transferSchema = z.object({
	from: z.string().min(1),
	to: z.string().min(1),
	amountMinor: z.coerce.number().int().positive(),
});

export const load = async ({ parent }) => {
	const { balances } = await parent();
	return { transfers: settleUp(new Map(Object.entries(balances))) };
};

export const actions = {
	settle: async ({ locals, params, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const { group, members } = groupAccess.forMember(
			params.groupId,
			locals.user.id,
		);
		const parsed = parseForm(transferSchema, await request.formData());
		const memberIds = new Set(members.map((member) => member.id));
		if (
			!parsed.success ||
			!memberIds.has(parsed.data.from) ||
			!memberIds.has(parsed.data.to) ||
			parsed.data.from === parsed.data.to
		) {
			return fail(400, { error: "That payment doesn't match this group." });
		}
		ExpenseDTO.create(
			group.id,
			{
				kind: "transfer",
				description: "Payment",
				category: "other",
				amountMinor: parsed.data.amountMinor,
				paidBy: parsed.data.from,
				splitMode: "exact",
				spentOn: new Date().toISOString().slice(0, 10),
				merchantId: null,
				shares: [
					{
						memberId: parsed.data.to,
						amountMinor: parsed.data.amountMinor,
						weight: 1,
					},
				],
			},
			locals.user.id,
		);
		return { settled: true };
	},
};
