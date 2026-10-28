import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { DownloadDTO, type DownloadKind } from "#lib/dto/download.js";
import { GroupDTO } from "#lib/dto/group.js";
import { configuration } from "#lib/server/core/config.js";
import { databaseConnection } from "#lib/server/db/database.js";
import { groupExport } from "#lib/server/expenses/group-export.js";

/** Files built for a person by the worker (exports, backups), kept on disk until they're downloaded or pruned. */
class Downloads {
	readonly types: Record<DownloadKind, string> = {
		database: "application/vnd.sqlite3",
		"group-csv": "text/csv; charset=utf-8",
		"group-pdf": "application/pdf",
	};

	/** Where built files wait to be downloaded: next to the database, or in the system's temporary folder for an in-memory one. */
	directory(): string {
		const { databasePath } = configuration.get();
		return databasePath === ":memory:"
			? join(tmpdir(), "opencount-downloads")
			: join(dirname(databasePath), "downloads");
	}

	/** The file of download `id`. */
	path(id: string): string {
		return join(this.directory(), id);
	}

	/**
	 * Builds the file `download` stands for and marks it ready.
	 *
	 * @throws When the group is gone or its member left, or the file can't be written; the download is marked failed.
	 */
	async build(download: DownloadDTO): Promise<void> {
		mkdirSync(this.directory(), { recursive: true });
		const path = this.path(download.id);
		rmSync(path, { force: true });
		try {
			if (download.kind === "database") {
				databaseConnection.backup(path);
			} else {
				const group = download.groupId
					? GroupDTO.findForMember(download.groupId, download.userId)
					: undefined;
				if (!group) {
					throw new Error("The group is gone, or you left it.");
				}
				const source = groupExport.source(group.id, group.toJSON());
				await Bun.write(
					path,
					download.kind === "group-csv"
						? groupExport.csv(source)
						: await groupExport.pdf(
								source,
								new Date().toISOString().slice(0, 10),
							),
				);
			}
			download.markReady();
		} catch (error) {
			download.markFailed(
				error instanceof Error ? error.message : String(error),
			);
			throw error;
		}
	}

	/** Forgets downloads made before `before` and deletes their files, along with any file no download owns. */
	prune(before: Date): number {
		const removed = DownloadDTO.pruneBefore(before).length;
		const kept = DownloadDTO.ids();
		mkdirSync(this.directory(), { recursive: true });
		for (const name of readdirSync(this.directory())) {
			if (!kept.has(name)) {
				rmSync(join(this.directory(), name), { force: true });
			}
		}
		return removed;
	}

	/** A file name for `name` dated `date`, kept to letters, digits and dashes so it's safe in any header and on any disk. */
	fileName(name: string, date: string, extension: string): string {
		const slug =
			name
				.normalize("NFKD")
				.replaceAll(/[^A-Za-z0-9]+/g, "-")
				.replaceAll(/^-|-$/g, "")
				.toLowerCase() || "opencount";
		return `${slug}-${date}.${extension}`;
	}
}

export const downloads = new Downloads();
