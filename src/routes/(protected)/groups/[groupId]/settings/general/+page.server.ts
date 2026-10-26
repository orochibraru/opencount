import { resolve } from "$app/paths";
import { fail, redirect } from "@sveltejs/kit";
import { z } from "zod";

import { currencies } from "#lib/currencies.js";
import { groupForMember } from "#lib/server/group-access.js";
import { parseForm } from "#lib/server/validation/form.js";

const settingsSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, "Give the group a name.")
		.max(60, "Keep it under 60 characters."),
	currency: z.enum(currencies).optional(),
});

export const load = async ({ parent }) => {
	const { group, user } = await parent();
	return {
		currencyLocked: groupForMember(group.id, user.id).group.hasExpenses(),
	};
};

export const actions = {
	save: async ({ locals, params, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const { group } = groupForMember(params.groupId, locals.user.id);
		const parsed = parseForm(settingsSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		group.rename(parsed.data.name);
		if (parsed.data.currency && parsed.data.currency !== group.currency) {
			if (group.hasExpenses()) {
				return fail(400, {
					errors: {
						currency: ["The currency can't change once expenses exist."],
					},
				});
			}
			group.setCurrency(parsed.data.currency);
		}
		return { saved: true };
	},
	delete: ({ locals, params }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const { group } = groupForMember(params.groupId, locals.user.id);
		if (!group.isOwnedBy(locals.user.id)) {
			return fail(403, {
				error: "Only the person who created the group can delete it.",
			});
		}
		group.delete();
		redirect(303, resolve("/(protected)"));
	},
	setArchived: async ({ locals, params, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const { group } = groupForMember(params.groupId, locals.user.id);
		const archived = (await request.formData()).get("archived") === "true";
		group.setArchived(locals.user.id, archived);
		return { archived };
	},
};
