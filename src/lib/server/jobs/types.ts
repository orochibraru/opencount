import type { EmailMessage } from "#lib/server/mailer.js";

export interface JobPayloads {
	"jobs.prune": { olderThanDays: number };
	"email.send": EmailMessage;
	"recurring.run": Record<string, never>;
}

export type JobType = keyof JobPayloads;
