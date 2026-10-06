import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import type { Meaning } from "@/db/meanings-data";
import { normalizeCueText } from "@/lib/normalize";
import { parseChoices } from "./participants";
import { parseMeaning } from "./word-map";

export interface CueWordRow {
  id: number;
  text: string;
  active: boolean;
  needsReview: boolean;
  sortOrder: number;
  responses: number;
  meaning: Meaning | null;
  related: string[];
}

export async function listWords(): Promise<CueWordRow[]> {
  const { db, t } = getDb();
  const [words, counts] = await Promise.all([
    db.select().from(t.cueWords).orderBy(asc(t.cueWords.sortOrder), asc(t.cueWords.id)),
    db
      .select({ cueId: t.responses.cueId, n: sql<number>`cast(count(*) as integer)` })
      .from(t.responses)
      .where(eq(t.responses.status, "answered"))
      .groupBy(t.responses.cueId),
  ]);
  const byCue = new Map(counts.map((c) => [c.cueId, Number(c.n)]));
  return words.map((w) => ({
    id: w.id,
    text: w.text,
    active: w.active,
    needsReview: w.needsReview,
    sortOrder: w.sortOrder,
    responses: byCue.get(w.id) ?? 0,
    meaning: parseMeaning(w.meaning),
    related: parseChoices(w.related),
  }));
}

async function nextSortOrder(): Promise<number> {
  const { db, t } = getDb();
  const rows = await db.select({ m: sql<number>`coalesce(max(${t.cueWords.sortOrder}), 0)` }).from(t.cueWords);
  return Number(rows[0]?.m ?? 0) + 1;
}

export interface AddResult {
  added: string[];
  skipped: string[];
}

/** Adds words (already split), skipping blanks and duplicates (after normalization). */
export async function addWords(
  items: { text: string; active?: boolean; needsReview?: boolean }[],
): Promise<AddResult> {
  const { db, t } = getDb();
  const existing = new Set((await db.select({ text: t.cueWords.text }).from(t.cueWords)).map((r) => r.text));
  let order = await nextSortOrder();
  const added: string[] = [];
  const skipped: string[] = [];
  for (const item of items) {
    const text = normalizeCueText(item.text);
    if (!text) continue;
    if (existing.has(text) || text.length > 80) {
      skipped.push(text);
      continue;
    }
    existing.add(text);
    await db.insert(t.cueWords).values({
      text,
      lang: "uz",
      active: item.active ?? true,
      needsReview: item.needsReview ?? false,
      sortOrder: order++,
      createdAt: Date.now(),
    });
    added.push(text);
  }
  return { added, skipped };
}

export async function updateWordText(id: number, raw: string): Promise<"ok" | "duplicate" | "empty"> {
  const { db, t } = getDb();
  const text = normalizeCueText(raw);
  if (!text) return "empty";
  const clash = await db.select({ id: t.cueWords.id }).from(t.cueWords).where(eq(t.cueWords.text, text)).limit(1);
  if (clash[0] && clash[0].id !== id) return "duplicate";
  await db.update(t.cueWords).set({ text, needsReview: false }).where(eq(t.cueWords.id, id));
  return "ok";
}

/** Sets a word's gloss (null clears it) and related words (canonical forms, deduplicated). */
export async function updateWordMeaning(id: number, meaning: Meaning | null, related: string[]) {
  const { db, t } = getDb();
  const clean = [...new Set(related.map(normalizeCueText).filter(Boolean))].slice(0, 12);
  await db
    .update(t.cueWords)
    .set({ meaning: meaning ? JSON.stringify(meaning) : null, related: JSON.stringify(clean) })
    .where(eq(t.cueWords.id, id));
}

export async function setWordActive(id: number, active: boolean) {
  const { db, t } = getDb();
  await db.update(t.cueWords).set({ active }).where(eq(t.cueWords.id, id));
}

export async function markWordReviewed(id: number) {
  const { db, t } = getDb();
  await db.update(t.cueWords).set({ needsReview: false }).where(eq(t.cueWords.id, id));
}

/** Deletes a cue word together with its assignments and responses. */
export async function deleteWord(id: number) {
  const { db, t } = getDb();
  await db.delete(t.responses).where(eq(t.responses.cueId, id));
  await db.delete(t.cueAssignments).where(eq(t.cueAssignments.cueId, id));
  await db.delete(t.cueWords).where(eq(t.cueWords.id, id));
}

/** Moves a word one place up/down by renumbering the whole list (lists are small). */
export async function moveWord(id: number, direction: -1 | 1) {
  const { db, t } = getDb();
  const words = await db
    .select({ id: t.cueWords.id })
    .from(t.cueWords)
    .orderBy(asc(t.cueWords.sortOrder), asc(t.cueWords.id));
  const index = words.findIndex((w) => w.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= words.length) return;
  [words[index], words[target]] = [words[target], words[index]];
  for (let i = 0; i < words.length; i++) {
    await db.update(t.cueWords).set({ sortOrder: i + 1 }).where(eq(t.cueWords.id, words[i].id));
  }
}
