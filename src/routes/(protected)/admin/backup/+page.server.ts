import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolve } from "$app/paths";
import { fail, redirect } from "@sveltejs/kit";

import { DownloadDTO } from "#lib/dto/download.js";
import { access } from "#lib/server/auth/access.js";
import { Logger } from "#lib/server/core/logger.js";
import { databaseConnection, RestoreError } from "#lib/server/db/database.js";
import { downloads } from "#lib/server/jobs/downloads.js";

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
		const admin = access.adminFrom(locals);
		if (!("id" in admin)) {
			return admin;
		}
		DownloadDTO.request(
			admin.id,
			"database",
			downloads.fileName(
				"opencount",
				new Date().toISOString().slice(0, 10),
				"sqlite",
			),
		);
		return { requested: true };
	},
	restore: async ({ locals, request }) => {
		const admin = access.adminFrom(locals);
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
			databaseConnection.restore(path);
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
