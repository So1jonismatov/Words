CREATE TABLE "survey_links" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"cue_ids" text DEFAULT '[]' NOT NULL,
	"cues_per_participant" integer DEFAULT 18 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "participants" ADD COLUMN "link_id" text;--> statement-breakpoint
CREATE INDEX "participants_link_idx" ON "participants" USING btree ("link_id");