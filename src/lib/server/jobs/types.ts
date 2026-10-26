import type { ExpenseInput } from "#lib/dto/expense.js";
import type { EmailMessage } from "#lib/server/mailer.js";
import type { PushNotification } from "#lib/server/push.js";

export interface JobPayloads {
	"jobs.prune": { olderThanDays: number };
	"email.send": EmailMessage;
	"recurring.run": Record<string, never>;
	"push.send": PushNotification & { userIds: string[] };
	"download.build": { downloadId: string };
	"import.tricount": {
		groupId: string;
		userId: string;
		title: string;
		url: string;
		newMembers: Record<string, string>;
		expenses: ExpenseInput[];
	};
}

export type JobType = keyof JobPayloads;
