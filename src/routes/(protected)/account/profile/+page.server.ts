import { fail } from "@sveltejs/kit";
import { z } from "zod";

import { getAuth } from "#lib/server/auth.js";
import { parseForm } from "#lib/server/validation/form.js";

const profileSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, "Enter your name.")
		.max(80, "Keep it under 80 characters."),
});

export const actions = {
	profile: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const parsed = parseForm(profileSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		await getAuth().api.updateUser({
			body: { name: parsed.data.name },
			headers: request.headers,
		});
		return { saved: true };
	},
};
