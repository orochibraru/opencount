CREATE TABLE `app_lock` (
	`user_id` text PRIMARY KEY NOT NULL,
	`passcode_hash` text NOT NULL,
	`lock_after_minutes` integer DEFAULT 5 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session_lock` (
	`session_id` text PRIMARY KEY NOT NULL,
	`last_active_at` integer NOT NULL,
	`locked` integer DEFAULT false NOT NULL,
	`failed_attempts` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade
);
