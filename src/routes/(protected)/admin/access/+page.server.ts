import { fail } from "@sveltejs/kit";
import { z } from "zod";

import { getSetting, setSetting } from "#lib/dto/setting.js";
import { adminFrom } from "#lib/server/admin.js";
import { isEmailConfigured } from "#lib/server/mailer.js";
import { parseForm } from "#lib/server/validation/form.js";

const accessSchema = z.object({
	signUpsEnabled: z.stringbool().default(false),
	requireTwoFactor: z.stringbool().default(false),
	requirePasskey: z.stringbool().default(false),
});

export const load = () => ({
	signUpsEnabled: getSetting("signUpsEnabled"),
	requireTwoFactor: getSetting("requireTwoFactor"),
	requirePasskey: getSetting("requirePasskey"),
	emailConfigured: isEmailConfigured(),
});

export const actions = {
	default: async ({ locals, request }) => {
		const admin = adminFrom(locals);
		if (!("id" in admin)) {
			return admin;
		}
		const parsed = parseForm(accessSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		if (parsed.data.signUpsEnabled && !isEmailConfigured()) {
			return fail(400, {
				error: "Set up email first: sign-ups verify addresses by email.",
			});
		}
		setSetting("signUpsEnabled", parsed.data.signUpsEnabled);
		setSetting("requireTwoFactor", parsed.data.requireTwoFactor);
		setSetting("requirePasskey", parsed.data.requirePasskey);
		return { saved: true };
	},
};
