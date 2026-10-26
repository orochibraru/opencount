import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolve } from "$app/paths";
import { fail, redirect } from "@sveltejs/kit";

import { DownloadDTO } from "#lib/dto/download.js";
import { adminFrom } from "#lib/server/admin.js";
import { restoreDatabase, RestoreError } from "#lib/server/db/lib.js";
import { downloadFileName } from "#lib/server/downloads.js";
import { Logger } from "#lib/server/logger.js";

const logger = new Logger("Backup");

const sqliteHeader = "SQLite format 3\0";

export const load = async ({ parent }) => {
	const { user } = await parent();
	return {
		downloads: DownloadDTO.recent(user.id, ["database"]).map((entry) =>
			entry.toJSON(),
		),
	};
};

export const actions = {
	backup: ({ locals }) => {
		const admin = adminFrom(locals);
		if (!("id" in admin)) {
			return admin;
		}
		DownloadDTO.request(
			admin.id,
			"database",
			downloadFileName(
				"opencount",
				new Date().toISOString().slice(0, 10),
				"sqlite",
			),
		);
		return { requested: true };
	},
	restore: async ({ locals, request }) => {
		const admin = adminFrom(locals);
		if (!("id" in admin)) {
			return admin;
		}
		const file = (await request.formData()).get("backup");
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { error: "Pick a backup file." });
		}
		const bytes = new Uint8Array(await file.arrayBuffer());
		if (new TextDecoder().decode(bytes.slice(0, 16)) !== sqliteHeader) {
			return fail(400, { error: "That file isn't an OpenCount backup." });
		}
		const path = join(
			tmpdir(),
			`opencount-restore-${crypto.randomUUID()}.sqlite`,
		);
		await Bun.write(path, bytes);
		try {
			restoreDatabase(path);
		} catch (error) {
			if (error instanceof RestoreError) {
				return fail(400, { error: error.message });
			}
			throw error;
		} finally {
			rmSync(path, { force: true });
		}
		logger.warn("Database restored from a backup", { by: admin.id });
		redirect(303, resolve("/auth/sign-in"));
	},
};
