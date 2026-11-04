CREATE TABLE `manual_account` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'checking' NOT NULL,
	`currency` text NOT NULL,
	`shared` integer DEFAULT false NOT NULL,
	`balance_minor` integer DEFAULT 0 NOT NULL,
	`balance_at` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `manual_account_user_id_idx` ON `manual_account` (`user_id`);