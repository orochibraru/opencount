ALTER TABLE `personal_expense` ADD `kind` text DEFAULT 'expense' NOT NULL;--> statement-breakpoint
ALTER TABLE `personal_expense` ADD `bank_account_uid` text;--> statement-breakpoint
UPDATE `personal_expense` SET `bank_account_uid` = substr(`bank_ref`, 1, instr(`bank_ref`, ':') - 1) WHERE `bank_ref` IS NOT NULL AND instr(`bank_ref`, ':') > 0;
