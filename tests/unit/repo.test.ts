import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import { migrate as migrateLibsql } from "drizzle-orm/libsql/migrator";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import * as sqliteSchema from "@/db/schema.sqlite";
import * as pgSchema from "@/db/schema.pg";
import { setDbForTests, type Database, type DbState, type Tables } from "@/db";
import { seed } from "@/db/seed";
import { SEED_CUE_WORDS } from "@/db/seed-data";
import {
  createParticipant,
  deleteParticipant,
  ensureDeleteCode,
  findParticipantByToken,
  findParticipantIdByDeleteCode,
  getQuestionnaire,
  saveQuestionnaire,
} from "@/lib/repo/participants";
import { addRound, cueExposure, getAssignments, getOrCreateAssignments, saveCueResponses, unseenCues } from "@/lib/repo/game";
import { getWordMap } from "@/lib/repo/word-map";
import { getChart } from "@/lib/repo/charts";
import { deleteCodeFor } from "@/lib/delete-code";
import { RESULTS_MIN_N } from "@/lib/options";
import { createLink, deleteLink, getLink, listLinks, setLinkActive } from "@/lib/repo/links";
import { getParticipantResults, getPublicCounts } from "@/lib/repo/results";
import { addWords, deleteWord, listWords, moveWord, updateWordMeaning } from "@/lib/repo/words";
import { exportRows, getDashboard } from "@/lib/repo/stats";
import { loadSettings, saveSettings } from "@/lib/settings";
import { normalizeAnswer } from "@/lib/normalize";

const migrations = (d: string) => path.resolve(__dirname, "../../drizzle", d);

const backends: Record<string, () => Promise<DbState>> = {
  sqlite: async () => {
    const db = drizzleLibsql(createClient({ url: ":memory:" }), { schema: sqliteSchema });
    await migrateLibsql(db, { migrationsFolder: migrations("sqlite") });
    return { db, t: sqliteSchema, dialect: "sqlite" };
  },
  postgres: async () => {
    const db = drizzlePglite(new PGlite(), { schema: pgSchema });
    await migratePglite(db, { migrationsFolder: migrations("pg") });
    return { db: db as unknown as Database, t: pgSchema as unknown as Tables, dialect: "pg" };
  },
};

const demo = {
  ageGroup: "25-34",
  gender: "female",
  country: "UZ",
  countryOther: null,
  region: "samarkand",
  education: "bachelor",
  background: "na",
  uiLang: "uz",
};

