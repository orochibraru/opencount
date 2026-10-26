import { beforeEach, describe, expect, test } from "bun:test";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DownloadDTO } from "#lib/dto/download.js";
import { ExpenseDTO } from "#lib/dto/expense.js";
import { GroupMemberDTO } from "#lib/dto/group-member.js";
import { GroupDTO } from "#lib/dto/group.js";
import { JobDTO } from "#lib/dto/job.js";
import { UserDTO } from "#lib/dto/user.js";
import {
	backupDatabase,
	restoreDatabase,
	RestoreError,
} from "#lib/server/db/lib.js";
import {
	buildDownload,
	downloadFileName,
	downloadPath,
	downloadsDirectory,
	pruneDownloads,
} from "#lib/server/downloads.js";
import { exportSource, groupCsv } from "#lib/server/group-export.js";
import { jobHandlers } from "#lib/server/jobs/handlers.js";

import { createUser, resetDatabase } from "../../database.js";

function setUp() {
	const ada = createUser("ada", "Ada");
	const group = GroupDTO.create({
		name: "Café trip",
		currency: "EUR",
		owner: ada,
	});
	const adaMember = GroupMemberDTO.forGroup(group.id)[0]?.id ?? "";
	const sam = GroupMemberDTO.add(group.id, "Sam, Jr.");
	ExpenseDTO.create(
		group.id,
		{
			kind: "expense",
			description: 'The "big" dinner',
			category: "food",
			amountMinor: 3000,
			originalCurrency: "USD",
			originalAmountMinor: 3300,
			exchangeRate: 0.9,
			paidBy: adaMember,
			splitMode: "equal",
			spentOn: "2026-02-01",
			merchantId: null,
			shares: [
				{ memberId: adaMember, amountMinor: 1500, weight: 1 },
				{ memberId: sam.id, amountMinor: 1500, weight: 1 },
			],
		},
		ada.id,
	);
	return { ada, group, sam };
}

function pendingBuild(): number {
	return JobDTO.counts().pending;
}

describe("downloads", () => {
	beforeEach(resetDatabase);

	test("downloadFileName keeps a safe, dated slug", () => {
		expect(downloadFileName("Café trip!", "2026-03-01", "csv")).toBe(
			"cafe-trip-2026-03-01.csv",
		);
		expect(downloadFileName("???", "2026-03-01", "pdf")).toBe(
			"opencount-2026-03-01.pdf",
		);
	});

	test("groupCsv lists every expense with each member's share", () => {
		const { group } = setUp();
		const csv = groupCsv(exportSource(group.id, group.toJSON()));
		const lines = csv.replace("﻿", "").trim().split("\r\n");
		expect(lines[0]).toStartWith(
			"Date,Description,Category,Type,Paid by,Amount,Currency,Original amount,Original currency,Exchange rate,",
		);
		expect(lines[0]).toContain('"Share of Sam, Jr."');
		expect(lines[0]).toContain("Share of Ada");
		expect(lines[1]).toBe(
			'2026-02-01,"The ""big"" dinner",Food & drinks,Expense,Ada,30.00,EUR,33.00,USD,0.9,15.00,15.00',
		);
	});

	test("request queues a build that writes a CSV, a PDF and a database copy", async () => {
		const { ada, group } = setUp();
		const csv = DownloadDTO.request(ada.id, "group-csv", "trip.csv", group.id);
		const pdf = DownloadDTO.request(ada.id, "group-pdf", "trip.pdf", group.id);
		const database = DownloadDTO.request(ada.id, "database", "db.sqlite");
		expect(pendingBuild()).toBe(3);
		await jobHandlers["download.build"]({ downloadId: csv.id });
		await buildDownload(pdf);
		await buildDownload(database);
		expect(await Bun.file(downloadPath(csv.id)).text()).toContain("Ada");
		expect(
			new TextDecoder().decode(
				(await Bun.file(downloadPath(pdf.id)).bytes()).slice(0, 5),
			),
		).toBe("%PDF-");
		expect(
			(await Bun.file(downloadPath(database.id)).bytes()).byteLength,
		).toBeGreaterThan(0);
		expect(
			DownloadDTO.recent(ada.id, ["group-csv", "group-pdf"], group.id).map(
				(entry) => entry.toJSON().status,
			),
		).toEqual(["ready", "ready"]);
		expect(DownloadDTO.findForUser(csv.id, "someone-else")).toBeUndefined();
		expect(DownloadDTO.findForUser(csv.id, ada.id)?.ready).toBe(true);
	});

	test("the PDF prints Greek and Cyrillic names", async () => {
		const ada = createUser("ada", "Ада");
		const group = GroupDTO.create({
			name: "Αθήνα",
			currency: "EUR",
			owner: ada,
		});
		const pdf = DownloadDTO.request(
			ada.id,
			"group-pdf",
			"athens.pdf",
			group.id,
		);
		await buildDownload(pdf);
		expect(DownloadDTO.find(pdf.id)?.ready).toBe(true);
		expect(
			(await Bun.file(downloadPath(pdf.id)).bytes()).byteLength,
		).toBeGreaterThan(1000);
	});

	test("a build for a group the user left fails and says why", async () => {
		const { ada, group } = setUp();
		const download = DownloadDTO.request(
			ada.id,
			"group-csv",
			"trip.csv",
			group.id,
		);
		group.delete();
		await jobHandlers["download.build"]({ downloadId: download.id });
		const other = DownloadDTO.request(ada.id, "group-csv", "trip.csv", null);
		await expect(buildDownload(other)).rejects.toThrow("gone");
		expect(DownloadDTO.find(other.id)?.toJSON().status).toBe("failed");
	});

	test("pruneDownloads forgets old files and sweeps leftovers", async () => {
		const { ada, group } = setUp();
		const kept = DownloadDTO.request(ada.id, "group-csv", "trip.csv", group.id);
		await buildDownload(kept);
		writeFileSync(join(downloadsDirectory(), "leftover"), "x");
		expect(pruneDownloads(new Date(Date.now() - 60_000))).toBe(0);
		expect(existsSync(join(downloadsDirectory(), "leftover"))).toBe(false);
		expect(existsSync(downloadPath(kept.id))).toBe(true);
		expect(pruneDownloads(new Date(Date.now() + 60_000))).toBe(1);
		expect(existsSync(downloadPath(kept.id))).toBe(false);
	});
});

