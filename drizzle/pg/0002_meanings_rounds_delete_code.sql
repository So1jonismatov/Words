ALTER TABLE "cue_assignments" ADD COLUMN "round" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "cue_words" ADD COLUMN "meaning" text;--> statement-breakpoint
ALTER TABLE "cue_words" ADD COLUMN "related" text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "participants" ADD COLUMN "delete_code_hash" text;--> statement-breakpoint
CREATE UNIQUE INDEX "participants_delete_code_idx" ON "participants" USING btree ("delete_code_hash");