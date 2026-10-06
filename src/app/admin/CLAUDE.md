# Admin area

There is one shared password (`ADMIN_PASSWORD`). A successful login sets an HMAC-signed httpOnly cookie (`mx_admin`, 8 h, SameSite=strict); see `src/lib/admin-auth.ts`. Logins are rate-limited to 10 per 15 min.

Pages: `/admin` (dashboard: charts + tabs), `/admin/links` (survey links), `/admin/words` (word list + meanings), `/admin/settings`.

## Rules

- **Every admin page must call `if (!(await isAdmin())) return null;` itself.** The login gate in `layout.tsx` is not enough: App Router pages render in parallel with their layout, so page data could leak into the RSC payload.
- **Every admin server action** (`src/actions/admin.ts`) calls `requireAdmin()` first and validates its input with Zod.
- **Route handlers** (`src/app/api/admin/*`) check `verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)` and return 401 otherwise.
- **Refreshing after a mutation:** actions call `refresh()` from `next/cache` (new in Next 16). Don't add `router.refresh()` loops on the client.
- **Errors:** `error.tsx` is the admin error boundary (Next 16 passes `retry`, not only `reset`). A failed query must show it, never a blank page. Its text tells the admin to restart the server so migrations run, which is the usual cause.
- **Exports** (`exportRows`) contain anonymous IDs only. `tokenHash` and `deleteCodeHash` never leave the server.

## Dashboard (`page.tsx`)

- Filters (link, age, gender, country, background, date range) are a plain GET form over `searchParams`. To keep active filters when a secondary form is submitted, use the `keep()` helper.
- Tabs are links (`?tab=`); `charts` is the default. The other tabs (questionnaire, cues, cloud, compare, cooc, export) use `getDashboard()` in `src/lib/repo/stats.ts`, which returns `suppressed: true` below `K_ANON`. Respect that flag, and never render breakdowns for suppressed groups.

## Chart builder (`chart-builder.tsx`)

- Client component; every change calls `chartAction()` (server action) with `{ x, series, metric, word?, cueIds, filter }`. The dashboard filter is passed in as props, so charts follow the filter bar.
- Aggregation is the pure `buildChart()` in `src/lib/charts.ts` (see `src/lib/CLAUDE.md`); the repo loader is `getChart()` in `src/lib/repo/charts.ts`. Labels are resolved on the server in the admin's language.
- **k-anonymity is enforced on the server:** suppressed cells come back as `value: null, n: 0` and are drawn hatched. Never compute values on the client from raw rows.
- Dimensions: demographics, link, UI language, Q2 (multi-valued: a person counts once per chosen concept), Q3, Q4, cue word, day, week. "Cue word" needs an answer measure (`RESPONSE_METRICS`); the select disables it otherwise.
- Chart types: bars, stacked, stacked 100%, line, donut, heatmap. d3 provides scales and shape generators only; React renders the SVG. Colours: theme tokens first, then a fixed mid-tone palette (`PALETTE`).
- The "Data table" toggle is the accessible alternative to the SVG; CSV export is built on the client from the returned cells.
- To add a metric or dimension: extend the arrays in `src/lib/charts.ts`, handle it in `buildChart()`, add labels under `admin.charts.metrics|dims` in all three languages, and add a unit test.

## Survey links (`links/`)

- A link (`survey_links`) has a name, its own word set (`cueIds`) and words per participant. `/s/<id>` sets the `mx_link` cookie (30 days) and redirects to `/`; inactive or unknown links clear it and show a notice.
- Participants record `linkId` at start; cues are drawn from the link's pool and **balanced per link** (`cueExposure({ cueIds, linkId })`).
- A link with participants can't be deleted (`deleteBlocked`); pause it instead.

## Words (`words/`)

- Text edits go through `normalizeCueText`; duplicates are rejected.
- Each word has a meaning (`{uz, en, ru}` JSON, or null) and related words (canonical forms). They feed the participants' word map. Edit them with the "i" button; `updateWordMeaningAction` validates and dedupes.
- Deleting a word deletes its responses and assignments (confirmation shows the count).

## Settings (`settings/`)

- Stored as key/value JSON rows; `settingsSchema` in `src/lib/settings.ts` validates each key. New keys need a default in `DEFAULT_SETTINGS` (the seed adds missing keys; it never overwrites).
- Study information shown on `/about`: institution, contact, ethics approval, data retention (per language; empty = default text). These must be filled in before launch.
- Changing `cuesPerParticipant` affects only new participants; links carry their own count.
