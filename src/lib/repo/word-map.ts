import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import type { Meaning } from "@/db/meanings-data";
import { RESULTS_MIN_N } from "@/lib/options";
import { getAssignments } from "./game";
import { parseChoices } from "./participants";

/** Answers per cue shown on the map (the strongest links). */
const ANSWERS_PER_CUE = 8;

export interface MapCue {
  id: number;
  text: string;
  /** The participant played this cue. */
  played: boolean;
  /** People who answered this cue. */
  total: number;
  meaning: Meaning | null;
  related: string[];
}

export interface MapLink {
  cueId: number;
  /** Normalized answer. */
  key: string;
  /** People who gave this answer to this cue (0 when hidden: below the threshold, own answer only). */
  count: number;
  mine: boolean;
}

export interface WordMapData {
  cues: MapCue[];
  links: MapLink[];
  /** Most common first words for the concept itself (Q1), once enough people answered. */
  q1: { key: string; count: number }[];
  minN: number;
}

export function parseMeaning(json: string | null): Meaning | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json);
    return v && typeof v.uz === "string" && typeof v.en === "string" && typeof v.ru === "string" ? { uz: v.uz, en: v.en, ru: v.ru } : null;
  } catch {
    return null;
  }
}

/**
 * Word map for the results page: every active cue (plus any the participant played),
 * linked to its most common answers. Privacy rules match the rest of the results page:
 * other people's answers appear only for cues answered by RESULTS_MIN_N+ people and only
 * when given by 2+ people; the participant always sees their own answers.
 */
export async function getWordMap(participantId: string): Promise<WordMapData> {
  const { db, t } = getDb();
  const r = t.responses;
  const [words, assignments, counts, totals, mine, qRows] = await Promise.all([
    db
      .select({ id: t.cueWords.id, text: t.cueWords.text, active: t.cueWords.active, meaning: t.cueWords.meaning, related: t.cueWords.related })
      .from(t.cueWords)
      .orderBy(asc(t.cueWords.sortOrder), asc(t.cueWords.id)),
    getAssignments(participantId),
    db
      .select({ cueId: r.cueId, norm: r.normalizedText, n: sql<number>`cast(count(distinct ${r.participantId}) as integer)` })
      .from(r)
      .where(eq(r.status, "answered"))
      .groupBy(r.cueId, r.normalizedText),
    db
      .select({ cueId: r.cueId, n: sql<number>`cast(count(distinct ${r.participantId}) as integer)` })
      .from(r)
      .where(eq(r.status, "answered"))
      .groupBy(r.cueId),
    db
      .select({ cueId: r.cueId, norm: r.normalizedText })
      .from(r)
      .where(and(eq(r.participantId, participantId), eq(r.status, "answered"))),
    db.select({ q1: t.questionnaireAnswers.q1Normalized, q2: t.questionnaireAnswers.q2Choices }).from(t.questionnaireAnswers),
  ]);

  const played = new Set(assignments.map((a) => a.cueId));
  const totalByCue = new Map(totals.map((x) => [x.cueId, Number(x.n)]));
  const cues: MapCue[] = words
    .filter((w) => w.active || played.has(w.id))
    .map((w) => ({
      id: w.id,
      text: w.text,
      played: played.has(w.id),
      total: totalByCue.get(w.id) ?? 0,
      meaning: parseMeaning(w.meaning),
      related: parseChoices(w.related),
    }));
  const cueIds = new Set(cues.map((c) => c.id));

  const mineByCue = new Map<number, Set<string>>();
  for (const m of mine) {
    if (!m.norm) continue;
    const set = mineByCue.get(m.cueId) ?? new Set<string>();
    set.add(m.norm);
    mineByCue.set(m.cueId, set);
  }

  const byCue = new Map<number, { key: string; count: number }[]>();
  for (const c of counts) {
    if (!c.norm || !cueIds.has(c.cueId)) continue;
    const list = byCue.get(c.cueId) ?? [];
    list.push({ key: c.norm, count: Number(c.n) });
    byCue.set(c.cueId, list);
  }

  const links: MapLink[] = [];
  for (const cue of cues) {
    const own = mineByCue.get(cue.id) ?? new Set<string>();
    const visible = cue.total >= RESULTS_MIN_N;
    const shown = new Set<string>();
    if (visible) {
      const top = (byCue.get(cue.id) ?? [])
        .filter((x) => x.count >= 2)
        .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
        .slice(0, ANSWERS_PER_CUE);
      for (const x of top) {
        links.push({ cueId: cue.id, key: x.key, count: x.count, mine: own.has(x.key) });
        shown.add(x.key);
      }
    }
    for (const key of own) {
      if (shown.has(key)) continue;
      const count = visible ? ((byCue.get(cue.id) ?? []).find((x) => x.key === key)?.count ?? 1) : 0;
      links.push({ cueId: cue.id, key, count, mine: true });
    }
  }

  // Q1 ("first word for Ma'naviyat"): same public rule as the results list (3+ people).
  const q1Counts = new Map<string, number>();
  for (const q of qRows) if (q.q1) q1Counts.set(q.q1, (q1Counts.get(q.q1) ?? 0) + 1);
  const q1 =
    qRows.length >= RESULTS_MIN_N
      ? [...q1Counts]
          .filter(([, n]) => n >= 3)
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .slice(0, 8)
          .map(([key, count]) => ({ key, count }))
      : [];

  return { cues, links, q1, minN: RESULTS_MIN_N };
}
