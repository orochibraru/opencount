import { resolve } from "$app/paths";
import { fail, redirect } from "@sveltejs/kit";
import { z } from "zod";

import { GroupMemberDTO } from "#lib/dto/group-member.js";
import { UserDTO } from "#lib/dto/user.js";
import { publicOrigin } from "#lib/server/auth.js";
import { groupForMember } from "#lib/server/group-access.js";
import { emailSchema } from "#lib/server/validation/auth.js";
import { parseForm } from "#lib/server/validation/form.js";

const nameSchema = z
	.string()
	.trim()
	.min(1, "Enter a name.")
	.max(60, "Keep it under 60 characters.");

const addSchema = z.object({
	displayName: nameSchema,
	email: z.union([z.literal(""), emailSchema]).default(""),
});

const renameSchema = z.object({
	id: z.string().min(1),
	displayName: nameSchema,
});
const memberIdSchema = z.object({ id: z.string().min(1) });

export const load = async ({ parent, url }) => {
	const { group, user } = await parent();
	const token = groupForMember(group.id, user.id).group.inviteToken();
	return {
		inviteUrl: token
			? new URL(
					resolve("/(protected)/join/[groupId]/[token]", {
						groupId: group.id,
						token,
					}),
					publicOrigin() ?? url.origin,
				).href
			: null,
	};
};

export const actions = {
	resetInvite: ({ locals, params }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		groupForMember(params.groupId, locals.user.id).group.resetInvite();
		return { inviteReset: true };
	},
	disableInvite: ({ locals, params }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		groupForMember(params.groupId, locals.user.id).group.disableInvite();
		return { inviteDisabled: true };
	},
	add: async ({ locals, params, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const { group } = groupForMember(params.groupId, locals.user.id);
		const parsed = parseForm(addSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		let userId: string | null = null;
		if (parsed.data.email) {
			userId = UserDTO.idForEmail(parsed.data.email) ?? null;
			if (!userId) {
				return fail(400, {
					errors: {
						email: [
							"No account uses that email. Leave it empty, or ask an admin to invite them.",
						],
					},
				});
			}
			if (GroupMemberDTO.isMember(group.id, userId)) {
				return fail(400, {
					errors: { email: ["They're already in this group."] },
				});
			}
		}
		GroupMemberDTO.add(group.id, parsed.data.displayName, userId);
		return { added: true };
	},
	rename: async ({ locals, params, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const { group } = groupForMember(params.groupId, locals.user.id);
		const parsed = parseForm(renameSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		const member = GroupMemberDTO.findInGroup(group.id, parsed.data.id);
		if (!member) {
			return fail(404, { error: "That member is no longer in the group." });
		}
		member.rename(parsed.data.displayName);
		return { renamed: true };
	},
	remove: async ({ locals, params, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const { group } = groupForMember(params.groupId, locals.user.id);
		const parsed = parseForm(memberIdSchema, await request.formData());
		const member = parsed.success
			? GroupMemberDTO.findInGroup(group.id, parsed.data.id)
			: undefined;
		if (!member) {
			return fail(404, { error: "That member is no longer in the group." });
		}
		if (member.userId === locals.user.id) {
			return fail(400, {
				error: "You can't remove yourself. Leave the group instead.",
			});
		}
		if (member.userId !== null && member.userId === group.toJSON().createdBy) {
			return fail(400, { error: "The group's creator can't be removed." });
		}
		if (member.isInvolved()) {
			return fail(400, {
				error: "They're part of expenses. Delete or edit those first.",
			});
		}
		member.remove();
		return { removed: true };
	},
	leave: ({ locals, params }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const { group, members } = groupForMember(params.groupId, locals.user.id);
		if (group.isOwnedBy(locals.user.id)) {
			return fail(400, {
				error:
					"You created this group, so you can't leave it. Delete it instead.",
			});
		}
		members.find((member) => member.userId === locals.user?.id)?.unlink();
		redirect(303, resolve("/(protected)"));
	},
	claim: async ({ locals, params, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const { group, members } = groupForMember(params.groupId, locals.user.id);
		const parsed = parseForm(memberIdSchema, await request.formData());
		const target = parsed.success
			? GroupMemberDTO.findInGroup(group.id, parsed.data.id)
			: undefined;
		if (!target) {
			return fail(404, { error: "That member is no longer in the group." });
		}
		if (target.userId) {
			return fail(400, { error: "That member is already someone's account." });
		}
		const me = members.find((member) => member.userId === locals.user?.id);
		if (!me) {
			return fail(404, { error: "You're not in this group anymore." });
		}
		target.takeOver(me);
		return { claimed: true };
	},
};
