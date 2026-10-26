PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_appearance` (
	`user_id` text PRIMARY KEY NOT NULL,
	`accent` text DEFAULT 'bordeaux' NOT NULL,
	`theme` text DEFAULT 'system' NOT NULL,
	`dark_variant` text DEFAULT 'default' NOT NULL,
	`font` text DEFAULT 'default' NOT NULL,
	`corners` text DEFAULT 'rounded' NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_appearance`("user_id", "accent", "theme", "dark_variant", "font", "corners", "updated_at") SELECT "user_id", "accent", "theme", "dark_variant", "font", "corners", "updated_at" FROM `appearance`;--> statement-breakpoint
DROP TABLE `appearance`;--> statement-breakpoint
ALTER TABLE `__new_appearance` RENAME TO `appearance`;--> statement-breakpoint
PRAGMA foreign_keys=ON;