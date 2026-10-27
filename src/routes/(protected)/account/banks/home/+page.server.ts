import { fail } from "@sveltejs/kit";
import { z } from "zod";

import { AppearanceDTO } from "#lib/dto/appearance.js";
import { parseForm } from "#lib/server/validation/form.js";

const homeSchema = z.object({ moneyHome: z.stringbool().default(false) });

export const load = async ({ parent }) => {
	const { user } = await parent();
	return { moneyHome: AppearanceDTO.homeFor(user.id) === "money" };
};

export const actions = {
	home: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const parsed = parseForm(homeSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { error: "Pick whether to show the Home tab." });
		}
		AppearanceDTO.saveHome(
			locals.user.id,
			parsed.data.moneyHome ? "money" : "groups",
		);
		return { saved: true };
	},
};
