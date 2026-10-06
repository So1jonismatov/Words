import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { aggregateQuestionnaire, type CountItem, type QuestionnaireStats } from "@/lib/aggregate";
import { getAssignments, type ResponseStatus } from "./game";
import { getQuestionnaire, parseChoices, type QuestionnaireRecord } from "./participants";

export interface MyAnswer {
  slot: number;
  raw: string;
  /** Other participants who gave the same (normalized) answer to this cue. */
  othersSame: number;
}

export interface CueResult {
  cueId: number;
  text: string;
  status: ResponseStatus | null;
  answers: MyAnswer[];
  /** Other participants who answered this cue at all. */
  othersTotal: number;
  /** Most common answers among everyone (only answers given by 2+ people). */
  top: CountItem[];
  /** Everyone who answered this cue, including this participant. */
  total: number;
}

export interface ParticipantResults {
  cues: CueResult[];
  questionnaire: QuestionnaireStats;
  mine: QuestionnaireRecord | null;
  totalParticipants: number;
}

export async function getParticipantResults(participantId: string): Promise<ParticipantResults> {
  const { db, t } = getDb();
  const assignments = await getAssignments(participantId);
  const cueIds = assignments.map((a) => a.cueId);

  const [myRows, answerCounts, cueTotals, qRows, mine, totalRow] = await Promise.all([
    db
      .select({
        cueId: t.responses.cueId,
        slot: t.responses.slot,
        raw: t.responses.rawText,
        norm: t.responses.normalizedText,
        status: t.responses.status,
      })
      .from(t.responses)
      .where(eq(t.responses.participantId, participantId)),
    cueIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            cueId: t.responses.cueId,
            norm: t.responses.normalizedText,
            n: sql<number>`cast(count(distinct ${t.responses.participantId}) as integer)`,
          })
          .from(t.responses)
          .where(and(inArray(t.responses.cueId, cueIds), eq(t.responses.status, "answered")))
          .groupBy(t.responses.cueId, t.responses.normalizedText),
    cueIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            cueId: t.responses.cueId,
            n: sql<number>`cast(count(distinct ${t.responses.participantId}) as integer)`,
          })
          .from(t.responses)
          .where(and(inArray(t.responses.cueId, cueIds), eq(t.responses.status, "answered")))
          .groupBy(t.responses.cueId),
    db
      .select({
        q1Normalized: t.questionnaireAnswers.q1Normalized,
        q2Choices: t.questionnaireAnswers.q2Choices,
        q3: t.questionnaireAnswers.q3,
        q4: t.questionnaireAnswers.q4,
      })
      .from(t.questionnaireAnswers),
    getQuestionnaire(participantId),
    db.select({ n: sql<number>`cast(count(*) as integer)` }).from(t.participants),
  ]);

  const countsByCue = new Map<number, Map<string, number>>();
  for (const r of answerCounts) {
    if (!r.norm) continue;
    const m = countsByCue.get(r.cueId) ?? new Map<string, number>();
    m.set(r.norm, Number(r.n));
    countsByCue.set(r.cueId, m);
  }
  const totalsByCue = new Map(cueTotals.map((r) => [r.cueId, Number(r.n)]));

  const cues: CueResult[] = assignments.map((a) => {
    const own = myRows.filter((r) => r.cueId === a.cueId).sort((x, y) => x.slot - y.slot);
    const counts = countsByCue.get(a.cueId) ?? new Map<string, number>();
    const answered = own.filter((r) => r.status === "answered" && r.raw);
    const iAnswered = answered.length > 0;
    const total = totalsByCue.get(a.cueId) ?? 0;
    const first = own[0];
    return {
      cueId: a.cueId,
      text: a.text,
      status: first ? (iAnswered ? "answered" : first.status) : null,
      answers: answered.map((r) => ({
        slot: r.slot,
        raw: r.raw!,
        othersSame: Math.max(0, (counts.get(r.norm ?? "") ?? 0) - 1),
      })),
      othersTotal: Math.max(0, total - (iAnswered ? 1 : 0)),
      total,
      top: [...counts]
        .filter(([, n]) => n >= 2)
        .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
        .slice(0, 5)
        .map(([key, count]) => ({ key, count })),
    };
  });

  return {
    cues,
    questionnaire: aggregateQuestionnaire(qRows.map((r) => ({ ...r, q2Choices: parseChoices(r.q2Choices) }))),
    mine,
    totalParticipants: Number(totalRow[0]?.n ?? 0),
  };
}

export async function getPublicCounts(): Promise<{ participants: number; responses: number }> {
  const { db, t } = getDb();
  const [p, r] = await Promise.all([
    db.select({ n: sql<number>`cast(count(*) as integer)` }).from(t.participants),
    db.select({ n: sql<number>`cast(count(*) as integer)` }).from(t.responses).where(eq(t.responses.status, "answered")),
  ]);
  return { participants: Number(p[0]?.n ?? 0), responses: Number(r[0]?.n ?? 0) };
}
