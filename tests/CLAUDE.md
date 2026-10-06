# Tests

```bash
npm test             # vitest (unit + repo)
npm run test:e2e     # playwright (builds the app; needs port 3100 free)
```

## Unit (`tests/unit/`)

| File | Covers |
| --- | --- |
| `normalize.test.ts` | apostrophes, Cyrillic, punctuation, `typographyUz` vs `displayUz` |
| `validation.test.ts` | `checkAnswer` stays mild |
| `cue-selection.test.ts` | balanced sampling |
| `charts.test.ts` | `buildChart`: ordering, shares, Q2 multi-values, k-anonymity, answer measures, time axis |
| `delete-code.test.ts` | code format, normalization, hashing |
| `messages.test.ts` | same keys in uz/en/ru, no empty values |
| `repo.test.ts` | the whole data layer on in-memory **libSQL and PGlite** (`describe.each`): seed + meanings, participant flow, assignments, survey links, delete codes (and their absence from exports), play-more rounds, word-map privacy rules, charts via the DB, word/meaning edits, settings |

- Repo tests share one database per dialect across `it` blocks, so later tests see earlier data. Create your own participants and don't assert global totals that other tests change.
- Every new repo function gets a case in `repo.test.ts`; it is the only check that the Postgres path works.

## E2E (`tests/e2e/`)

- `playwright.config.ts` deletes `data/e2e.db`, runs `npm run build` and `next start -p 3100` with a throwaway `ADMIN_PASSWORD` (`e2e-admin-password`). Projects: Desktop Chrome and Pixel 7.
- The tests cover the full flow with the 3-answer game, fast typing (no waits; every cue must be saved), play-more, delete by code from another browser context, the language switch, admin login + charts tab, and a survey link (chosen words only, own word count, counted per link).
- Read the cue total from the progress counter (`totalCues`), never hard-code it: the default is 18 and links change it.
- Selectors use Uzbek UI text with the site's typography (`Oʻyinni boshlash`, U+02BB). If you change a message, update the selector.
- Next's route announcer repeats the page title with `role="alert"`; use exact text or scoped locators.

## Manual checks against a running app

Never against the user's dev server or `data/local.db`. Start an isolated one:

```bash
DATABASE_URL=file:./data/check.db ADMIN_PASSWORD=check-admin-pass SESSION_SECRET=check-secret-0123456789abcdef \
  npx tsx scripts/setup-db.ts && DATABASE_URL=file:./data/check.db npx tsx scripts/demo-data.ts 150
DATABASE_URL=file:./data/check.db ADMIN_PASSWORD=check-admin-pass npx next dev -p 3100   # only if no other next dev runs
```

Crawl with Playwright (console errors, page errors, 5xx, overflow of `<main>`, the Next dev overlay issue count), then stop the server, make sure port 3100 is free, and delete `data/check.db`.
