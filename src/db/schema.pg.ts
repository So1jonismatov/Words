// Postgres schema. Mirrors schema.sqlite.ts column-for-column with identical JS types.
import { pgTable, text, integer, bigint, boolean, serial, index, uniqueIndex, primaryKey } from "drizzle-orm/pg-core";

export const participants = pgTable(
  "participants",
  {
    id: text("id").primaryKey(),
    tokenHash: text("token_hash").notNull(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    ageGroup: text("age_group").notNull(),
    gender: text("gender"),
    country: text("country").notNull(),
    countryOther: text("country_other"),
    region: text("region"),
    education: text("education"),
    background: text("background"),
    uiLang: text("ui_lang").notNull(),
    /** Survey link the participant arrived through (null = the general survey). */
    linkId: text("link_id"),
    /** sha256 of the participant's delete code (shown on the results page; lets them delete without the cookie). */
    deleteCodeHash: text("delete_code_hash"),
    consentAt: bigint("consent_at", { mode: "number" }).notNull(),
    surveyCompletedAt: bigint("survey_completed_at", { mode: "number" }),
    completedAt: bigint("completed_at", { mode: "number" }),
  },
  (t) => [
    uniqueIndex("participants_token_idx").on(t.tokenHash),
    index("participants_created_idx").on(t.createdAt),
    index("participants_link_idx").on(t.linkId),
    uniqueIndex("participants_delete_code_idx").on(t.deleteCodeHash),
  ],
);

export const questionnaireAnswers = pgTable("questionnaire_answers", {
  participantId: text("participant_id")
    .primaryKey()
    .references(() => participants.id, { onDelete: "cascade" }),
  q1Text: text("q1_text"),
  q1Normalized: text("q1_normalized"),
  q2Choices: text("q2_choices").notNull().default("[]"),
  q2Other: text("q2_other"),
  q3: text("q3"),
  q4: text("q4"),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const cueWords = pgTable(
  "cue_words",
  {
    id: serial("id").primaryKey(),
    text: text("text").notNull(),
    lang: text("lang").notNull().default("uz"),
    active: boolean("active").notNull().default(true),
    needsReview: boolean("needs_review").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    /** Short dictionary gloss as JSON {uz, en, ru}; null = none yet. Shown on the results word map. */
    meaning: text("meaning"),
    /** Related words (JSON array of canonical Uzbek words) drawn as links on the word map. */
    related: text("related").notNull().default("[]"),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => [uniqueIndex("cue_words_text_idx").on(t.text)],
);

export const cueAssignments = pgTable(
  "cue_assignments",
  {
    participantId: text("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    cueId: integer("cue_id")
      .notNull()
      .references(() => cueWords.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    /** 1 = the first set of cues; each "play more words" adds the next round. */
    round: integer("round").notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.participantId, t.cueId] })],
);

export const responses = pgTable(
  "responses",
  {
    id: serial("id").primaryKey(),
    participantId: text("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    cueId: integer("cue_id")
      .notNull()
      .references(() => cueWords.id, { onDelete: "cascade" }),
    slot: integer("slot").notNull(),
    rawText: text("raw_text"),
    normalizedText: text("normalized_text"),
    status: text("status", { enum: ["answered", "unknown", "no_more", "skipped"] }).notNull(),
    latencyMs: integer("latency_ms"),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => [
    index("responses_cue_norm_idx").on(t.cueId, t.normalizedText),
    index("responses_participant_idx").on(t.participantId),
  ],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/**
 * Shareable survey links (/s/<id>). Each link has its own cue-word pool and its own
 * number of cues per participant. `cueIds` is a JSON array of cue_words.id.
 */
export const surveyLinks = pgTable("survey_links", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  cueIds: text("cue_ids").notNull().default("[]"),
  cuesPerParticipant: integer("cues_per_participant").notNull().default(18),
  active: boolean("active").notNull().default(true),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
