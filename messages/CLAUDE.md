# UI strings

Every user-visible string lives here, in `uz.json` (the default), `en.json` and `ru.json`. There is no locale routing: the locale comes from the `NEXT_LOCALE` cookie, then `Accept-Language`, then Uzbek (`src/i18n/request.ts`).

## Rules

- **Add every key to all three files.** `tests/unit/messages.test.ts` fails if the key sets differ or if any value is an empty string.
- **Option labels** sit under `options.<group>.<value>`, and the values must match the arrays in `src/lib/options.ts`. If you add an option there, add its label here in all three languages. Chart labels reuse them; chart-only labels are under `admin.charts.dims|metrics|types`.
- **Error keys** returned by server actions (e.g. `game.errors.spam`, `about.deleteCodeUnknown`) must exist here, because the client translates them with `tRoot(res.error)`.
- **Placeholders:** next-intl ICU syntax, e.g. `{count}`, `{minutes}`, `{min}`. Keep the names identical across all three languages. Plurals use ICU `{count, plural, …}` (see `results.map.people`).
- **Numbers that are configuration** (minutes, thresholds, word counts) are placeholders filled from `src/lib/options.ts` or settings, never hard-coded in the text. `landing.sub` and `consent.default` take `{minutes}` from `ESTIMATED_MINUTES`.
- **Cue words are not UI strings.** They live in the database, are always Uzbek, and are never translated. Their meanings live in the database too (seeded from `src/db/meanings-data.ts`).
- **Admin-editable text:** `consent.default` and `about.retentionDefault` can be overridden per language from `/admin/settings`. Admin text in Uzbek is passed through `typographyUz()` before display.
- **Translations:** write natural Uzbek and Russian, not word-for-word English. A native-speaker review is still pending.

## Typography (one convention everywhere)

| Language | Letters | Quotes | Apostrophe in contractions |
| --- | --- | --- | --- |
| Uzbek | `oʻ` `gʻ` with **ʻ U+02BB**; tutuq **ʼ U+02BC** (`maʼnaviyat`, `eʼlon`) | «…» | — |
| English | the Uzbek word keeps its tutuq: `Maʼnaviyat` | “…” | ’ (U+2019): `don’t` |
| Russian | `Maʼnaviyat` when written in Latin | «…» | — |

- This matches `displayUz()` / `typographyUz()`, so database text and UI text look the same.
- **Never use ASCII `'`** in message values. In ICU MessageFormat an ASCII `'` next to `{`, `}` or `#` starts an escape and silently breaks placeholders. `‘` (U+2018) is also wrong for oʻ/gʻ (it was used before and looked inconsistent next to database text).
- Quick check for stray characters:
  ```bash
  node -e "for (const f of ['uz','en','ru']) { const s=require('fs').readFileSync('messages/'+f+'.json','utf8'); console.log(f, [...s].filter(c=>\"'‘\".includes(c)).length) }"
  ```
  All three counts should be 0.
