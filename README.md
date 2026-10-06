# Maʼnaviyat Xaritasi

An anonymous research survey about how people understand **“Maʼnaviyat”** (spirituality). It is modelled on the flow of word-association studies such as Small World of Words, with original branding and text. It has three parts:

1. **Consent + demographics** (`/start`): age group, gender, country/region, education, religious or philosophical background. Every sensitive field is optional and has a "Prefer not to say" choice. Under-18s are politely blocked.
2. **Questionnaire** (`/survey`): 4 questions about the concept, one per screen.
3. **Word-association game** (`/game`): each participant gets *N* Uzbek cue words (default 15) and gives up to 3 associations for each one. Personal feedback follows on `/results`.

Researchers use `/admin` (one password) to edit the cue-word list, change settings, view statistics and export data.

UI languages: **Uzbek (Latin, default)**, English and Russian. Cue words are always Uzbek.

---

## Quick start

Requirements: Node.js 20.9+ (tested on Node 24).

```bash
npm install
cp .env.example .env.local      # then edit ADMIN_PASSWORD and SESSION_SECRET
npm run dev                     # http://localhost:3000
```

`npm run dev` runs the database migrations and the seed first, so the first run works with no other setup. The local database is a SQLite file at `data/local.db`.

Admin: http://localhost:3000/admin (password = `ADMIN_PASSWORD`).

To preview the dashboard with synthetic data (local SQLite only):

```bash
npm run db:demo            # adds 120 fake participants (ids start with "demo-")
npm run db:demo -- --clear # removes them again
```

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `ADMIN_PASSWORD` | yes | Password for `/admin`. If it is unset, admin login is disabled. |
| `SESSION_SECRET` | yes in production | Signs the admin cookie and salts the short-lived rate-limit keys. Use 32+ random characters: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `DATABASE_URL` | no | `file:./data/local.db` (default), `libsql://…` (Turso), or `postgresql://…` (Postgres/Supabase). |
| `DATABASE_AUTH_TOKEN` | Turso only | Auth token for a `libsql://` URL. |

### Switching the database

The dialect is chosen from `DATABASE_URL` alone; nothing else in the code changes:

```bash
DATABASE_URL=file:./data/local.db                                # SQLite (local dev)
DATABASE_URL=libsql://my-db.turso.io  DATABASE_AUTH_TOKEN=…      # Turso (SQLite in the cloud)
DATABASE_URL=postgresql://postgres:pw@db.xxxx.supabase.co:5432/postgres   # Postgres / Supabase
```

There are two Drizzle schemas with the same tables and identical JS types: `src/db/schema.sqlite.ts` and `src/db/schema.pg.ts`. Each has its own migrations under `drizzle/sqlite` and `drizzle/pg`. The test suite runs the full data layer against both (Postgres via PGlite).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Migrate + seed, then start the dev server. |
| `npm run build` / `npm start` | Migrate + seed, production build, then serve. |
| `npm run db:setup` | Migrate + seed (idempotent; never overwrites admin edits). |
| `npm run db:migrate` | Migrate only. |
| `npm run db:seed` | Re-insert any seed cue words that are missing. |
| `npm run db:generate` | After editing **both** schema files, generate new migrations for both dialects. |
| `npm run db:demo` | Add or clear synthetic demo participants (local SQLite only). |
| `npm test` | Unit and integration tests (Vitest). |
| `npm run test:e2e` | Playwright happy path on desktop and mobile. It builds the app and uses a throwaway `data/e2e.db`. Run `npx playwright install chromium` once first. |
| `npm run lint` | TypeScript type-check. |

## Editing the cue words

**Normal way: `/admin/words`.** Changes take effect immediately, with no redeploy:

- **Add:** paste words into the box, one per line. Duplicates are skipped.
- **Edit / reorder / activate / deactivate / delete:** use the buttons on each row.
  - Deactivate a word to stop showing it to new participants. Its existing data is kept.
  - Deleting a word also deletes its responses, and asks for confirmation first.
- **CSV:** *Import CSV* takes the columns `text, active(1/0)`; the header row is optional. *Download CSV* exports the current list.
- Words flagged **⚠ check spelling** need a human check. `erksevarlik` is flagged because the original list said "erksevar". Press *Looks right* or edit the word to clear the flag.

**Initial list for new databases:** `src/db/seed-data.ts`. This list is only inserted when the `cue_words` table is empty.

