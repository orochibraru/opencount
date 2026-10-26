import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { DownloadDTO, type DownloadKind } from "#lib/dto/download.js";
import { GroupDTO } from "#lib/dto/group.js";
import { getConfig } from "#lib/server/config.js";
import { backupDatabase } from "#lib/server/db/lib.js";
import { exportSource, groupCsv, groupPdf } from "#lib/server/group-export.js";

/** Where built files wait to be downloaded: next to the database, or in the system's temporary folder for an in-memory one. */
export function downloadsDirectory(): string {
	const { databasePath } = getConfig();
	return databasePath === ":memory:"
		? join(tmpdir(), "opencount-downloads")
		: join(dirname(databasePath), "downloads");
}

/** The file of download `id`. */
export function downloadPath(id: string): string {
	return join(downloadsDirectory(), id);
}

export const downloadTypes: Record<DownloadKind, string> = {
	database: "application/vnd.sqlite3",
	"group-csv": "text/csv; charset=utf-8",
	"group-pdf": "application/pdf",
};

/**
 * Builds the file `download` stands for and marks it ready.
 *
 * @throws When the group is gone or its member left, or the file can't be written; the download is marked failed.
 */
export async function buildDownload(download: DownloadDTO): Promise<void> {
	mkdirSync(downloadsDirectory(), { recursive: true });
	const path = downloadPath(download.id);
	rmSync(path, { force: true });
	try {
		if (download.kind === "database") {
			backupDatabase(path);
		} else {
			const group = download.groupId
				? GroupDTO.findForMember(download.groupId, download.userId)
				: undefined;
			if (!group) {
				throw new Error("The group is gone, or you left it.");
			}
			const source = exportSource(group.id, group.toJSON());
			await Bun.write(
				path,
				download.kind === "group-csv"
					? groupCsv(source)
					: await groupPdf(source, new Date().toISOString().slice(0, 10)),
			);
		}
		download.markReady();
	} catch (error) {
		download.markFailed(error instanceof Error ? error.message : String(error));
		throw error;
	}
}

/** Forgets downloads made before `before` and deletes their files, along with any file no download owns. */
export function pruneDownloads(before: Date): number {
	const removed = DownloadDTO.pruneBefore(before).length;
	const kept = DownloadDTO.ids();
	mkdirSync(downloadsDirectory(), { recursive: true });
	for (const name of readdirSync(downloadsDirectory())) {
		if (!kept.has(name)) {
			rmSync(join(downloadsDirectory(), name), { force: true });
		}
	}
	return removed;
}

/** A file name for `name` dated `date`, kept to letters, digits and dashes so it's safe in any header and on any disk. */
export function downloadFileName(
	name: string,
	date: string,
	extension: string,
): string {
	const slug =
		name
			.normalize("NFKD")
			.replaceAll(/[^A-Za-z0-9]+/g, "-")
			.replaceAll(/^-|-$/g, "")
			.toLowerCase() || "opencount";
	return `${slug}-${date}.${extension}`;
}
