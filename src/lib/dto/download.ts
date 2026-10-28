import { and, desc, eq, inArray, lt } from "drizzle-orm";

import { BaseDTO } from "#lib/dto/base-dto.js";
import { JobDTO } from "#lib/dto/job.js";
import { databaseConnection } from "#lib/server/db/database.js";
import { download, type downloadKinds } from "#lib/server/db/schema.js";

export type DownloadKind = (typeof downloadKinds)[number];

export type DownloadRow = typeof download.$inferSelect;

export class DownloadDTO extends BaseDTO<DownloadRow> {
	/** Records a file for `userId` to build and queues the worker job that builds it. */
	static request(
		userId: string,
		kind: DownloadKind,
		fileName: string,
		groupId: string | null = null,
	): DownloadDTO {
		const row = databaseConnection
			.get()
			.insert(download)
			.values({ userId, kind, fileName, groupId })
			.returning()
			.get();
		JobDTO.enqueue(
			"download.build",
			{ downloadId: row.id },
			{ maxAttempts: 1 },
		);
		return new DownloadDTO(row);
	}

	/** Download `id`, whoever asked for it: for the worker. */
	static find(id: string): DownloadDTO | undefined {
		const row = databaseConnection
			.get()
			.select()
			.from(download)
			.where(eq(download.id, id))
			.get();
		return row ? new DownloadDTO(row) : undefined;
	}

	/** Download `id`, only when `userId` asked for it. */
	static findForUser(id: string, userId: string): DownloadDTO | undefined {
		const row = databaseConnection
			.get()
			.select()
			.from(download)
			.where(and(eq(download.id, id), eq(download.userId, userId)))
			.get();
		return row ? new DownloadDTO(row) : undefined;
	}

	/** The latest files of `kind` `userId` asked for, in `groupId` when given, newest first. */
	static recent(
		userId: string,
		kinds: DownloadKind[],
		groupId?: string,
	): DownloadDTO[] {
		return databaseConnection
			.get()
			.select()
			.from(download)
			.where(
				and(
					eq(download.userId, userId),
					inArray(download.kind, kinds),
					groupId ? eq(download.groupId, groupId) : undefined,
				),
			)
			.orderBy(desc(download.createdAt))
			.limit(5)
			.all()
			.map((row) => new DownloadDTO(row));
	}

	/** Every download id still on record, to tell kept files from leftovers. */
	static ids(): Set<string> {
		return new Set(
			databaseConnection
				.get()
				.select({ id: download.id })
				.from(download)
				.all()
				.map((row) => row.id),
		);
	}

	/** Deletes the records made before `before` and returns their ids, so their files can go too. */
	static pruneBefore(before: Date): string[] {
		return databaseConnection
			.get()
			.delete(download)
			.where(lt(download.createdAt, before))
			.returning({ id: download.id })
			.all()
			.map((row) => row.id);
	}

	get id(): string {
		return this.row.id;
	}

	get kind(): DownloadKind {
		return this.row.kind;
	}

	get groupId(): string | null {
		return this.row.groupId;
	}

	get userId(): string {
		return this.row.userId;
	}

	get fileName(): string {
		return this.row.fileName;
	}

	get ready(): boolean {
		return this.row.status === "ready";
	}

	/** Marks the file built. */
	markReady(): void {
		databaseConnection
			.get()
			.update(download)
			.set({ status: "ready", error: null })
			.where(eq(download.id, this.row.id))
			.run();
	}

	/** Marks the file failed with `message`. */
	markFailed(message: string): void {
		databaseConnection
			.get()
			.update(download)
			.set({ status: "failed", error: message })
			.where(eq(download.id, this.row.id))
			.run();
	}
}
