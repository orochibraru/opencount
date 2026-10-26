import { error } from "@sveltejs/kit";

import { DownloadDTO } from "#lib/dto/download.js";
import { GroupMemberDTO } from "#lib/dto/group-member.js";
import { isAdmin } from "#lib/server/admin.js";
import { downloadPath, downloadTypes } from "#lib/server/downloads.js";

export const GET = ({ locals, params }) => {
	if (!locals.user) {
		error(401, "Sign in again to download.");
	}
	const download = DownloadDTO.findForUser(params.id, locals.user.id);
	const allowed =
		download?.ready &&
		(download.kind === "database"
			? isAdmin(locals.user)
			: download.groupId !== null &&
				GroupMemberDTO.isMember(download.groupId, locals.user.id));
	if (!download || !allowed) {
		error(404, "That file isn't available anymore.");
	}
	return new Response(Bun.file(downloadPath(download.id)), {
		headers: {
			"Content-Type": downloadTypes[download.kind],
			"Content-Disposition": `attachment; filename="${download.fileName}"`,
			"Cache-Control": "private, no-store",
		},
	});
};
