ALTER TABLE `expense` ADD `merchant_id` text REFERENCES merchant(id);--> statement-breakpoint
ALTER TABLE `expense` ADD `recurring_id` text REFERENCES recurring_expense(id);