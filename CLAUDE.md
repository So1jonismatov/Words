@AGENTS.md

# Maʼnaviyat Xaritasi — notes for working in this repo

Anonymous research survey with a word-association game about the concept "Maʼnaviyat". Built with Next.js 16 (App Router), React 19, next-intl 4, Drizzle 0.45 (SQLite/libSQL or Postgres), Tailwind 4, Zod 4 and d3 7 (charts and the word map).

The README covers setup, env vars, deployment and how the parts work. This file covers the rules that are easy to break. Folder-specific rules live next to the code:

| File | Covers |
| --- | --- |
| `src/app/(site)/CLAUDE.md` | participant flow: start, survey, game (save queue), results, word map, delete codes, play-more rounds |
| `src/app/admin/CLAUDE.md` | admin auth, dashboard, chart builder, survey links, word meanings, exports |
| `src/db/CLAUDE.md` | dual-dialect schema, migrations, seed (words + meanings), `getDb()` caching |
| `src/lib/CLAUDE.md` | pure logic: normalization, typography, charts aggregation, delete codes, thresholds |
| `src/components/CLAUDE.md` | UI primitives, touch targets, the d3 word graph, inline scripts |
| `messages/CLAUDE.md` | UI strings and the apostrophe/quote convention |
| `tests/CLAUDE.md` | unit, repo (SQLite + PGlite) and e2e tests, isolated servers |

## Commands

```bash
npm run dev          # migrates + seeds data/local.db first (predev), then next dev
npm run lint         # tsc --noEmit (there is no ESLint)
npm test             # vitest: unit tests + the data layer on SQLite AND Postgres (PGlite)
npm run test:e2e     # playwright: production build on :3100 with throwaway data/e2e.db
npm run db:generate  # after schema changes: generates migrations for BOTH dialects
npm run db:setup     # migrate + idempotent seed for whatever DATABASE_URL points at
npm run db:demo      # 120 fake participants in local SQLite ("-- --clear" removes them)
npm run db:reset     # shows the participant count; "-- --yes" deletes ALL participants (pre-launch)
```

Run `npm run lint && npm test` before calling a change done. If you touched a page flow, also run `npm run test:e2e`; it needs `npx playwright install chromium` once and a free port 3100.

Next 16 allows only one `next dev` per project (lockfile). Stop a running dev server before starting another one. E2E uses `next build` + `next start`, so it can run alongside dev.

After pulling schema changes, restart `npm run dev` (predev runs the migrations). A dev server that was already running hot-reloads the code but its database may lack new columns. `/admin` then shows the error boundary, which says so.

## Layout

- `src/app/(site)/` — participant flow: `/` → `/start` → `/survey` → `/game` → `/results`, plus `/about`.
  - Each page redirects based on `stageOf(currentParticipant())` in `src/lib/session.ts`.
- `src/app/s/[code]/route.ts` — survey links: sets the `mx_link` cookie and redirects to `/`.
- `src/app/admin/` — dashboard + chart builder, survey links, word editor (with meanings), settings.
- `src/app/{icon.svg,apple-icon.tsx,opengraph-image.tsx}` — favicon, iOS icon, link preview (static, no DB).
- `src/actions/` — server actions. They are the only way the client mutates data. No API routes, except the admin export.
- `src/lib/repo/` — all database access.
- `src/lib/` — pure logic (`normalize`, `validation`, `cue-selection`, `aggregate`, `charts`, `delete-code`, `csv`). Covered by unit tests; keep it free of framework imports.
- `src/db/` — schemas, connection, migrator, seed, seed data (words + meanings).
- `messages/{uz,en,ru}.json` — every UI string.
- `scripts/` — `setup-db` (migrate + seed), `demo-data`, `reset-participants`.

## Conventions

**Server actions**
- Every action validates its input with Zod.
- Every action returns `ActionResult` (`src/actions/types.ts`).
- On failure, `error` is a **message key** such as `"game.errors.spam"` or `"common.errorRateLimited"`. Clients show it with a root `useTranslations()` call: `tRoot(res.error)`. Never return raw English text.

**Repo layer**
- `src/lib/repo/*` must not import `next/headers` or `next/*`. Tests call it directly after `setDbForTests(...)`.
- Cookies and sessions live in `src/lib/session.ts`, `src/lib/link-cookie.ts` and in the actions.

**Answer handling**
- Validation lives only in `checkAnswer()` (`src/lib/validation.ts`). The game UI and `saveCue` both call it, so one change applies to both.
- Keep it *mild*. It must never block a genuine short answer: 2-letter words, numbers and emoji pass.

**Text normalization and typography**
- Storage uses the canonical ASCII `'` (`normalizeAnswer`, `normalizeCueText`). Cyrillic answers are transliterated, so «олий» and «oliy» count as the same answer.
- Display goes through `displayUz()` (cue words, answers, site title) or `typographyUz()` (free Uzbek prose an admin typed). Both render `oʻ` / `gʻ` (U+02BB) and the tutuq `ʼ` (U+02BC).
- One convention everywhere: Uzbek letters ʻ/ʼ, Uzbek and Russian quotes «», English quotes “”, English contractions ’. See `messages/CLAUDE.md`.

