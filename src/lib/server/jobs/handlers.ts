import { BankConnectionDTO } from "#lib/dto/bank-connection.js";
import { DownloadDTO } from "#lib/dto/download.js";
import { ExpenseDTO } from "#lib/dto/expense.js";
import { GroupDTO } from "#lib/dto/group.js";
import { JobDTO } from "#lib/dto/job.js";
import { RecurringExpenseDTO } from "#lib/dto/recurring-expense.js";
import { queueBankSync, syncBank } from "#lib/server/bank-sync.js";
import { buildDownload, pruneDownloads } from "#lib/server/downloads.js";
import type { JobPayloads, JobType } from "#lib/server/jobs/types.js";
import { Logger } from "#lib/server/logger.js";
import { deliverEmail } from "#lib/server/mailer.js";
import { deliverPush } from "#lib/server/push.js";

const logger = new Logger("Jobs");

const dayMs = 24 * 60 * 60 * 1000;
const personalPath = "/personal";

export type JobHandlers = {
	[Type in JobType]: (payload: JobPayloads[Type]) => void | Promise<void>;
};

export const jobHandlers: JobHandlers = {
	"push.send": async ({ userIds, ...notification }) => {
		const delivered = await deliverPush(userIds, notification);
		logger.debug("Push sent", { delivered });
	},
	"email.send": async (message) => {
		await deliverEmail(message);
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
	"bank.sync": async ({ connectionId, full }) => {
		const connection = BankConnectionDTO.find(connectionId);
		if (!connection) {
			logger.warn("Bank link gone before it was synced", { connectionId });
			return;
		}
		const added = await syncBank(connection, full);
		logger.info("Bank synced", { added });
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
		const ids = BankConnectionDTO.activeIds();
		for (const connectionId of ids) {
			const connection = BankConnectionDTO.find(connectionId);
			if (connection) {
				queueBankSync(connection);
			}
		}
		logger.info("Queued bank syncs", { links: ids.length });
		JobDTO.enqueue("bank.syncAll", {}, { runAt: new Date(Date.now() + dayMs) });
	},
	"download.build": async ({ downloadId }) => {
		const download = DownloadDTO.find(downloadId);
		if (!download) {
			logger.warn("Download gone before it was built", { downloadId });
			return;
		}
		await buildDownload(download);
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
		const downloads = pruneDownloads(new Date(Date.now() - dayMs));
		logger.info("Pruned downloads", { removed: downloads });
		JobDTO.enqueue(
			"jobs.prune",
			{ olderThanDays },
			{ runAt: new Date(Date.now() + dayMs) },
		);
	},
};
