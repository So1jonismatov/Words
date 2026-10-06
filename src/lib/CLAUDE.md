# Pure logic (`src/lib`)

Files directly in `src/lib` are framework-free (no `next/*`, no React except `cache` in `settings.ts`) and unit-tested. Database access is in `src/lib/repo/` (see `src/db/CLAUDE.md`); cookies are in `session.ts` and `link-cookie.ts`.

## Modules

| File | Purpose |
| --- | --- |
| `options.ts` | answer options, locales, `K_ANON`, `RESULTS_MIN_N`, `PUBLIC_COUNTS_MIN`, `ESTIMATED_MINUTES` |
| `normalize.ts` | `normalizeAnswer` / `normalizeCueText` (storage), `displayUz` / `typographyUz` (display), Cyrillic → Latin |
| `validation.ts` | `checkAnswer()`: the only answer validator (client and server) |
| `cue-selection.ts` | balanced weighted sampling (Efraimidis–Spirakis, weight `1/(1+count−min)²`) |
| `aggregate.ts` | questionnaire distributions and top lists |
| `charts.ts` | `buildChart()` for the admin chart builder |
| `delete-code.ts` | participant delete codes |
| `consent.ts` | consent lines and retention text (admin override or default message) |
| `participant-pool.ts` | which word pool and per-round count apply to a participant |
| `settings.ts` | settings schema, defaults, cached loader |
| `rate-limit.ts`, `secret.ts`, `admin-auth.ts`, `session.ts`, `link-cookie.ts` | security plumbing |

## Rules

- **Thresholds live in `options.ts`.** Don't inline 5, 10 or 50 anywhere; import the constant so the privacy rules stay in one place.
- **Normalization:** storage is lowercase, NFC, canonical ASCII `'`, punctuation stripped (inner `'` and `-` kept), Cyrillic transliterated. Display never changes stored data. `typographyUz` must agree with `displayUz` on canonical words (tested).
- **`buildChart(people, obs, spec)`:**
  - Two kinds of observations: people (participant metrics) and cue observations (participant × cue: status, answered count, first latency, normalized answers). `RESPONSE_METRICS` decides which one a metric uses.
  - Every cell carries `n` = distinct participants. Cells with `0 < n < K_ANON`, and every cell of an X group below `K_ANON`, are returned as `value: null, n: 0`. A data set below `K_ANON` returns `error: "tooFew"`.
  - Q2 is multi-valued (a person counts in each chosen concept). Missing optional answers are the `"na"` category, listed last.
  - Category order: option order for enums, cue `sortOrder` for cues, size for country/link (max 30, rest counted in `truncated`), continuous days/weeks (UTC; weeks start Monday; max 120 points).
  - Shares: with a series, share of the X group; without, share of all people.
- **Delete codes:** `deleteCodeFor(token)` = 12 chars from an alphabet without look-alikes (no 0/O/1/I/L), shown `XXXX-XXXX-XXXX`. The DB stores `hashDeleteCode(code)` only. `normalizeDeleteCode` accepts any case and separators and rejects anything else.
- **Cue selection** must stay unbiased within a pool: survey links balance per link (`cueExposure({ cueIds, linkId })`), play-more rounds exclude cues already assigned.
