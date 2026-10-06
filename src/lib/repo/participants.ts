import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { sha256 } from "@/lib/secret";
import { normalizeAnswer } from "@/lib/normalize";
import { deleteCodeFor, hashDeleteCode } from "@/lib/delete-code";

export interface Demographics {
  ageGroup: string;
  gender: string | null;
  country: string;
  countryOther: string | null;
  region: string | null;
  education: string | null;
  background: string | null;
  uiLang: string;
  /** Survey link the participant came through, if any. */
  linkId?: string | null;
}

export type Participant = Awaited<ReturnType<typeof findParticipantByToken>>;

export async function createParticipant(input: Demographics): Promise<{ id: string; token: string }> {
  const { db, t } = getDb();
  const id = crypto.randomUUID();
  const token = crypto.randomBytes(32).toString("base64url");
  const now = Date.now();
  await db.insert(t.participants).values({
    id,
    tokenHash: sha256(token),
    deleteCodeHash: hashDeleteCode(deleteCodeFor(token)),
    createdAt: now,
    consentAt: now,
    ...input,
  });
  return { id, token };
}

/**
 * The participant's delete code (derived from their session token). Stores its hash if
 * missing, for participants created before delete codes existed.
 */
export async function ensureDeleteCode(participant: { id: string; deleteCodeHash: string | null }, token: string): Promise<string> {
  const code = deleteCodeFor(token);
  const hash = hashDeleteCode(code);
  if (participant.deleteCodeHash !== hash) {
    const { db, t } = getDb();
    await db.update(t.participants).set({ deleteCodeHash: hash }).where(eq(t.participants.id, participant.id));
  }
  return code;
}

export async function findParticipantIdByDeleteCode(code: string): Promise<string | null> {
  const { db, t } = getDb();
  const rows = await db
    .select({ id: t.participants.id })
    .from(t.participants)
    .where(eq(t.participants.deleteCodeHash, hashDeleteCode(code)))
    .limit(1);
  return rows[0]?.id ?? null;
}

export async function updateDemographics(id: string, input: Demographics) {
  const { db, t } = getDb();
  await db.update(t.participants).set({ ...input, consentAt: Date.now() }).where(eq(t.participants.id, id));
}

export async function findParticipantByToken(token: string | undefined) {
  if (!token) return null;
  const { db, t } = getDb();
  const rows = await db.select().from(t.participants).where(eq(t.participants.tokenHash, sha256(token))).limit(1);
  return rows[0] ?? null;
}

export async function markSurveyCompleted(id: string) {
  const { db, t } = getDb();
  await db.update(t.participants).set({ surveyCompletedAt: Date.now() }).where(eq(t.participants.id, id));
}

export async function markGameCompleted(id: string) {
  const { db, t } = getDb();
  await db.update(t.participants).set({ completedAt: Date.now() }).where(eq(t.participants.id, id));
}

/** "Delete my data": removes every row linked to the participant. */
export async function deleteParticipant(id: string) {
  const { db, t } = getDb();
  await db.delete(t.responses).where(eq(t.responses.participantId, id));
  await db.delete(t.cueAssignments).where(eq(t.cueAssignments.participantId, id));
  await db.delete(t.questionnaireAnswers).where(eq(t.questionnaireAnswers.participantId, id));
  await db.delete(t.participants).where(eq(t.participants.id, id));
}

export interface QuestionnairePatch {
  q1Text?: string | null;
  q2Choices?: string[];
  q2Other?: string | null;
  q3?: string | null;
  q4?: string | null;
}

export async function saveQuestionnaire(participantId: string, patch: QuestionnairePatch) {
  const { db, t } = getDb();
  const values: Record<string, unknown> = { updatedAt: Date.now() };
  if (patch.q1Text !== undefined) {
    values.q1Text = patch.q1Text;
    values.q1Normalized = patch.q1Text ? normalizeAnswer(patch.q1Text) || patch.q1Text.trim() : null;
  }
  if (patch.q2Choices !== undefined) values.q2Choices = JSON.stringify(patch.q2Choices);
  if (patch.q2Other !== undefined) values.q2Other = patch.q2Other;
  if (patch.q3 !== undefined) values.q3 = patch.q3;
  if (patch.q4 !== undefined) values.q4 = patch.q4;
  await db
    .insert(t.questionnaireAnswers)
    .values({ participantId, q2Choices: "[]", ...values } as typeof t.questionnaireAnswers.$inferInsert)
    .onConflictDoUpdate({ target: t.questionnaireAnswers.participantId, set: values });
}

export interface QuestionnaireRecord {
  q1Text: string | null;
  q2Choices: string[];
  q2Other: string | null;
  q3: string | null;
  q4: string | null;
}

export function parseChoices(json: string | null | undefined): string[] {
  try {
    const v = JSON.parse(json ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function getQuestionnaire(participantId: string): Promise<QuestionnaireRecord | null> {
  const { db, t } = getDb();
  const rows = await db
    .select()
    .from(t.questionnaireAnswers)
    .where(eq(t.questionnaireAnswers.participantId, participantId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { q1Text: row.q1Text, q2Choices: parseChoices(row.q2Choices), q2Other: row.q2Other, q3: row.q3, q4: row.q4 };
}