Apostrophes are normalized: `' ’ ‘ ʻ ʼ` and backtick are all stored as `'`. Uzbek words are shown with proper `oʻ / gʻ / ʼ`.

## Settings (`/admin/settings`)

- Project name (default: “Maʼnaviyat Xaritasi”)
- Cue words per participant (default 15; if the list has fewer active words, all of them are used)
- Responses per cue (1–3)
- Enabled UI languages
- Country list (ISO codes; “Other” is always added)
- Consent text for each language (leave empty to use the default text from `messages/*.json`)

## How it works

### Cue selection
`src/lib/cue-selection.ts`. Each new participant gets *N* cues, sampled without replacement and weighted toward the cues with the fewest finished responses so far:

- weight = `1 / (1 + count − minCount)²`, using Efraimidis–Spirakis sampling
- if all counts are equal, the sample is uniformly random
- the chosen cues are shuffled before they are shown

The tests check that exposure stays within ±3 across 400 simulated participants.

### Response storage
`responses` has one row per slot.

- Typed answers are stored with `status = answered`, with both `raw_text` and `normalized_text`.
- The buttons are stored as typed events, never as empty strings:
  - **Bilmayman** → `unknown`
  - **Boshqa javob yoʻq** → `no_more` (stored in the first unused slot)
  - **Oʻtkazib yuborish** → `skipped`
- `latency_ms` is the time from showing the cue to the first keystroke in that field. For button events it is the time to the click.

### Normalization
`src/lib/normalize.ts`:

- trim, lowercase, collapse whitespace
- unify apostrophes (oʻ and gʻ are kept)
- strip punctuation (hyphens inside a word, as in `ota-ona`, are kept)
- transliterate Uzbek Cyrillic to Latin (`Ўзбекистон` → `o'zbekiston`)

The raw text is always kept as well.

### Validation
`src/lib/validation.ts`. Only things that cannot be a real answer are rejected: an empty field, a single letter, more than 60 characters, mashed repeats (`aaaa`, `asdasdasdasd`), or a duplicate answer for the same cue. Two-letter words, numbers and emoji are accepted. The same check runs on the client and on the server.

### Sessions
A random token is stored in an httpOnly cookie. The database stores only its SHA-256 hash. Progress is saved after every cue, so a refresh resumes where the participant left off.

### Results page
For each answer, the participant sees **Unique** or **Shared with X%** (the share of other participants who answered that cue). There is also a top-5 list per cue and their questionnaire answers compared with everyone's. Answers that only one other person gave are never shown.

## Privacy and ethics

- No names, emails, phone numbers or IP addresses are stored.
  - Rate limiting uses an HMAC of (IP + current hour) held in memory only.
- Religious background is optional. Every breakdown needs a group of at least **5** people (`K_ANON` in `src/lib/options.ts`):
  - an admin filter that matches fewer than 5 participants hides all of its details
  - in the group comparison, groups smaller than 5 are hidden
  - free-text answers to Q1 on the public results page need at least 3 people giving the same answer
- **Delete my data** (`/about#delete`) removes every row linked to the browser's session.
- Exports use only anonymous random IDs. The session-token hash is never exported.

## Deploying to Vercel

1. Create the database:
   - **Turso:** `turso db create manaviyat` and `turso db tokens create manaviyat`, or
   - **Supabase:** a Postgres connection string. Use the *session* pooler or a direct connection.
2. In Vercel, set `DATABASE_URL`, `DATABASE_AUTH_TOKEN` (Turso only), `ADMIN_PASSWORD` and `SESSION_SECRET`.
3. Deploy. `prebuild` applies the migrations and the seed to that database during the build.

A local SQLite file does **not** persist on Vercel, so always use Turso or Postgres there.

Rate limits are in memory and apply per serverless instance. That is enough to deter abuse, but they are not a global quota.

## Project layout

```
messages/{uz,en,ru}.json   all UI strings
drizzle/{sqlite,pg}/       SQL migrations
scripts/                   setup-db (migrate + seed), demo-data
src/app/(site)/            participant pages: / start survey game results about
src/app/admin/             dashboard, word editor, settings (password-protected)
src/app/api/admin/export   CSV/JSON export
src/actions/               server actions (all inputs validated with Zod)
src/db/                    schemas, connection, migrator, seed
src/lib/                   normalization, validation, cue selection, stats, settings, auth
src/components/            UI primitives (shadcn-style) and layout chrome
tests/unit, tests/e2e      Vitest and Playwright
```
# Words
# Words
