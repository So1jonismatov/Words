# Database layer

Two dialects, one codebase. `getDb()` picks the dialect from `DATABASE_URL`:
- `file:` or `libsql:` → SQLite/libSQL
- `postgres(ql)://` → Postgres

App code is typed against the SQLite tables. At runtime the Postgres tables are swapped in.

## Tables

| Table | Notes |
| --- | --- |
| `participants` | demographics, `ui_lang`, `link_id`, `token_hash` (unique), `delete_code_hash` (unique), timestamps |
| `questionnaire_answers` | one row per participant; `q2_choices` is a JSON array |
| `cue_words` | `text` (canonical), `active`, `needs_review`, `sort_order`, `meaning` (JSON `{uz,en,ru}` or null), `related` (JSON array) |
| `cue_assignments` | participant × cue, `position`, `round` (1 = first set; "play more" adds 2, 3…) |
| `responses` | participant × cue × `slot`, raw + normalized text, typed `status`, `latency_ms` |
| `settings` | key → JSON value |
| `survey_links` | id (8-char code), name, `cue_ids` JSON, `cues_per_participant`, `active` |

Migrations: `0000_init`, `0001_survey_links`, `0002_meanings_rounds_delete_code` — each in `drizzle/sqlite` and `drizzle/pg`.

## Rules

- **Schema changes go in both files:** `schema.sqlite.ts` and `schema.pg.ts`.
  - Keep the same table names, column names and **JS types** in both.
  - Then run `npm run db:generate`, which writes migrations to `drizzle/sqlite` and `drizzle/pg`. Rename the generated files to something descriptive and update the `tag` in both `meta/_journal.json` files. Commit both dialects.
  - Never hand-edit an already-applied migration. Prefer additive changes (new nullable columns or columns with defaults), so existing databases migrate without data loss.
- **Portable column types only:**
  - timestamps: integer epoch ms (sqlite `integer({ mode: "number" })` / pg `bigint({ mode: "number" })`)
  - booleans: sqlite `integer({ mode: "boolean" })` / pg `boolean`
  - arrays and objects: JSON stored as `text` (parse with `parseChoices` / `parseMeaning`, which tolerate bad data)
- **Portable queries only:**
  - Use the `db.select()/insert()/update()/delete()` builder, joins, `.returning()` and `onConflictDoUpdate/DoNothing`.
  - Don't use `.get()`, `.all()`, `.run()`, `db.batch()` or dialect-specific SQL functions.
- **Counts:** write `sql<number>\`cast(count(...) as integer)\`` and wrap the result in `Number(...)`. Postgres returns bigint counts as strings.
- **Deletes:** delete child rows explicitly, as `deleteParticipant`, `deleteWord` and `scripts/reset-participants.ts` do. Don't rely on `ON DELETE CASCADE`, because SQLite only enforces it when the connection has `PRAGMA foreign_keys` on.
- **Seed** (`seed.ts`) must stay idempotent and never overwrite admin edits:
  - cue words only into an empty table (`seed-data.ts`; words needing a spelling check go in `SEED_NEEDS_REVIEW`);
  - missing settings keys only;
  - meanings only for words whose `meaning` is null and whose text is in `SEED_MEANINGS` (`meanings-data.ts`).
- **Meanings data** (`meanings-data.ts`): short glosses written for this project (Wiktionary was used only to check senses; the Uzbek explanatory dictionary is copyrighted, so never paste from it). Keys are canonical forms with the ASCII apostrophe. `"ma'naviyat"` is the concept itself (the map's centre), not a cue word.

## Connection caching (`index.ts`)

`getDb()` caches the client on `globalThis` so dev hot reloads don't open new connections. The cached state remembers which schema module it was built with and is rebuilt when a reload brings a new one. Without this, a running dev server kept a stale `t` and crashed with `Cannot read properties of undefined (reading 'Symbol(drizzle:Columns)')` after a table was added. `setDbForTests()` marks injected states so tests are never replaced.

## Testing

`tests/unit/repo.test.ts` runs the repo layer against in-memory libSQL **and** PGlite using `setDbForTests()`. Add a case there when you add a repo function. That test is how we know the Postgres path works.
