CREATE TABLE `bank_connection` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`session_id` text NOT NULL,
	`bank_name` text NOT NULL,
	`bank_country` text NOT NULL,
	`accounts` text NOT NULL,
	`valid_until` integer NOT NULL,
	`synced_at` integer,
	`last_error` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `bank_connection_user_id_idx` ON `bank_connection` (`user_id`);--> statement-breakpoint
CREATE TABLE `personal_expense` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`description` text NOT NULL,
	`category` text DEFAULT 'other' NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`spent_on` text NOT NULL,
	`bank_ref` text,
	`bank_connection_id` text,
	`shared_expense_id` text,
	`hidden_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bank_connection_id`) REFERENCES `bank_connection`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`shared_expense_id`) REFERENCES `expense`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `personal_expense_user_id_idx` ON `personal_expense` (`user_id`,`spent_on`);--> statement-breakpoint
CREATE UNIQUE INDEX `personal_expense_bank_ref_idx` ON `personal_expense` (`user_id`,`bank_ref`);--> statement-breakpoint
ALTER TABLE `expense` ADD `client_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `expense_client_id_idx` ON `expense` (`group_id`,`client_id`);