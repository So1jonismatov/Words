/**
 * Fills the LOCAL database with synthetic participants so the dashboard and results
 * pages can be previewed. Demo rows have ids starting with "demo-".
 *   npm run db:demo              add 120 demo participants
 *   npm run db:demo -- 300       add 300
 *   npm run db:demo -- --clear   remove all demo rows
 * Refuses to run against anything but a local SQLite file.
 */
import "./load-env";
import crypto from "node:crypto";
import { eq, like } from "drizzle-orm";
import { databaseUrl, getDb } from "../src/db";
import { runMigrations } from "../src/db/migrate";
import { seed } from "../src/db/seed";
import { AGE_GROUPS, BACKGROUNDS, EDUCATION, GENDERS, Q2_OPTIONS, Q3_OPTIONS, Q4_OPTIONS, UZ_REGIONS } from "../src/lib/options";
import { normalizeAnswer } from "../src/lib/normalize";
import { mulberry32, selectCues, shuffle } from "../src/lib/cue-selection";

const VOCAB = [
  "ruh", "vijdon", "iymon", "ona", "vatan", "oila", "mehr", "halollik", "insof", "ota-ona", "kitob", "bilim",
  "ilm", "Alloh", "namoz", "sabr", "tinchlik", "yurak", "qalb", "go'zallik", "adolat", "hurmat", "yaxshilik",
  "ezgulik", "tarbiya", "maktab", "ustoz", "madaniyat", "an'ana", "do'stlik", "sevgi", "baxt", "poklik",
  "to'g'rilik", "mehnat", "sadoqat", "erkinlik", "g'urur", "inson", "hayot", "nur", "masjid", "dil", "kamtarlik",
];

async function main() {
  const url = databaseUrl();
  if (!url.startsWith("file:")) throw new Error(`Refusing to write demo data to ${url.replace(/\/\/[^@]*@/, "//***@")}: local file databases only.`);
  const state = getDb();
  await runMigrations(state);
  await seed(state);
  const { db, t } = state;
  const args = process.argv.slice(2);

  if (args.includes("--clear")) {
    const ids = (await db.select({ id: t.participants.id }).from(t.participants).where(like(t.participants.id, "demo-%"))).map((r) => r.id);
    for (const id of ids) {
      await db.delete(t.responses).where(eq(t.responses.participantId, id));
      await db.delete(t.cueAssignments).where(eq(t.cueAssignments.participantId, id));
      await db.delete(t.questionnaireAnswers).where(eq(t.questionnaireAnswers.participantId, id));
      await db.delete(t.participants).where(eq(t.participants.id, id));
    }
    console.log(`[demo] removed ${ids.length} demo participants`);
    return;
  }

  const n = Number(args.find((a) => /^\d+$/.test(a)) ?? 120);
  const rng = mulberry32(Date.now() % 100000);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rng() * xs.length)];
  const cues = await db.select().from(t.cueWords).where(eq(t.cueWords.active, true));
  const counts = new Map(cues.map((c) => [c.id, 0]));
  // Each cue gets a preferred sub-vocabulary so answers overlap realistically.
  const cueVocab = new Map(cues.map((c) => [c.id, [c.text.split(" ")[0], ...shuffle(VOCAB, rng).slice(0, 8)]]));

  for (let i = 0; i < n; i++) {
    const id = `demo-${crypto.randomUUID()}`;
    const start = Date.now() - Math.floor(rng() * 30 * 86400_000);
    const country = rng() < 0.7 ? "UZ" : pick(["RU", "KZ", "US", "GB"]);
    const finished = rng() < 0.85;
    await db.insert(t.participants).values({
      id,
      tokenHash: crypto.randomBytes(16).toString("hex"),
      createdAt: start,
      consentAt: start,
      ageGroup: pick(AGE_GROUPS.slice(1)),
      gender: pick([...GENDERS, null]),
      country,
      countryOther: null,
      region: country === "UZ" ? pick([...UZ_REGIONS, null]) : null,
      education: pick([...EDUCATION, null]),
      background: pick([...BACKGROUNDS, null]),
      uiLang: pick(["uz", "uz", "ru", "en"]),
      surveyCompletedAt: start + 90_000,
      completedAt: finished ? start + 300_000 + Math.floor(rng() * 600_000) : null,
    });
    const q1 = pick(VOCAB);
    await db.insert(t.questionnaireAnswers).values({
      participantId: id,
      q1Text: q1,
      q1Normalized: normalizeAnswer(q1),
      q2Choices: JSON.stringify(shuffle([...Q2_OPTIONS], rng).slice(0, 1 + Math.floor(rng() * 3))),
      q2Other: null,
      q3: pick(Q3_OPTIONS),
      q4: pick(Q4_OPTIONS),
      updatedAt: start + 90_000,
    });
    const picked = selectCues([...counts].map(([cid, count]) => ({ id: cid, count })), 15, rng);
    await db.insert(t.cueAssignments).values(picked.map((cueId, p) => ({ participantId: id, cueId, position: p + 1 })));
    const done = finished ? picked : picked.slice(0, Math.floor(rng() * picked.length));
    for (const cueId of done) {
      counts.set(cueId, counts.get(cueId)! + 1);
      const roll = rng();
      const at = start + 100_000;
      if (roll < 0.06) {
        await db.insert(t.responses).values({ participantId: id, cueId, slot: 1, status: rng() < 0.6 ? "unknown" : "skipped", latencyMs: 4000, createdAt: at });
        continue;
      }
      const vocab = cueVocab.get(cueId)!;
      const k = 1 + Math.floor(rng() * 3);
      const answers = [...new Set(Array.from({ length: k }, () => (rng() < 0.8 ? vocab[Math.floor(rng() * rng() * vocab.length)] : pick(VOCAB))))];
      const rows: (typeof t.responses.$inferInsert)[] = answers.map((raw, s) => ({
        participantId: id, cueId, slot: s + 1, rawText: raw, normalizedText: normalizeAnswer(raw),
        status: "answered", latencyMs: 1500 + Math.floor(rng() * 4000) + s * 2000, createdAt: at,
      }));
      if (rows.length < 3) rows.push({ participantId: id, cueId, slot: rows.length + 1, status: "no_more", latencyMs: 9000, createdAt: at });
      await db.insert(t.responses).values(rows);
    }
  }
  console.log(`[demo] added ${n} demo participants (remove with: npm run db:demo -- --clear)`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[demo]", err.message ?? err);
    process.exit(1);
  });
