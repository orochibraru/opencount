import { fail } from "@sveltejs/kit";
import { z } from "zod";

import { getSetting, setSetting } from "#lib/dto/setting.js";
import { access } from "#lib/server/auth/access.js";
import { parseForm } from "#lib/server/validation/form.js";

const instanceSchema = z.object({
	bankSyncEnabled: z.stringbool().default(false),
	banner: z
		.string()
		.trim()
		.max(300, "Keep the banner under 300 characters.")
		.default(""),
});

export const load = async ({ parent }) => {
	await parent();
	return {
		bankSyncEnabled: getSetting("bankSyncEnabled"),
		banner: getSetting("banner") ?? "",
	};
};

export const actions = {
	default: async ({ locals, request }) => {
		const admin = access.adminFrom(locals);
		if (!("id" in admin)) {
			return admin;
		}
		const parsed = parseForm(instanceSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		setSetting("bankSyncEnabled", parsed.data.bankSyncEnabled);
		setSetting("banner", parsed.data.banner || null);
		return { saved: true };
	},
};
