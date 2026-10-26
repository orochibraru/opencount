import { resolve } from "$app/paths";
import { fail } from "@sveltejs/kit";
import { z } from "zod";

import { InviteDTO } from "#lib/dto/invite.js";
import { UserDTO } from "#lib/dto/user.js";
import { adminFrom } from "#lib/server/admin.js";
import { publicOrigin } from "#lib/server/auth.js";
import { inviteEmail, queueEmail } from "#lib/server/emails.js";
import { isEmailConfigured } from "#lib/server/mailer.js";
import { emailSchema } from "#lib/server/validation/auth.js";
import { parseForm } from "#lib/server/validation/form.js";

const inviteSchema = z.object({ email: emailSchema });
const inviteIdSchema = z.object({ id: z.string().min(1) });

export const load = () => ({
	invites: InviteDTO.list().map((invite) => invite.toJSON()),
	emailConfigured: isEmailConfigured(),
});

export const actions = {
	create: async ({ locals, request, url }) => {
		const admin = adminFrom(locals);
		if (!("id" in admin)) {
			return admin;
		}
		const parsed = parseForm(inviteSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		if (UserDTO.emailExists(parsed.data.email)) {
			return fail(400, {
				errors: { email: ["That email already has an account."] },
			});
		}
		const { token } = InviteDTO.create(parsed.data.email, admin.id);
		const link = new URL(
			resolve("/auth/invite/[token]", { token }),
			publicOrigin() ?? url.origin,
		).href;
		const emailed = isEmailConfigured();
		if (emailed) {
			queueEmail(inviteEmail(parsed.data.email, link, admin.name));
		}
		return { link, emailed };
	},
	revoke: async ({ locals, request }) => {
		const admin = adminFrom(locals);
		if (!("id" in admin)) {
			return admin;
		}
		const parsed = parseForm(inviteIdSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { error: "Pick an invite." });
		}
		InviteDTO.revoke(parsed.data.id);
		return { revoked: true };
	},
};
