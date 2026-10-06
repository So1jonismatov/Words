/**
 * Runs migrations and the idempotent seed for whatever DATABASE_URL points at.
 *   npm run db:setup             migrate + seed (also runs automatically before dev/build)
 *   npm run db:migrate           migrate only
 *   npm run db:seed              migrate + re-insert any missing seed cue words
 */
import "./load-env";
import { databaseUrl, getDb } from "../src/db";
import { runMigrations } from "../src/db/migrate";
import { seed } from "../src/db/seed";

async function main() {
  const args = new Set(process.argv.slice(2));
  const state = getDb();
  const url = databaseUrl().replace(/\/\/[^@]*@/, "//***@");
  await runMigrations(state);
  console.log(`[db] migrations applied (${state.dialect}: ${url})`);
  if (args.has("--migrate-only")) return;
  const { insertedWords, filledMeanings } = await seed(state, { force: args.has("--seed") });
  const added = [insertedWords && `${insertedWords} cue words`, filledMeanings && `${filledMeanings} word meanings`].filter(Boolean);
  console.log(added.length ? `[db] seeded ${added.join(", ")}` : "[db] seed: nothing to add");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[db] setup failed:", err);
    process.exit(1);
  });
