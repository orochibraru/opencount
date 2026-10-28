import { fail } from "@sveltejs/kit";

import { MerchantDTO } from "#lib/dto/merchant.js";
import { RecurringExpenseDTO } from "#lib/dto/recurring-expense.js";
import { groupAccess } from "#lib/server/expenses/group-access.js";
import {
	activeRuleSchema,
	idSchema,
	parseForm,
} from "#lib/server/validation/form.js";

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
		const { group } = groupAccess.forMember(params.groupId, locals.user.id);
		const parsed = parseForm(activeRuleSchema, await request.formData());
		const rule =
			parsed.success &&
			RecurringExpenseDTO.findInGroup(group.id, parsed.data.id);
		if (!parsed.success || !rule) {
			return fail(404, { error: "That repeating expense no longer exists." });
		}
		rule.setActive(parsed.data.active, today());
		rule.materialize(today());
		return { saved: true };
	},
	deleteRecurring: async ({ locals, params, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const { group } = groupAccess.forMember(params.groupId, locals.user.id);
		const parsed = parseForm(idSchema, await request.formData());
		const rule =
			parsed.success &&
			RecurringExpenseDTO.findInGroup(group.id, parsed.data.id);
		if (!rule) {
			return fail(404, { error: "That repeating expense no longer exists." });
		}
		rule.delete();
		return { deleted: true };
	},
};
