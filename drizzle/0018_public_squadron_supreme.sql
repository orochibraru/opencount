ALTER TABLE `bank_connection` ADD `bank_logo` text;--> statement-breakpoint
ALTER TABLE `bank_connection` ADD `sync_state` text DEFAULT 'idle' NOT NULL;--> statement-breakpoint
ALTER TABLE `bank_connection` ADD `sync_state_at` integer;--> statement-breakpoint
ALTER TABLE `bank_connection` ADD `last_added` integer;