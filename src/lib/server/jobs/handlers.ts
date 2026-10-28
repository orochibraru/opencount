import { BankConnectionDTO } from "#lib/dto/bank-connection.js";
import { DownloadDTO } from "#lib/dto/download.js";
import { ExpenseDTO } from "#lib/dto/expense.js";
import { GroupDTO } from "#lib/dto/group.js";
import { JobDTO } from "#lib/dto/job.js";
import { RecurringExpenseDTO } from "#lib/dto/recurring-expense.js";
import { bankSync } from "#lib/server/banking/bank-sync.js";
import { Logger } from "#lib/server/core/logger.js";
import { downloads } from "#lib/server/jobs/downloads.js";
import type { JobPayloads, JobType } from "#lib/server/jobs/types.js";
import { mailer } from "#lib/server/notifications/mailer.js";
import { pushNotifications } from "#lib/server/notifications/push.js";

const logger = new Logger("Jobs");

const dayMs = 24 * 60 * 60 * 1000;
const personalPath = "/personal";
const bankSyncHourUtc = 6;

export type JobHandlers = {
	[Type in JobType]: (payload: JobPayloads[Type]) => void | Promise<void>;
};

export const jobHandlers: JobHandlers = {
	"push.send": async ({ userIds, ...notification }) => {
		const delivered = await pushNotifications.deliver(userIds, notification);
		logger.debug("Push sent", { delivered });
	},
	"email.send": async (message) => {
		await mailer.deliver(message);
		logger.info("Email sent", { subject: message.subject });
	},
	"recurring.run": () => {
		const today = new Date().toISOString().slice(0, 10);
		const added = RecurringExpenseDTO.due(today).reduce(
			(total, rule) => total + rule.materialize(today),
			0,
		);
		logger.info("Added repeating expenses", { added });
		const tomorrow = new Date(`${today}T00:05:00Z`);
		tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
		JobDTO.enqueue("recurring.run", {}, { runAt: tomorrow });
	},
	"bank.sync": async ({ connectionId }) => {
		const connection = BankConnectionDTO.find(connectionId);
		if (!connection) {
			logger.warn("Bank link gone before it was synced", { connectionId });
			return;
		}
		const added = await bankSync.sync(connection);
		logger.info("Bank synced", {
			added,
			accounts: (connection.toJSON().lastReport ?? []).map(
				({ fetched, booked, added: fresh }) => ({
					fetched,
					booked,
					added: fresh,
				}),
			),
		});
		if (added > 0) {
			JobDTO.enqueue("push.send", {
				userIds: [connection.userId],
				title: connection.bankName,
				body: `${added} new ${added === 1 ? "expense" : "expenses"} from your bank.`,
				url: personalPath,
			});
		}
	},
	"bank.syncAll": () => {
		const next = new Date();
		next.setUTCHours(bankSyncHourUtc, 0, 0, 0);
		if (next.getTime() <= Date.now()) {
			next.setUTCDate(next.getUTCDate() + 1);
		}
		JobDTO.enqueue("bank.syncAll", {}, { runAt: next });
		const ids = BankConnectionDTO.activeIds();
		for (const connectionId of ids) {
			const connection = BankConnectionDTO.find(connectionId);
			if (connection) {
				bankSync.queue(connection);
			}
		}
		logger.info("Queued bank syncs", { links: ids.length, next });
	},
	"download.build": async ({ downloadId }) => {
		const download = DownloadDTO.find(downloadId);
		if (!download) {
			logger.warn("Download gone before it was built", { downloadId });
			return;
		}
		await downloads.build(download);
		logger.info("Download built", { kind: download.kind });
	},
	"import.tricount": ({
		groupId,
		userId,
		title,
		url,
		newMembers,
		expenses,
	}) => {
		const group = GroupDTO.findForMember(groupId, userId);
		if (!group) {
			throw new Error("The group is gone, or its importer left it");
		}
		const added = ExpenseDTO.createMany(groupId, expenses, userId, newMembers);
		logger.info("Imported a Tricount", { added });
		JobDTO.enqueue("push.send", {
			userIds: [userId],
			title: group.toJSON().name,
			body: `${title} is imported: ${added} ${added === 1 ? "entry" : "entries"}.`,
			url,
		});
	},
	"jobs.prune": ({ olderThanDays }) => {
		const removed = JobDTO.pruneFinished(
			new Date(Date.now() - olderThanDays * dayMs),
		);
		logger.info("Pruned finished jobs", { removed });
		const pruned = downloads.prune(new Date(Date.now() - dayMs));
		logger.info("Pruned downloads", { removed: pruned });
		JobDTO.enqueue(
			"jobs.prune",
			{ olderThanDays },
			{ runAt: new Date(Date.now() + dayMs) },
		);
	},
};
