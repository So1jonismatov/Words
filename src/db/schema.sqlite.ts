// SQLite / libSQL schema. Keep in sync with schema.pg.ts — both describe the same
// tables with the same JS-side types, so app code is dialect-agnostic.
import { sqliteTable, text, integer, index, uniqueIndex, primaryKey } from "drizzle-orm/sqlite-core";

export const participants = sqliteTable(
  "participants",
  {
    id: text("id").primaryKey(),
    tokenHash: text("token_hash").notNull(),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
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
    consentAt: integer("consent_at", { mode: "number" }).notNull(),
    surveyCompletedAt: integer("survey_completed_at", { mode: "number" }),
    completedAt: integer("completed_at", { mode: "number" }),
  },
  (t) => [
    uniqueIndex("participants_token_idx").on(t.tokenHash),
    index("participants_created_idx").on(t.createdAt),
    index("participants_link_idx").on(t.linkId),
    uniqueIndex("participants_delete_code_idx").on(t.deleteCodeHash),
  ],
);

export const questionnaireAnswers = sqliteTable("questionnaire_answers", {
  participantId: text("participant_id")
    .primaryKey()
    .references(() => participants.id, { onDelete: "cascade" }),
  q1Text: text("q1_text"),
  q1Normalized: text("q1_normalized"),
  q2Choices: text("q2_choices").notNull().default("[]"),
  q2Other: text("q2_other"),
  q3: text("q3"),
  q4: text("q4"),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
});

export const cueWords = sqliteTable(
  "cue_words",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    text: text("text").notNull(),
    lang: text("lang").notNull().default("uz"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    needsReview: integer("needs_review", { mode: "boolean" }).notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    /** Short dictionary gloss as JSON {uz, en, ru}; null = none yet. Shown on the results word map. */
    meaning: text("meaning"),
    /** Related words (JSON array of canonical Uzbek words) drawn as links on the word map. */
    related: text("related").notNull().default("[]"),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (t) => [uniqueIndex("cue_words_text_idx").on(t.text)],
);

export const cueAssignments = sqliteTable(
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

export const responses = sqliteTable(
  "responses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
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
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (t) => [
    index("responses_cue_norm_idx").on(t.cueId, t.normalizedText),
    index("responses_participant_idx").on(t.participantId),
  ],
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/**
 * Shareable survey links (/s/<id>). Each link has its own cue-word pool and its own
 * number of cues per participant. `cueIds` is a JSON array of cue_words.id.
 */
export const surveyLinks = sqliteTable("survey_links", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  cueIds: text("cue_ids").notNull().default("[]"),
  cuesPerParticipant: integer("cues_per_participant").notNull().default(18),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
});
