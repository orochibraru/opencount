CREATE TABLE `download` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`group_id` text,
	`kind` text NOT NULL,
	`file_name` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`error` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `group`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `download_user_id_idx` ON `download` (`user_id`);--> statement-breakpoint
ALTER TABLE `expense` ADD `original_currency` text;--> statement-breakpoint
ALTER TABLE `expense` ADD `original_amount_minor` integer;--> statement-breakpoint
ALTER TABLE `expense` ADD `exchange_rate` real;--> statement-breakpoint
ALTER TABLE `group` ADD `invite_nonce` text;