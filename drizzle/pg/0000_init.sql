CREATE TABLE "cue_assignments" (
	"participant_id" text NOT NULL,
	"cue_id" integer NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "cue_assignments_participant_id_cue_id_pk" PRIMARY KEY("participant_id","cue_id")
);
--> statement-breakpoint
CREATE TABLE "cue_words" (
	"id" serial PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"lang" text DEFAULT 'uz' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" bigint NOT NULL,
	"age_group" text NOT NULL,
	"gender" text,
	"country" text NOT NULL,
	"country_other" text,
	"region" text,
	"education" text,
	"background" text,
	"ui_lang" text NOT NULL,
	"consent_at" bigint NOT NULL,
	"survey_completed_at" bigint,
	"completed_at" bigint
);
--> statement-breakpoint
CREATE TABLE "questionnaire_answers" (
	"participant_id" text PRIMARY KEY NOT NULL,
	"q1_text" text,
	"q1_normalized" text,
	"q2_choices" text DEFAULT '[]' NOT NULL,
	"q2_other" text,
	"q3" text,
	"q4" text,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"participant_id" text NOT NULL,
	"cue_id" integer NOT NULL,
	"slot" integer NOT NULL,
	"raw_text" text,
	"normalized_text" text,
	"status" text NOT NULL,
	"latency_ms" integer,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cue_assignments" ADD CONSTRAINT "cue_assignments_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cue_assignments" ADD CONSTRAINT "cue_assignments_cue_id_cue_words_id_fk" FOREIGN KEY ("cue_id") REFERENCES "public"."cue_words"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questionnaire_answers" ADD CONSTRAINT "questionnaire_answers_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responses" ADD CONSTRAINT "responses_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responses" ADD CONSTRAINT "responses_cue_id_cue_words_id_fk" FOREIGN KEY ("cue_id") REFERENCES "public"."cue_words"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cue_words_text_idx" ON "cue_words" USING btree ("text");--> statement-breakpoint
CREATE UNIQUE INDEX "participants_token_idx" ON "participants" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "participants_created_idx" ON "participants" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "responses_cue_norm_idx" ON "responses" USING btree ("cue_id","normalized_text");--> statement-breakpoint
CREATE INDEX "responses_participant_idx" ON "responses" USING btree ("participant_id");