describe("restoreDatabase", () => {
	beforeEach(resetDatabase);

	test("brings back the rows of a backup and keeps the job queue", () => {
		const { group } = setUp();
		const path = join(tmpdir(), `opencount-test-${crypto.randomUUID()}.sqlite`);
		backupDatabase(path);
		group.delete();
		createUser("grace");
		JobDTO.enqueue("jobs.prune", { olderThanDays: 1 });
		const jobs = JobDTO.counts().pending;
		try {
			restoreDatabase(path);
		} finally {
			rmSync(path, { force: true });
		}
		expect(GroupDTO.findForMember(group.id, "ada")?.toJSON().name).toBe(
			"Café trip",
		);
		expect(UserDTO.emailExists("grace@example.com")).toBe(false);
		expect(JobDTO.counts().pending).toBe(jobs);
	});

	test("refuses a file that isn't an OpenCount database", () => {
		const path = join(tmpdir(), `opencount-test-${crypto.randomUUID()}.sqlite`);
		const other = new (require("bun:sqlite").Database)(path);
		other.exec("CREATE TABLE notes (id INTEGER)");
		other.close();
		try {
			expect(() => restoreDatabase(path)).toThrow(RestoreError);
		} finally {
			rmSync(path, { force: true });
		}
	});
});

describe("import.tricount job", () => {
	beforeEach(resetDatabase);

	test("records the expenses and tells the importer", async () => {
		const { ada, group } = setUp();
		const adaMember = GroupMemberDTO.forGroup(group.id)[0]?.id ?? "";
		await jobHandlers["import.tricount"]({
			groupId: group.id,
			userId: ada.id,
			title: "Lisbon",
			url: "/groups/x",
			newMembers: { "new:0": "Cy" },
			expenses: [
				{
					kind: "transfer",
					description: "Payment",
					category: "other",
					amountMinor: 500,
					paidBy: "new:0",
					splitMode: "exact",
					spentOn: "2026-02-02",
					merchantId: null,
					shares: [{ memberId: adaMember, amountMinor: 500, weight: 1 }],
				},
			],
		});
		expect(ExpenseDTO.forGroup(group.id)).toHaveLength(2);
		expect(JobDTO.counts().pending).toBe(1);
	});

	test("fails when the importer left the group", () => {
		const { group } = setUp();
		expect(() =>
			jobHandlers["import.tricount"]({
				groupId: group.id,
				userId: "stranger",
				title: "Lisbon",
				url: "/groups/x",
				newMembers: {},
				expenses: [],
			}),
		).toThrow("left");
	});
});
