import { fail } from "@sveltejs/kit";
import { z } from "zod";

import { UserDTO } from "#lib/dto/user.js";
import { adminFrom } from "#lib/server/admin.js";
import { parseForm } from "#lib/server/validation/form.js";

const userIdSchema = z.object({ id: z.string().min(1) });

export const load = () => ({
	users: UserDTO.list().map((entry) => entry.toJSON()),
});

export const actions = {
	promote: async ({ locals, request }) => {
		const admin = adminFrom(locals);
		if (!("id" in admin)) {
			return admin;
		}
		const parsed = parseForm(userIdSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { error: "Pick a user." });
		}
		UserDTO.setRole(parsed.data.id, "admin");
		return { promoted: true };
	},
	demote: async ({ locals, request }) => {
		const admin = adminFrom(locals);
		if (!("id" in admin)) {
			return admin;
		}
		const parsed = parseForm(userIdSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { error: "Pick a user." });
		}
		if (parsed.data.id === admin.id) {
			return fail(400, {
				error: "Ask another admin to remove your admin role.",
			});
		}
		UserDTO.setRole(parsed.data.id, "member");
		return { demoted: true };
	},
	revokeSessions: async ({ locals, request }) => {
		const admin = adminFrom(locals);
		if (!("id" in admin)) {
			return admin;
		}
		const parsed = parseForm(userIdSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { error: "Pick a user." });
		}
		UserDTO.revokeSessions(parsed.data.id);
		return { revoked: true };
	},
	delete: async ({ locals, request }) => {
		const admin = adminFrom(locals);
		if (!("id" in admin)) {
			return admin;
		}
		const parsed = parseForm(userIdSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { error: "Pick a user." });
		}
		if (parsed.data.id === admin.id) {
			return fail(400, {
				error: "You can't delete your own account from here.",
			});
		}
		UserDTO.delete(parsed.data.id);
		return { deleted: true };
	},
};
