CREATE TABLE `recurring_series` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`label` text NOT NULL,
	`type` text DEFAULT 'other' NOT NULL,
	`frequency` text,
	`end_date` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recurring_series_user_label_idx` ON `recurring_series` (`user_id`,`label`);--> statement-breakpoint
ALTER TABLE `personal_expense` ADD `recurring_id` text REFERENCES recurring_series(id) ON DELETE set null;