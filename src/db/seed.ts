import { and, eq, isNull, sql } from "drizzle-orm";
import type { DbState } from "./index";
import { SEED_CUE_WORDS, SEED_NEEDS_REVIEW } from "./seed-data";
import { SEED_MEANINGS } from "./meanings-data";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { normalizeCueText } from "@/lib/normalize";

/**
 * Idempotent seed: inserts the initial cue words only when the table is empty,
 * any default setting that is not stored yet, and a meaning for every word that
 * has none but is in SEED_MEANINGS. Never overwrites admin edits.
 */
export async function seed({ db, t }: DbState, { force = false } = {}) {
  const [{ n }] = await db.select({ n: sql<number>`cast(count(*) as integer)` }).from(t.cueWords);
  let insertedWords = 0;
  if (Number(n) === 0 || force) {
    const now = Date.now();
    const values = SEED_CUE_WORDS.map((w, i) => {
      const text = normalizeCueText(w);
      return { text, lang: "uz", active: true, needsReview: SEED_NEEDS_REVIEW.has(text), sortOrder: i + 1, createdAt: now };
    });
    const res = await db.insert(t.cueWords).values(values).onConflictDoNothing().returning({ id: t.cueWords.id });
    insertedWords = res.length;
  }
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.insert(t.settings).values({ key, value: JSON.stringify(value) }).onConflictDoNothing();
  }

  let filledMeanings = 0;
  const missing = await db.select({ id: t.cueWords.id, text: t.cueWords.text }).from(t.cueWords).where(isNull(t.cueWords.meaning));
  for (const w of missing) {
    const m = SEED_MEANINGS[w.text];
    if (!m) continue;
    const { related, ...meaning } = m;
    await db
      .update(t.cueWords)
      .set({ meaning: JSON.stringify(meaning), related: JSON.stringify(related) })
      .where(and(eq(t.cueWords.id, w.id), isNull(t.cueWords.meaning)));
    filledMeanings++;
  }
  return { insertedWords, filledMeanings };
}