describe.each(Object.keys(backends))("repository on %s", (name) => {
  beforeAll(async () => {
    const state = await backends[name]();
    setDbForTests(state);
    await seed(state);
  });

  it("seeds cue words and settings idempotently", async () => {
    const words = await listWords();
    expect(words).toHaveLength(SEED_CUE_WORDS.length);
    expect(words.find((w) => w.text === "erksevarlik")?.needsReview).toBe(true);
    expect(words.find((w) => w.text === "milliy g'urur")).toBeTruthy();
    // Every seeded word gets a gloss and related words.
    const vijdon = words.find((w) => w.text === "vijdon")!;
    expect(vijdon.meaning?.en).toMatch(/conscience/i);
    expect(vijdon.related.length).toBeGreaterThan(0);
    expect(words.every((w) => w.meaning)).toBe(true);
    const settings = await loadSettings();
    expect(settings.cuesPerParticipant).toBe(18);
  });

  it("runs the participant flow and computes shared/unique feedback", async () => {
    const ids: string[] = [];
    const tokens: string[] = [];
    for (let i = 0; i < 6; i++) {
      const { id, token } = await createParticipant({ ...demo, gender: i % 2 ? "male" : "female" });
      ids.push(id);
      tokens.push(token);
      await saveQuestionnaire(id, { q1Text: "Qalb", q2Choices: ["religion", "morality"], q3: "very", q4: "both" });
      // Everyone gets the same single cue so answers overlap.
      const { db, t } = (await import("@/db")).getDb();
      const [cue] = await db.select().from(t.cueWords).limit(1);
      await db.insert(t.cueAssignments).values({ participantId: id, cueId: cue.id, position: 1 });
      const answer = i < 4 ? "Ezgulik" : `javob${i}`;
      await saveCueResponses(id, cue.id, [
        { slot: 1, rawText: answer, normalizedText: normalizeAnswer(answer), status: "answered", latencyMs: 1200 },
        { slot: 2, rawText: null, normalizedText: null, status: "no_more", latencyMs: 3000 },
      ]);
    }

    expect((await findParticipantByToken(tokens[0]))?.id).toBe(ids[0]);
    expect(await findParticipantByToken("nope")).toBeNull();

    const results = await getParticipantResults(ids[0]);
    expect(results.cues).toHaveLength(1);
    expect(results.cues[0].answers[0]).toMatchObject({ raw: "Ezgulik", othersSame: 3 });
    expect(results.cues[0].othersTotal).toBe(5);
    expect(results.cues[0].top[0]).toEqual({ key: "ezgulik", count: 4 });
    // Answers given by only one person never appear in the public top list.
    expect(results.cues[0].top.some((x) => x.key.startsWith("javob"))).toBe(false);
    expect(results.questionnaire.q3.items.find((x) => x.key === "very")?.count).toBe(6);
    expect(results.questionnaire.q1Top[0]).toEqual({ key: "qalb", count: 6 });

    const unique = await getParticipantResults(ids[5]);
    expect(unique.cues[0].answers[0].othersSame).toBe(0);

    const dash = await getDashboard({}, { cueId: results.cues[0].cueId, dimension: "gender" });
    expect(dash.suppressed).toBe(false);
    expect(dash.overview.participants).toBe(6);
    expect(dash.cues[0].responses).toBe(6);
    expect(dash.cues[0].uniqueAnswers).toBe(3);
    // 3 per gender < k=5, so both groups are suppressed.
    expect(dash.comparison?.every((g) => g.suppressed)).toBe(true);

    const small = await getDashboard({ gender: "male" });
    expect(small.suppressed).toBe(true);

    expect((await getPublicCounts()).participants).toBe(6);
    const exported = await exportRows("participants");
    expect(exported[0]).not.toHaveProperty("tokenHash");

    await deleteParticipant(ids[0]);
    expect(await findParticipantByToken(tokens[0])).toBeNull();
    expect(await getQuestionnaire(ids[0])).toBeNull();
    expect((await exportRows("responses")).some((r) => r.participantId === ids[0])).toBe(false);
  });

  it("assigns balanced cues and rejects responses for unassigned cues", async () => {
    const { id } = await createParticipant(demo);
    const cues = await getOrCreateAssignments(id, 15);
    expect(cues).toHaveLength(15);
    expect(new Set(cues.map((c) => c.cueId)).size).toBe(15);
    expect(await getOrCreateAssignments(id, 15)).toEqual(cues);
    const assignedIds = new Set(cues.map((c) => c.cueId));
    const other = (await listWords()).find((w) => !assignedIds.has(w.id))!;
    const ok = await saveCueResponses(id, other.id, [
      { slot: 1, rawText: "x", normalizedText: "x", status: "answered", latencyMs: null },
    ]);
    expect(ok).toBe(false);
    expect(await getAssignments(id)).toHaveLength(15);
  });

  it("draws cues only from a survey link's word set and balances within the link", async () => {
    const words = await listWords();
    const pool = words.slice(0, 20).map((w) => w.id);
    const link = await createLink({ name: "  Guruh A ", cueIds: [...pool, 999_999, pool[0]], cuesPerParticipant: 18 });
    expect(link.id).toMatch(/^[A-Za-z0-9]{8}$/);
    expect(link.name).toBe("Guruh A");
    expect(link.cueIds).toEqual(pool); // unknown ids and duplicates dropped, word-list order kept

    const counts = new Map(pool.map((id) => [id, 0]));
    for (let i = 0; i < 10; i++) {
      const { id } = await createParticipant({ ...demo, linkId: link.id });
      const cues = await getOrCreateAssignments(id, link.cuesPerParticipant, { cueIds: link.cueIds, linkId: link.id });
      expect(cues).toHaveLength(18);
      for (const c of cues) {
        expect(pool).toContain(c.cueId);
        counts.set(c.cueId, counts.get(c.cueId)! + 1);
        await saveCueResponses(id, c.cueId, [
          { slot: 1, rawText: "ezgulik", normalizedText: "ezgulik", status: "answered", latencyMs: 900 },
        ]);
      }
    }
    // 10 people × 18 cues over a 20-word pool: every word is used about 9 times (weighted random, so ±2).
    const values = [...counts.values()];
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(2);

    // Exposure is counted per link: another link over the same words starts from zero.
    const other = await createLink({ name: "Guruh B", cueIds: pool, cuesPerParticipant: 5 });
    const exposure = await cueExposure({ cueIds: other.cueIds, linkId: other.id });
    expect(exposure.every((e) => e.count === 0)).toBe(true);

    const rows = await listLinks();
    expect(rows.find((l) => l.id === link.id)).toMatchObject({ participants: 10, completed: 0 });

    const filtered = await getDashboard({ link: link.id });
    expect(filtered.overview.participants).toBe(10);
    expect((await getDashboard({ link: "none" })).overview.participants).toBeGreaterThan(0);

    expect(await deleteLink(link.id)).toBe("in_use");
    expect(await deleteLink(other.id)).toBe("ok");
    await setLinkActive(link.id, false);
    expect((await getLink(link.id))?.active).toBe(false);
  });

  it("issues delete codes, keeps them out of exports, and finds participants by code", async () => {
    const { id, token } = await createParticipant(demo);
    const code = deleteCodeFor(token);
    expect(await findParticipantIdByDeleteCode(code)).toBe(id);
    const p = (await findParticipantByToken(token))!;
    expect(await ensureDeleteCode(p, token)).toBe(code);
    const exported = await exportRows("participants");
    expect(exported.some((r) => "deleteCodeHash" in r || "tokenHash" in r)).toBe(false);
    await deleteParticipant(id);
    expect(await findParticipantIdByDeleteCode(code)).toBeNull();
  });

  it("adds a new round of unseen cues for play-more", async () => {
    const { id } = await createParticipant(demo);
    const first = await getOrCreateAssignments(id, 10);
    expect(first.every((a) => a.round === 1)).toBe(true);
    expect(await addRound(id, 10)).toBe(10);
    const all = await getAssignments(id);
    expect(all).toHaveLength(20);
    expect(new Set(all.map((a) => a.cueId)).size).toBe(20);
    expect(all.filter((a) => a.round === 2).map((a) => a.position)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    // Only unseen words are drawn; once the pool is used up nothing more is added.
    const left = (await unseenCues(id)).length;
    expect(await addRound(id, 1000)).toBe(left);
    expect(await addRound(id, 5)).toBe(0);
  });

  it("builds the word map with the public thresholds", async () => {
    const words = await listWords();
    const [busy, quiet] = [words[30], words[31]];
    const { db, t } = (await import("@/db")).getDb();
    const ids: string[] = [];
    for (let i = 0; i < RESULTS_MIN_N; i++) {
      const { id } = await createParticipant(demo);
      ids.push(id);
      await db.insert(t.cueAssignments).values({ participantId: id, cueId: busy.id, position: 1 });
      const word = i < 6 ? "mehr" : "yolgiz" + i;
      await saveCueResponses(id, busy.id, [{ slot: 1, rawText: word, normalizedText: word, status: "answered", latencyMs: 900 }]);
      if (i < 3) {
        await db.insert(t.cueAssignments).values({ participantId: id, cueId: quiet.id, position: 2 });
        await saveCueResponses(id, quiet.id, [{ slot: 1, rawText: "sir", normalizedText: "sir", status: "answered", latencyMs: 900 }]);
      }
    }
    const map = await getWordMap(ids[0]);
    const busyLinks = map.links.filter((l) => l.cueId === busy.id);
    // Answered by 10 people: answers given by 2+ people are shown, one-person answers are not.
    expect(busyLinks.find((l) => l.key === "mehr")).toMatchObject({ count: 6, mine: true });
    expect(busyLinks.some((l) => l.key.startsWith("yolgiz"))).toBe(false);
    // Answered by only 3 people: nobody else's answers; your own answer without a count.
    expect(map.links.filter((l) => l.cueId === quiet.id)).toEqual([{ cueId: quiet.id, key: "sir", count: 0, mine: true }]);
    expect(map.cues.find((c) => c.id === busy.id)).toMatchObject({ played: true, total: RESULTS_MIN_N });
    expect(map.cues.find((c) => c.id === busy.id)?.meaning).toBeTruthy();
    // A participant sees their own one-person answer; others never do.
    expect((await getWordMap(ids[9])).links.some((l) => l.key === "yolgiz9" && l.mine)).toBe(true);
    expect((await getWordMap(ids[1])).links.some((l) => l.key === "yolgiz9")).toBe(false);

    const chart = await getChart({}, { x: "cue", series: "none", metric: "answerShare", word: "Mehr" }, [busy.id]);
    expect(chart.x).toEqual([String(busy.id)]);
    expect(chart.cells[0].value).toBe(60);
    for (const id of ids) await deleteParticipant(id);
  });

  it("edits the word list and settings", async () => {
    const res = await addWords([{ text: "  Yangi  So‘z " }, { text: "axloq" }, { text: "" }]);
    expect(res.added).toEqual(["yangi so'z"]);
    expect(res.skipped).toEqual(["axloq"]);
    let words = await listWords();
    const last = words[words.length - 1];
    await moveWord(last.id, -1);
    words = await listWords();
    expect(words[words.length - 2].id).toBe(last.id);
    await updateWordMeaning(last.id, { uz: "yangi so'z", en: "new word", ru: "новое слово" }, [" Vijdon ", "vijdon", "axloq"]);
    const edited = (await listWords()).find((w) => w.id === last.id)!;
    expect(edited.meaning?.en).toBe("new word");
    expect(edited.related).toEqual(["vijdon", "axloq"]);
    await deleteWord(last.id);
    expect((await listWords()).some((w) => w.id === last.id)).toBe(false);

    await saveSettings({ cuesPerParticipant: 10, countries: ["UZ", "TR"] });
    const s = await loadSettings();
    expect(s.cuesPerParticipant).toBe(10);
    expect(s.countries).toEqual(["UZ", "TR"]);
  });
});
