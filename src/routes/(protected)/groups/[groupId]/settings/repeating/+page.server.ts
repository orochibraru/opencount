import { fail } from "@sveltejs/kit";

import { MerchantDTO } from "#lib/dto/merchant.js";
import { RecurringExpenseDTO } from "#lib/dto/recurring-expense.js";
import { groupForMember } from "#lib/server/group-access.js";

const today = () => new Date().toISOString().slice(0, 10);

export const load = async ({ parent }) => {
	const { group } = await parent();
	return {
		rules: RecurringExpenseDTO.forGroup(group.id).map((rule) => rule.toJSON()),
		merchants: MerchantDTO.forGroup(group.id).map((entry) => entry.toJSON()),
	};
};

export const actions = {
	setRecurringActive: async ({ locals, params, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const { group } = groupForMember(params.groupId, locals.user.id);
		const formData = await request.formData();
		const rule = RecurringExpenseDTO.findInGroup(
			group.id,
			String(formData.get("id") ?? ""),
		);
		if (!rule) {
			return fail(404, { error: "That repeating expense no longer exists." });
		}
		const active = formData.get("active") === "true";
		rule.setActive(active, today());
		rule.materialize(today());
		return { saved: true };
	},
	deleteRecurring: async ({ locals, params, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const { group } = groupForMember(params.groupId, locals.user.id);
		const rule = RecurringExpenseDTO.findInGroup(
			group.id,
			String((await request.formData()).get("id") ?? ""),
		);
		if (!rule) {
			return fail(404, { error: "That repeating expense no longer exists." });
		}
		rule.delete();
		return { deleted: true };
	},
};
