/**
 * Removes ALL participants and their answers (test runs, demo rows) before a real launch.
 * Keeps cue words, meanings, settings and survey links.
 *   npm run db:reset -- --yes
 * Works on whatever DATABASE_URL points at, so check it first.
 */
import "./load-env";
import { sql } from "drizzle-orm";
import { databaseUrl, getDb } from "../src/db";
import { runMigrations } from "../src/db/migrate";

async function main() {
  const url = databaseUrl().replace(/\/\/[^@]*@/, "//***@");
  const state = getDb();
  await runMigrations(state);
  const { db, t } = state;
  const [{ n }] = await db.select({ n: sql<number>`cast(count(*) as integer)` }).from(t.participants);

  if (!process.argv.includes("--yes")) {
    console.log(`[reset] ${url} has ${Number(n)} participants.`);
    console.log("[reset] Nothing deleted. Run `npm run db:reset -- --yes` to delete all participants and their answers.");
    return;
  }

  // Child tables first, so this also works when foreign keys are enforced.
  await db.delete(t.responses);
  await db.delete(t.cueAssignments);
  await db.delete(t.questionnaireAnswers);
  await db.delete(t.participants);
  console.log(`[reset] deleted ${Number(n)} participants and all their answers from ${url}.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[reset] failed:", err);
    process.exit(1);
  });
