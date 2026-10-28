import { fail } from "@sveltejs/kit";

import { DownloadDTO } from "#lib/dto/download.js";
import { groupAccess } from "#lib/server/expenses/group-access.js";
import { downloads } from "#lib/server/jobs/downloads.js";

const today = () => new Date().toISOString().slice(0, 10);

export const load = async ({ parent }) => {
	const { group, user } = await parent();
	return {
		downloads: DownloadDTO.recent(
			user.id,
			["group-csv", "group-pdf"],
			group.id,
		).map((entry) => entry.toJSON()),
	};
};

export const actions = {
	csv: ({ locals, params }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const { group } = groupAccess.forMember(params.groupId, locals.user.id);
		DownloadDTO.request(
			locals.user.id,
			"group-csv",
			downloads.fileName(group.toJSON().name, today(), "csv"),
			group.id,
		);
		return { requested: true };
	},
	pdf: ({ locals, params }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const { group } = groupAccess.forMember(params.groupId, locals.user.id);
		DownloadDTO.request(
			locals.user.id,
			"group-pdf",
			downloads.fileName(group.toJSON().name, today(), "pdf"),
			group.id,
		);
		return { requested: true };
	},
};
