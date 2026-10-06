import crypto from "node:crypto";
import { asc, desc, eq, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/db";

export interface SurveyLink {
  id: string;
  name: string;
  cueIds: number[];
  cuesPerParticipant: number;
  active: boolean;
  createdAt: number;
}

export interface SurveyLinkRow extends SurveyLink {
  participants: number;
  completed: number;
}

export interface LinkInput {
  name: string;
  cueIds: number[];
  cuesPerParticipant: number;
}

const CODE_ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/l/I

/** Short, unguessable, unambiguous code used in /s/<code>. */
export function newLinkCode(length = 8): string {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

function parseIds(json: string): number[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is number => Number.isInteger(x) && x > 0) : [];
  } catch {
    return [];
  }
}

function toLink(row: { id: string; name: string; cueIds: string; cuesPerParticipant: number; active: boolean; createdAt: number }): SurveyLink {
  return { ...row, cueIds: parseIds(row.cueIds) };
}

export async function getLink(id: string | null | undefined): Promise<SurveyLink | null> {
  if (!id) return null;
  const { db, t } = getDb();
  const rows = await db.select().from(t.surveyLinks).where(eq(t.surveyLinks.id, id)).limit(1);
  return rows[0] ? toLink(rows[0]) : null;
}

export async function listLinks(): Promise<SurveyLinkRow[]> {
  const { db, t } = getDb();
  const [links, counts] = await Promise.all([
    db.select().from(t.surveyLinks).orderBy(desc(t.surveyLinks.createdAt)),
    db
      .select({
        linkId: t.participants.linkId,
        n: sql<number>`cast(count(*) as integer)`,
        done: sql<number>`cast(count(${t.participants.completedAt}) as integer)`,
      })
      .from(t.participants)
      .where(isNotNull(t.participants.linkId))
      .groupBy(t.participants.linkId),
  ]);
  const byLink = new Map(counts.map((c) => [c.linkId, c]));
  return links.map((l) => ({
    ...toLink(l),
    participants: Number(byLink.get(l.id)?.n ?? 0),
    completed: Number(byLink.get(l.id)?.done ?? 0),
  }));
}

/** Only ids of existing cue words are kept, de-duplicated, in word-list order. */
async function cleanCueIds(ids: number[]): Promise<number[]> {
  const { db, t } = getDb();
  const wanted = new Set(ids);
  const all = await db.select({ id: t.cueWords.id }).from(t.cueWords).orderBy(asc(t.cueWords.sortOrder), asc(t.cueWords.id));
  return all.map((w) => w.id).filter((id) => wanted.has(id));
}

export async function createLink(input: LinkInput): Promise<SurveyLink> {
  const { db, t } = getDb();
  const row = {
    id: newLinkCode(),
    name: input.name.trim(),
    cueIds: JSON.stringify(await cleanCueIds(input.cueIds)),
    cuesPerParticipant: input.cuesPerParticipant,
    active: true,
    createdAt: Date.now(),
  };
  await db.insert(t.surveyLinks).values(row);
  return toLink(row);
}

export async function updateLink(id: string, input: LinkInput) {
  const { db, t } = getDb();
  await db
    .update(t.surveyLinks)
    .set({ name: input.name.trim(), cueIds: JSON.stringify(await cleanCueIds(input.cueIds)), cuesPerParticipant: input.cuesPerParticipant })
    .where(eq(t.surveyLinks.id, id));
}

export async function setLinkActive(id: string, active: boolean) {
  const { db, t } = getDb();
  await db.update(t.surveyLinks).set({ active }).where(eq(t.surveyLinks.id, id));
}

/**
 * Deletes a link only if nobody has used it yet. Links with participants are kept
 * (deactivate them instead) so their data stays attributable to the link.
 */
export async function deleteLink(id: string): Promise<"ok" | "in_use"> {
  const { db, t } = getDb();
  const used = await db.select({ id: t.participants.id }).from(t.participants).where(eq(t.participants.linkId, id)).limit(1);
  if (used.length > 0) return "in_use";
  await db.delete(t.surveyLinks).where(eq(t.surveyLinks.id, id));
  return "ok";
}
