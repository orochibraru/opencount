import { fail } from "@sveltejs/kit";
import { z } from "zod";

import { getSetting, sessionDayOptions, setSetting } from "#lib/dto/setting.js";
import { adminFrom } from "#lib/server/admin.js";
import { publicOrigin } from "#lib/server/auth.js";
import { getConfig } from "#lib/server/config.js";
import { isEmailConfigured } from "#lib/server/mailer.js";
import { parseForm } from "#lib/server/validation/form.js";

const accessSchema = z.object({
	signUpsEnabled: z.stringbool().default(false),
	requireTwoFactor: z.stringbool().default(false),
	requirePasskey: z.stringbool().default(false),
	requireAppLock: z.stringbool().default(false),
	sessionDays: z.coerce
		.number()
		.pipe(z.literal(sessionDayOptions, "Pick how long sessions last.")),
	publicOrigin: z
		.url({
			protocol: /^https?$/,
			error: "Enter the address people open, like https://count.example.",
		})
		.transform((value) => new URL(value).origin)
		.optional(),
});

export const load = async ({ parent }) => {
	await parent();
	return {
		signUpsEnabled: getSetting("signUpsEnabled"),
		requireTwoFactor: getSetting("requireTwoFactor"),
		requirePasskey: getSetting("requirePasskey"),
		requireAppLock: getSetting("requireAppLock"),
		sessionDays: getSetting("sessionDays"),
		publicOrigin: publicOrigin() ?? "",
		originPinned: getConfig().origin !== undefined,
		emailConfigured: isEmailConfigured(),
	};
};

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
		setSetting("requireAppLock", parsed.data.requireAppLock);
		setSetting("sessionDays", parsed.data.sessionDays);
		if (parsed.data.publicOrigin) {
			setSetting("publicOrigin", parsed.data.publicOrigin);
		}
		return { saved: true };
	},
};