**Response rows**
- Button presses are stored as typed `status` values (`unknown`, `no_more`, `skipped`), never as empty strings.
- Every finished cue has a **slot-1 row**. `cueExposure()`, the "seen" counts and chart observations depend on that, so keep it true if you change how cues are saved.

**Hydration**
- Don't format numbers or dates with `Intl`/`toLocaleString` in client components. Node's and Chromium's ICU data differ for Uzbek and the page fails to hydrate. Use `formatNumber()` from `src/lib/utils.ts`.
- Sorting by translated label (`Intl.Collator`) also happens on the server (see the region list in `start/page.tsx`).
- Server-only formatting is fine, e.g. `Intl.DisplayNames` for country names.
- Pre-paint scripts use `<InlineScript>` (`src/components/inline-script.tsx`), never `next/script` `beforeInteractive` in the root layout. React 19 warns about client-rendered `<script>` tags and the theme toggle stops working until hydration.

**UI (Material 3–style, borderless)**
- Separate surfaces by **tone, not borders**. Tokens in `globals.css`: `bg` (surface), `card` (container-low), `card-3` (container-high: list rows, chips), `card-2` (container-highest: fields, tracks), `accent`/`accent-soft` (primary / secondary container), `teal`.
  - Don't add `border` classes. The only outlines are checkbox/radio controls and focus rings.
  - Don't hard-code colours, except the fixed mid-tone chart palette in `chart-builder.tsx`. Both themes are driven by the `.dark` class.
- Use the primitives in `src/components/ui/` (see `src/components/CLAUDE.md`). Merge classes with `cn()`, never string `+`.
- **Readable and tappable:** body text ≥ 13px (`text-[13px]`, `text-xs` only for tertiary captions), **every input/select ≥ 16px** (iOS zooms on smaller), and every control has a ≥ 44×44px hit area via the `tap` utility.
- **Everything fits the viewport.**
  - The body is `h-dvh`. Only `<main>` can scroll, and flow pages must not need it.
  - Checked sizes: 1280×720, 1440×900, 390×844, 360×740. The about page may scroll on phones.
  - Long content scrolls *inside* a panel: results uses tabs + a cue picker; admin uses a fixed-height area with tabbed panels.
  - Reserve space for error lines (`min-h-5` slots) so messages never push buttons down; the survey card has one fixed height for all steps.
  - The viewport uses `interactive-widget=resizes-content` so the phone keyboard shrinks the layout.

**Mobile and accessibility**
- The game must stay one-handed and keyboard-first.
- Inputs need labels (`sr-only` or `aria-label` is fine); checkboxes get an `id` + `<label htmlFor>`. Keep visible focus rings and `lang="uz"` on Uzbek text inside other-language pages.
- Changing content that matters (the next cue, progress) is announced through an `aria-live="polite"` region.

## Privacy invariants (research ethics — do not weaken)

- Never store names, emails, phone numbers or IP addresses. Rate limiting uses an in-memory HMAC of IP + hour (`src/lib/rate-limit.ts`).
- The participant session cookie holds a random token. The database stores only `sha256(token)` (`token_hash`) and the hash of the delete code (`delete_code_hash`). **Exports must exclude both.**
- `K_ANON = 5` (`src/lib/options.ts`). Admin breakdowns, group comparisons and **every chart cell** hide groups with fewer than 5 people.
- Public results:
  - percentages and other people's answers only once **`RESULTS_MIN_N` = 10** people answered that cue or question ("not enough data yet" below);
  - per-cue answers only when given by at least 2 people; Q1 words only when given by at least 3 people;
  - a participant always sees their own answers (that reveals nothing to anyone else).
- Landing-page counters stay hidden until `PUBLIC_COUNTS_MIN` (50) participants.
- Religious background stays optional and is never shown publicly.
- Share links point to the site root only, never to someone's personal results.
- "Delete my data" (`deleteParticipant`) must remove every table's rows for that participant. If you add a participant-linked table, add it there too and to `scripts/reset-participants.ts`.
- Delete codes (`src/lib/delete-code.ts`) are derived from the session token; deletion by code is rate-limited (10/hour per IP) and an unknown code reveals nothing.

## Gotchas

- **Never point test or measurement scripts at the user's dev server or `data/local.db`.**
  - Doing so writes fake participants into real data.
  - Use an isolated server instead: `DATABASE_URL=file:./data/<name>.db ADMIN_PASSWORD=… npm run build && npx next start -p 3100` (or `npx next dev -p 3100` when no other dev server runs), as the e2e config does. Delete that database afterwards.
  - Don't read or reuse the real `ADMIN_PASSWORD` from `.env.local`.
  - Stop your server afterwards. `TaskStop` on the shell can leave the `next` child process alive on 3100; check the port.
- Before a real launch: `npm run db:reset -- --yes` removes test participants, and the About page needs the institution, contact, ethics approval and retention text (`/admin/settings`).
- Screenshots taken with Playwright during hydration can log a mismatch on `style={{caret-color:...}}`. That comes from Playwright, not the app.
- Next's route announcer has `role="alert"` and repeats the page title. In e2e tests use exact text matches or scoped locators.
- Bash heredocs with `\p{…}` or nested backticks get mangled when editing TS through `node -e`/`node -`. Use the Edit/Write tools for code with regexes or template literals.
- There is no Prettier config. If you run Prettier, pass `--print-width 140` to match the existing style.
