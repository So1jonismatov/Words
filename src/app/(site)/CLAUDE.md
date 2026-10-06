# Participant flow

`/` → `/start` → `/survey` → `/game` → `/results`, plus `/about`. Each page redirects by `stageOf(currentParticipant())`; never let a page render for the wrong stage. `layout.tsx` centres content between header and footer; pages must fit the viewport (see the root CLAUDE.md).

## Landing (`page.tsx`)

- Shows the participant's cue count (from their survey link, else the setting) and `ESTIMATED_MINUTES`.
- Counters (participants, responses) appear only from `PUBLIC_COUNTS_MIN` participants; before that the stats describe the task (words, questions, minutes).
- `?link=inactive` shows a notice after a paused/unknown `/s/<code>` link.

## Start (`start/`)

- Age is required; "under 18" shows a notice and hides the rest (the server rejects it too). Country is required; region only for UZ; everything else optional.
- Country names (`Intl.DisplayNames`) and the region list (`Intl.Collator`, alphabetical in the UI language) are prepared **on the server**. No flags (emoji flags render as letters on Windows).
- The consent checkbox has `id="consent"` with a `<label htmlFor>` and `aria-describedby` pointing at the consent text.
- An unfinished participant who comes back revises their answers; their link is kept once cues were drawn.

## Survey (`survey/`)

- Four steps, each saved by `saveSurveyStep`. Q2 allows up to `Q2_MAX` choices plus "Other" with text.
- The card has one fixed height for all steps (buttons pinned to the bottom) and a reserved error line, so nothing jumps.

## Game (`game/`)

- `page.tsx` draws cues with `getOrCreateAssignments` from `poolFor(participant)` (link pool or all active words) and shows **only the latest round**. A finished participant with no open cues is sent to `/results`.
- `game.tsx` rules:
  - **The inputs stay mounted between cues.** `show(i)` sets the new cue's values and focuses the first field in the same event, so fast typists never type into a field that is about to be cleared.
  - **Saves are optimistic and run through an ordered queue** (`queue` ref). The next cue appears immediately. If a save fails, the player is taken back to that cue with their answers and the error. `finish()` waits for the queue and refuses to finish while any cue is unsaved.
  - Enter moves to the next field; Enter on an empty later field = "no more answers". Buttons: no more answers / don't know / skip; one step back is allowed.
  - Latencies: time from the cue being shown to the first keystroke per field.
  - The visible counter is `aria-hidden`; an `sr-only` `aria-live="polite"` region announces "n / total: cue". Each input has an `aria-label` including the cue.
- An e2e test types every cue with no waits; keep it passing.

## Results (`results/`)

- `page.tsx` prepares everything on the server: per-cue results (`getParticipantResults`), the word map (`getWordMap`), the delete code (`ensureDeleteCode`) and the play-more state.
- Thresholds (see the privacy invariants): below `RESULTS_MIN_N` people per cue or question, show "not enough data yet (n of 10)" instead of percentages, badges or top lists. Show the participant's own choice anyway.
- Cyrillic answers show their Latin comparison form (`олий → oliy`), because unique/shared counts use the normalized text.
- Tabs:
  - **Your answers:** legend for the status dots, cue picker, one cue's detail.
  - **Word map:** the d3 graph (`src/components/word-graph.tsx`). The concept `maʼnaviyat` sits in the centre; cues link to it (dashed), to dictionary-related cues (dashed) and to their most common answers (solid, weight = people). Answers equal to a cue word merge into that cue's node. Scope: "My words" (played cues) or "All words". The side panel shows the meaning, related words, answers and "given as an answer to".
  - **Questionnaire:** distributions with "You" highlighted.
- **Play more words:** `playMoreWords()` adds a round of unseen cues from the same pool (same count), then the game shows that round. A round that is still open is continued instead.
- **Share** copies or shares the site root only (it has an Open Graph preview), never the results URL.
- **Delete code bar:** the code is shown on every visit (derived from the session token, not stored).

## About (`about/`)

- "Who runs this study" (institution, contact, ethics approval, retention) comes from settings; empty fields show "not provided yet" so the gap is visible before launch.
- Delete my data: from this browser (session cookie) or by delete code from any browser (two-step confirmation; `deleteByCode` is rate-limited).
