import { JobDTO } from "#lib/dto/job.js";
import { RecurringExpenseDTO } from "#lib/dto/recurring-expense.js";
import type { JobPayloads, JobType } from "#lib/server/jobs/types.js";
import { Logger } from "#lib/server/logger.js";
import { deliverEmail } from "#lib/server/mailer.js";

const logger = new Logger("Jobs");

const dayMs = 24 * 60 * 60 * 1000;

export type JobHandlers = {
	[Type in JobType]: (payload: JobPayloads[Type]) => void | Promise<void>;
};

export const jobHandlers: JobHandlers = {
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
	"jobs.prune": ({ olderThanDays }) => {
		const removed = JobDTO.pruneFinished(
			new Date(Date.now() - olderThanDays * dayMs),
		);
		logger.info("Pruned finished jobs", { removed });
		JobDTO.enqueue(
			"jobs.prune",
			{ olderThanDays },
			{ runAt: new Date(Date.now() + dayMs) },
		);
	},
};
