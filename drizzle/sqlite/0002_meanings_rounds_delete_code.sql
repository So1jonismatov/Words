ALTER TABLE `cue_assignments` ADD `round` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `cue_words` ADD `meaning` text;--> statement-breakpoint
ALTER TABLE `cue_words` ADD `related` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `participants` ADD `delete_code_hash` text;--> statement-breakpoint
CREATE UNIQUE INDEX `participants_delete_code_idx` ON `participants` (`delete_code_hash`);