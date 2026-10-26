import { resolve } from "$app/paths";
import { error, fail, redirect } from "@sveltejs/kit";
import { z } from "zod";

import { GroupMemberDTO } from "#lib/dto/group-member.js";
import { GroupDTO } from "#lib/dto/group.js";
import { parseForm } from "#lib/server/validation/form.js";

const joinSchema = z.object({ memberId: z.string().default("") });

function invitedGroup(groupId: string, token: string) {
	const group = GroupDTO.findByInvite(groupId, token);
	if (!group) {
		error(
			404,
			"This invite link is invalid or was turned off. Ask for a new one.",
		);
	}
	return group;
}

function groupPath(groupId: string): string {
	return resolve("/(protected)/groups/[groupId]", { groupId });
}

export const load = async ({ params, parent }) => {
	const { user } = await parent();
	const group = invitedGroup(params.groupId, params.token);
	if (GroupMemberDTO.isMember(group.id, user.id)) {
		redirect(303, groupPath(group.id));
	}
	return {
		invited: { name: group.name, currency: group.currency },
		unlinked: GroupMemberDTO.forGroup(group.id)
			.map((member) => member.toJSON())
			.filter((member) => member.userId === null)
			.map(({ id, displayName }) => ({ id, displayName })),
	};
};

export const actions = {
	default: async ({ locals, params, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const group = invitedGroup(params.groupId, params.token);
		if (GroupMemberDTO.isMember(group.id, locals.user.id)) {
			redirect(303, groupPath(group.id));
		}
		const parsed = parseForm(joinSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { error: "Pick who you are." });
		}
		if (parsed.data.memberId) {
			const member = GroupMemberDTO.findInGroup(group.id, parsed.data.memberId);
			if (!member || member.userId) {
				return fail(400, {
					error: "That person is already someone's account. Pick another.",
				});
			}
			member.linkTo(locals.user.id);
		} else {
			GroupMemberDTO.add(group.id, locals.user.name, locals.user.id);
		}
		redirect(303, groupPath(group.id));
	},
};
