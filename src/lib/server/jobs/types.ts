import type { EmailMessage } from "#lib/server/mailer.js";
import type { PushNotification } from "#lib/server/push.js";

export interface JobPayloads {
	"jobs.prune": { olderThanDays: number };
	"email.send": EmailMessage;
	"recurring.run": Record<string, never>;
	"push.send": PushNotification & { userIds: string[] };
}

export type JobType = keyof JobPayloads;
