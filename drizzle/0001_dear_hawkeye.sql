CREATE TABLE `merchant` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`category` text DEFAULT 'other' NOT NULL,
	`use_count` integer DEFAULT 0 NOT NULL,
	`last_used_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `group`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `merchant_group_name_idx` ON `merchant` (`group_id`,`name_key`);--> statement-breakpoint
CREATE TABLE `recurring_expense` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`description` text NOT NULL,
	`category` text DEFAULT 'other' NOT NULL,
	`merchant_id` text,
	`amount_minor` integer NOT NULL,
	`paid_by` text NOT NULL,
	`split_mode` text DEFAULT 'equal' NOT NULL,
	`frequency` text NOT NULL,
	`next_on` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `group`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`merchant_id`) REFERENCES `merchant`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`paid_by`) REFERENCES `group_member`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `recurring_expense_due_idx` ON `recurring_expense` (`active`,`next_on`);--> statement-breakpoint
CREATE TABLE `recurring_share` (
	`recurring_id` text NOT NULL,
	`member_id` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`weight` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`recurring_id`) REFERENCES `recurring_expense`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `group_member`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recurring_share_recurring_member_idx` ON `recurring_share` (`recurring_id`,`member_id`);