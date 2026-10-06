import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { selectCues } from "@/lib/cue-selection";

export type ResponseStatus = "answered" | "unknown" | "no_more" | "skipped";

export interface AssignedCue {
  cueId: number;
  text: string;
  position: number;
  /** 1 for the first set; "play more words" adds round 2, 3, … */
  round: number;
}

export interface SavedResponse {
  slot: number;
  rawText: string | null;
  status: ResponseStatus;
}

export interface CuePool {
  /** Restrict to these cue ids (a survey link's word set). Omit for all active cues. */
  cueIds?: number[];
  /** Count exposure only among this link's participants, so each link balances on its own. */
  linkId?: string | null;
}

/**
 * Number of participants who have finished each candidate cue (every finished cue
 * has a slot-1 row). Candidates are active cues, optionally limited to a link's pool.
 */
export async function cueExposure(pool: CuePool = {}): Promise<{ id: number; count: number }[]> {
  const { db, t } = getDb();
  const activeWhere =
    pool.cueIds !== undefined
      ? and(eq(t.cueWords.active, true), inArray(t.cueWords.id, pool.cueIds.length ? pool.cueIds : [-1]))
      : eq(t.cueWords.active, true);
  const countQuery = pool.linkId
    ? db
        .select({ cueId: t.responses.cueId, n: sql<number>`cast(count(*) as integer)` })
        .from(t.responses)
        .innerJoin(t.participants, eq(t.participants.id, t.responses.participantId))
        .where(and(eq(t.responses.slot, 1), eq(t.participants.linkId, pool.linkId)))
        .groupBy(t.responses.cueId)
    : db
        .select({ cueId: t.responses.cueId, n: sql<number>`cast(count(*) as integer)` })
        .from(t.responses)
        .where(eq(t.responses.slot, 1))
        .groupBy(t.responses.cueId);
  const [cues, counts] = await Promise.all([db.select({ id: t.cueWords.id }).from(t.cueWords).where(activeWhere), countQuery]);
  const byCue = new Map(counts.map((c) => [c.cueId, Number(c.n)]));
  return cues.map((c) => ({ id: c.id, count: byCue.get(c.id) ?? 0 }));
}

export async function getAssignments(participantId: string): Promise<AssignedCue[]> {
  const { db, t } = getDb();
  return db
    .select({ cueId: t.cueAssignments.cueId, text: t.cueWords.text, position: t.cueAssignments.position, round: t.cueAssignments.round })
    .from(t.cueAssignments)
    .innerJoin(t.cueWords, eq(t.cueWords.id, t.cueAssignments.cueId))
    .where(eq(t.cueAssignments.participantId, participantId))
    .orderBy(asc(t.cueAssignments.position));
}

export async function getOrCreateAssignments(participantId: string, n: number, pool: CuePool = {}): Promise<AssignedCue[]> {
  const existing = await getAssignments(participantId);
  if (existing.length > 0) return existing;
  const picked = selectCues(await cueExposure(pool), n);
  if (picked.length === 0) return [];
  const { db, t } = getDb();
  await db
    .insert(t.cueAssignments)
    .values(picked.map((cueId, i) => ({ participantId, cueId, position: i + 1, round: 1 })))
    .onConflictDoNothing();
  return getAssignments(participantId);
}

/** Pool cues the participant has not been given yet. */
export async function unseenCues(participantId: string, pool: CuePool = {}) {
  const seen = new Set((await getAssignments(participantId)).map((a) => a.cueId));
  return (await cueExposure(pool)).filter((c) => !seen.has(c.id));
}

/**
 * "Play more words": draws up to `n` more cues the participant hasn't seen (balanced the
 * same way as the first set) as the next round. Returns how many were added.
 */
export async function addRound(participantId: string, n: number, pool: CuePool = {}): Promise<number> {
  const existing = await getAssignments(participantId);
  const seen = new Set(existing.map((a) => a.cueId));
  const picked = selectCues((await cueExposure(pool)).filter((c) => !seen.has(c.id)), n);
  if (picked.length === 0) return 0;
  const round = Math.max(0, ...existing.map((a) => a.round)) + 1;
  const start = Math.max(0, ...existing.map((a) => a.position));
  const { db, t } = getDb();
  await db
    .insert(t.cueAssignments)
    .values(picked.map((cueId, i) => ({ participantId, cueId, position: start + i + 1, round })))
    .onConflictDoNothing();
  return picked.length;
}

/** The participant's saved responses grouped by cue id. */
export async function getSavedResponses(participantId: string): Promise<Map<number, SavedResponse[]>> {
  const { db, t } = getDb();
  const rows = await db
    .select({ cueId: t.responses.cueId, slot: t.responses.slot, rawText: t.responses.rawText, status: t.responses.status })
    .from(t.responses)
    .where(eq(t.responses.participantId, participantId))
    .orderBy(asc(t.responses.slot));
  const map = new Map<number, SavedResponse[]>();
  for (const r of rows) {
    const list = map.get(r.cueId) ?? [];
    list.push({ slot: r.slot, rawText: r.rawText, status: r.status });
    map.set(r.cueId, list);
  }
  return map;
}

export interface ResponseInput {
  slot: number;
  rawText: string | null;
  normalizedText: string | null;
  status: ResponseStatus;
  latencyMs: number | null;
}

/** Replaces the participant's rows for one cue (so going back and re-answering is idempotent). */
export async function saveCueResponses(participantId: string, cueId: number, rows: ResponseInput[]): Promise<boolean> {
  const { db, t } = getDb();
  const assigned = await db
    .select({ cueId: t.cueAssignments.cueId })
    .from(t.cueAssignments)
    .where(and(eq(t.cueAssignments.participantId, participantId), eq(t.cueAssignments.cueId, cueId)))
    .limit(1);
  if (assigned.length === 0) return false;
  const now = Date.now();
  await db.delete(t.responses).where(and(eq(t.responses.participantId, participantId), eq(t.responses.cueId, cueId)));
  if (rows.length > 0) {
    await db.insert(t.responses).values(rows.map((r) => ({ ...r, participantId, cueId, createdAt: now })));
  }
  return true;
}
