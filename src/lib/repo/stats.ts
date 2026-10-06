import { and, asc, eq, gte, isNull, lte, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { aggregateQuestionnaire, topCounts, type CountItem, type QuestionnaireStats } from "@/lib/aggregate";
import { K_ANON, type DemographicDimension } from "@/lib/options";
import { parseChoices } from "./participants";

export interface StatsFilter {
  ageGroup?: string;
  gender?: string;
  country?: string;
  background?: string;
  /** Survey link id, or "none" for participants who used the general survey. */
  link?: string;
  /** Inclusive range on consent time, epoch ms. */
  from?: number;
  to?: number;
}

export function participantConditions(f: StatsFilter): SQL | undefined {
  const { t } = getDb();
  const p = t.participants;
  const conds: SQL[] = [];
  if (f.ageGroup) conds.push(eq(p.ageGroup, f.ageGroup));
  if (f.gender) conds.push(eq(p.gender, f.gender));
  if (f.country) conds.push(eq(p.country, f.country));
  if (f.background) conds.push(eq(p.background, f.background));
  if (f.link) conds.push(f.link === "none" ? isNull(p.linkId) : eq(p.linkId, f.link));
  if (f.from !== undefined) conds.push(gte(p.consentAt, f.from));
  if (f.to !== undefined) conds.push(lte(p.consentAt, f.to));
  return conds.length ? and(...conds) : undefined;
}

export interface Overview {
  participants: number;
  surveyCompleted: number;
  completed: number;
  completionRate: number;
  avgDurationMs: number | null;
}

export interface CueStat {
  cueId: number;
  text: string;
  active: boolean;
  /** Participants who reached this cue (any status). */
  seen: number;
  responses: number;
  uniqueAnswers: number;
  unknownRate: number;
  skipRate: number;
  top: CountItem[];
  cloud: CountItem[];
}

export interface CoOccurrence {
  answer: string;
  cueCount: number;
  total: number;
  cues: CountItem[];
}

export interface GroupComparison {
  group: string;
  n: number;
  suppressed: boolean;
  top: CountItem[];
}

export interface DashboardData {
  overview: Overview;
  questionnaire: QuestionnaireStats | null;
  cues: CueStat[];
  coOccurrence: CoOccurrence[];
  comparison: GroupComparison[] | null;
  /** True when the filtered group is smaller than K_ANON, so breakdowns are hidden. */
  suppressed: boolean;
}

export async function getDashboard(
  f: StatsFilter,
  compare?: { cueId: number; dimension: DemographicDimension },
): Promise<DashboardData> {
  const { db, t } = getDb();
  const where = participantConditions(f);
  const p = t.participants;

  const people = await db
    .select({
      id: p.id,
      consentAt: p.consentAt,
      surveyCompletedAt: p.surveyCompletedAt,
      completedAt: p.completedAt,
      ageGroup: p.ageGroup,
      gender: p.gender,
      country: p.country,
      background: p.background,
      education: p.education,
    })
    .from(p)
    .where(where);

  const completedPeople = people.filter((x) => x.completedAt);
  const durations = completedPeople.map((x) => x.completedAt! - x.consentAt).filter((d) => d > 0);
  const overview: Overview = {
    participants: people.length,
    surveyCompleted: people.filter((x) => x.surveyCompletedAt).length,
    completed: completedPeople.length,
    completionRate: people.length ? completedPeople.length / people.length : 0,
    avgDurationMs: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null,
  };

  const words = await db
    .select({ id: t.cueWords.id, text: t.cueWords.text, active: t.cueWords.active })
    .from(t.cueWords)
    .orderBy(asc(t.cueWords.sortOrder), asc(t.cueWords.id));

  if (people.length < K_ANON) {
    return { overview, questionnaire: null, cues: [], coOccurrence: [], comparison: null, suppressed: true };
  }

  const [qRows, rRows] = await Promise.all([
    db
      .select({
        q1Normalized: t.questionnaireAnswers.q1Normalized,
        q2Choices: t.questionnaireAnswers.q2Choices,
        q3: t.questionnaireAnswers.q3,
        q4: t.questionnaireAnswers.q4,
      })
      .from(t.questionnaireAnswers)
      .innerJoin(p, eq(p.id, t.questionnaireAnswers.participantId))
      .where(where),
    db
      .select({
        participantId: t.responses.participantId,
        cueId: t.responses.cueId,
        norm: t.responses.normalizedText,
        status: t.responses.status,
        slot: t.responses.slot,
      })
      .from(t.responses)
      .innerJoin(p, eq(p.id, t.responses.participantId))
      .where(where),
  ]);

  // Admin view: researchers see every Q1 answer given at least twice.
  const questionnaire = aggregateQuestionnaire(
    qRows.map((r) => ({ ...r, q2Choices: parseChoices(r.q2Choices) })),
    2,
  );

  const byCue = new Map<number, typeof rRows>();
  for (const r of rRows) {
    const list = byCue.get(r.cueId) ?? [];
    list.push(r);
    byCue.set(r.cueId, list);
  }

  const cues: CueStat[] = words.map((w) => {
    const rows = byCue.get(w.id) ?? [];
    const firstSlot = rows.filter((r) => r.slot === 1);
    const answers = rows.filter((r) => r.status === "answered" && r.norm).map((r) => r.norm!);
    const seen = firstSlot.length;
    return {
      cueId: w.id,
      text: w.text,
      active: w.active,
      seen,
      responses: answers.length,
      uniqueAnswers: new Set(answers).size,
      unknownRate: seen ? firstSlot.filter((r) => r.status === "unknown").length / seen : 0,
      skipRate: seen ? firstSlot.filter((r) => r.status === "skipped").length / seen : 0,
      top: topCounts(answers, 5),
      cloud: topCounts(answers, 40),
    };
  });

  // Answers that appear across different cues.
  const cueText = new Map(words.map((w) => [w.id, w.text]));
  const answerCues = new Map<string, Map<number, number>>();
  for (const r of rRows) {
    if (r.status !== "answered" || !r.norm) continue;
    const m = answerCues.get(r.norm) ?? new Map<number, number>();
    m.set(r.cueId, (m.get(r.cueId) ?? 0) + 1);
    answerCues.set(r.norm, m);
  }
  const coOccurrence: CoOccurrence[] = [...answerCues]
    .filter(([, m]) => m.size >= 2)
    .map(([answer, m]) => ({
      answer,
      cueCount: m.size,
      total: [...m.values()].reduce((a, b) => a + b, 0),
      cues: [...m]
        .sort((a, b) => b[1] - a[1])
        .map(([cueId, count]) => ({ key: cueText.get(cueId) ?? String(cueId), count })),
    }))
    .sort((a, b) => b.cueCount - a.cueCount || b.total - a.total || a.answer.localeCompare(b.answer))
    .slice(0, 40);

  let comparison: GroupComparison[] | null = null;
  if (compare) {
    const groupOf = new Map(people.map((x) => [x.id, x[compare.dimension] ?? "na"]));
    const groups = new Map<string, { people: Set<string>; answers: string[] }>();
    for (const r of byCue.get(compare.cueId) ?? []) {
      const g = groupOf.get(r.participantId) ?? "na";
      const entry = groups.get(g) ?? { people: new Set<string>(), answers: [] };
      entry.people.add(r.participantId);
      if (r.status === "answered" && r.norm) entry.answers.push(r.norm);
      groups.set(g, entry);
    }
    comparison = [...groups]
      .map(([group, v]) => {
        const suppressed = v.people.size < K_ANON;
        return { group, n: v.people.size, suppressed, top: suppressed ? [] : topCounts(v.answers, 8) };
      })
      .sort((a, b) => b.n - a.n);
  }

  return { overview, questionnaire, cues, coOccurrence, comparison, suppressed: false };
}

/** Raw anonymous rows for CSV/JSON export. */
export type ExportKind = "participants" | "questionnaire" | "responses" | "words";

export async function exportRows(kind: ExportKind): Promise<Record<string, unknown>[]> {
  const { db, t } = getDb();
  if (kind === "participants") {
    const rows = await db.select().from(t.participants).orderBy(asc(t.participants.createdAt));
    // Secrets stay out of exports: both hashes would let someone act as the participant.
    return rows.map(({ tokenHash: _token, deleteCodeHash: _deleteCode, ...r }) => ({
      ...r,
      createdAt: new Date(r.createdAt).toISOString(),
      consentAt: new Date(r.consentAt).toISOString(),
      surveyCompletedAt: r.surveyCompletedAt ? new Date(r.surveyCompletedAt).toISOString() : null,
      completedAt: r.completedAt ? new Date(r.completedAt).toISOString() : null,
    }));
  }
  if (kind === "questionnaire") {
    const rows = await db.select().from(t.questionnaireAnswers);
    return rows.map((r) => ({
      participantId: r.participantId,
      q1Text: r.q1Text,
      q1Normalized: r.q1Normalized,
      q2Choices: parseChoices(r.q2Choices).join(";"),
      q2Other: r.q2Other,
      q3: r.q3,
      q4: r.q4,
      updatedAt: new Date(r.updatedAt).toISOString(),
    }));
  }
  if (kind === "responses") {
    const rows = await db
      .select({
        id: t.responses.id,
        participantId: t.responses.participantId,
        cueId: t.responses.cueId,
        cue: t.cueWords.text,
        slot: t.responses.slot,
        rawText: t.responses.rawText,
        normalizedText: t.responses.normalizedText,
        status: t.responses.status,
        latencyMs: t.responses.latencyMs,
        createdAt: t.responses.createdAt,
      })
      .from(t.responses)
      .innerJoin(t.cueWords, eq(t.cueWords.id, t.responses.cueId))
      .orderBy(asc(t.responses.id));
    return rows.map((r) => ({ ...r, createdAt: new Date(r.createdAt).toISOString() }));
  }
  const rows = await db.select().from(t.cueWords).orderBy(asc(t.cueWords.sortOrder), asc(t.cueWords.id));
  return rows.map((r) => ({
    text: r.text,
    active: r.active ? 1 : 0,
    sort_order: r.sortOrder,
    needs_review: r.needsReview ? 1 : 0,
  }));
}

export const EXPORT_COLUMNS: Record<ExportKind, string[]> = {
  participants: [
    "id", "createdAt", "consentAt", "surveyCompletedAt", "completedAt", "ageGroup", "gender", "country",
    "countryOther", "region", "education", "background", "uiLang", "linkId",
  ],
  questionnaire: ["participantId", "q1Text", "q1Normalized", "q2Choices", "q2Other", "q3", "q4", "updatedAt"],
  responses: [
    "id", "participantId", "cueId", "cue", "slot", "rawText", "normalizedText", "status", "latencyMs", "createdAt",
  ],
  words: ["text", "active", "sort_order", "needs_review"],
};
