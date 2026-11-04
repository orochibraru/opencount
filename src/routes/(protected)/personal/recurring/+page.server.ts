import { fail } from "@sveltejs/kit";

import { RecurringSeriesDTO } from "#lib/dto/recurring-series.js";
import { accountBook } from "#lib/server/money/accounts.js";
import { recurringBook } from "#lib/server/money/recurring.js";
import { parseForm } from "#lib/server/validation/form.js";
import {
	recurringSchema,
	seriesIdSchema,
} from "#lib/server/validation/recurring.js";

export const load = async ({ parent }) => {
	const { user } = await parent();
	return {
		payments: recurringBook.list(user.id),
		series: RecurringSeriesDTO.forUser(user.id).map((entry) => entry.toJSON()),
		accounts: accountBook.list(user.id).map(({ id, name }) => ({ id, name })),
	};
};

export const actions = {
	recurring: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const parsed = parseForm(recurringSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		if (
			recurringBook.labelTaken(
				locals.user.id,
				parsed.data.label,
				parsed.data.seriesId,
			)
		) {
			return fail(400, {
				errors: { label: ["Another series already has this label."] },
			});
		}
		const saved = recurringBook.save(locals.user.id, parsed.data);
		if (!saved) {
			return fail(404, { error: "That series no longer exists." });
		}
		return { recurring: saved.label };
	},
	remove: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const parsed = parseForm(seriesIdSchema, await request.formData());
		if (
			!parsed.success ||
			!recurringBook.remove(locals.user.id, parsed.data.seriesId)
		) {
			return fail(404, { error: "That series no longer exists." });
		}
		return { removed: true };
	},
};
