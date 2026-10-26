import { GroupDTO } from "#lib/dto/group.js";

export const load = async ({ parent }) => {
	const { user } = await parent();
	return {
		archived: GroupDTO.forMember(user.id, { archived: true }).map((entry) =>
			entry.toJSON(),
		),
	};
};
