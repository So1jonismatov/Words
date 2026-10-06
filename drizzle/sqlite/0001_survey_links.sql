CREATE TABLE `survey_links` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`cue_ids` text DEFAULT '[]' NOT NULL,
	`cues_per_participant` integer DEFAULT 18 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `participants` ADD `link_id` text;--> statement-breakpoint
CREATE INDEX `participants_link_idx` ON `participants` (`link_id`);