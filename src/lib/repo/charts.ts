import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { buildChart, RESPONSE_METRICS, type ChartCueObs, type ChartPerson, type ChartResult, type ChartSpec } from "@/lib/charts";
import { normalizeAnswer } from "@/lib/normalize";
import { parseChoices } from "./participants";
import { participantConditions, type StatsFilter } from "./stats";

/**
 * Loads the filtered participants (and, for answer measures, their cue observations,
 * optionally limited to some cue words) and aggregates them with buildChart().
 */
export async function getChart(filter: StatsFilter, spec: ChartSpec, cueIds: number[] = []): Promise<ChartResult> {
  const { db, t } = getDb();
  const p = t.participants;
  const where = participantConditions(filter);

  const rows = await db
    .select({
      id: p.id,
      ageGroup: p.ageGroup,
      gender: p.gender,
      country: p.country,
      region: p.region,
      education: p.education,
      background: p.background,
      link: p.linkId,
      uiLang: p.uiLang,
      consentAt: p.consentAt,
      completedAt: p.completedAt,
      q2: t.questionnaireAnswers.q2Choices,
      q3: t.questionnaireAnswers.q3,
      q4: t.questionnaireAnswers.q4,
    })
    .from(p)
    .leftJoin(t.questionnaireAnswers, eq(t.questionnaireAnswers.participantId, p.id))
    .where(where);

  const people: ChartPerson[] = rows.map((r) => ({
    id: r.id,
    ageGroup: r.ageGroup,
    gender: r.gender,
    country: r.country,
    region: r.region,
    education: r.education,
    background: r.background,
    link: r.link,
    uiLang: r.uiLang,
    consentAt: r.consentAt,
    completed: r.completedAt != null,
    q2: parseChoices(r.q2),
    q3: r.q3,
    q4: r.q4,
  }));

  const words = await db.select({ id: t.cueWords.id }).from(t.cueWords).orderBy(asc(t.cueWords.sortOrder), asc(t.cueWords.id));
  const cueOrder = words.map((w) => w.id);

  let obs: ChartCueObs[] = [];
  if (RESPONSE_METRICS.has(spec.metric) && people.length > 0) {
    const r = t.responses;
    const conds = [where, cueIds.length ? inArray(r.cueId, cueIds) : undefined].filter(Boolean);
    const responses = await db
      .select({ participantId: r.participantId, cueId: r.cueId, slot: r.slot, status: r.status, norm: r.normalizedText, latencyMs: r.latencyMs })
      .from(r)
      .innerJoin(p, eq(p.id, r.participantId))
      .where(conds.length ? and(...conds) : undefined);

    const byKey = new Map<string, ChartCueObs>();
    for (const x of responses) {
      const key = `${x.participantId}:${x.cueId}`;
      const o = byKey.get(key) ?? { participantId: x.participantId, cueId: x.cueId, status: "no_more", answered: 0, latencyMs: null, answers: [] };
      if (x.status === "answered") {
        o.status = "answered";
        o.answered++;
        if (x.norm) o.answers.push(x.norm);
        if (x.slot === 1) o.latencyMs = x.latencyMs;
      } else if (x.slot === 1) o.status = x.status;
      byKey.set(key, o);
    }
    obs = [...byKey.values()];
  }

  const word = spec.word ? normalizeAnswer(spec.word) : undefined;
  return buildChart(people, obs, { ...spec, word }, { cueOrder });
}
