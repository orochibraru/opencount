CREATE TABLE `bank_credential` (
	`user_id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`encrypted_private_key` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `personal_folder` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `personal_folder_user_id_idx` ON `personal_folder` (`user_id`);--> statement-breakpoint
ALTER TABLE `personal_expense` ADD `folder_id` text REFERENCES personal_folder(id);