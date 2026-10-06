CREATE TABLE `cue_assignments` (
	`participant_id` text NOT NULL,
	`cue_id` integer NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`participant_id`, `cue_id`),
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cue_id`) REFERENCES `cue_words`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `cue_words` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`text` text NOT NULL,
	`lang` text DEFAULT 'uz' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`needs_review` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cue_words_text_idx` ON `cue_words` (`text`);--> statement-breakpoint
CREATE TABLE `participants` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`age_group` text NOT NULL,
	`gender` text,
	`country` text NOT NULL,
	`country_other` text,
	`region` text,
	`education` text,
	`background` text,
	`ui_lang` text NOT NULL,
	`consent_at` integer NOT NULL,
	`survey_completed_at` integer,
	`completed_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `participants_token_idx` ON `participants` (`token_hash`);--> statement-breakpoint
CREATE INDEX `participants_created_idx` ON `participants` (`created_at`);--> statement-breakpoint
CREATE TABLE `questionnaire_answers` (
	`participant_id` text PRIMARY KEY NOT NULL,
	`q1_text` text,
	`q1_normalized` text,
	`q2_choices` text DEFAULT '[]' NOT NULL,
	`q2_other` text,
	`q3` text,
	`q4` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `responses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`participant_id` text NOT NULL,
	`cue_id` integer NOT NULL,
	`slot` integer NOT NULL,
	`raw_text` text,
	`normalized_text` text,
	`status` text NOT NULL,
	`latency_ms` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cue_id`) REFERENCES `cue_words`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `responses_cue_norm_idx` ON `responses` (`cue_id`,`normalized_text`);--> statement-breakpoint
CREATE INDEX `responses_participant_idx` ON `responses` (`participant_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
