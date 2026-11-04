CREATE TABLE `personal_rule` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`pattern` text NOT NULL,
	`category` text,
	`tag` text,
	`pay` integer DEFAULT false NOT NULL,
	`recurring_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recurring_id`) REFERENCES `recurring_series`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `personal_rule_user_id_idx` ON `personal_rule` (`user_id`);--> statement-breakpoint
ALTER TABLE `appearance` ADD `expected_payday` text;