# Components

## UI primitives (`ui/`)

- `Button` (pill): variants `primary` / `secondary` (tonal) / `ghost` / `plain` / `danger`; sizes `sm` (32px, 13px text), `md`, `lg`. Every button has the `tap` class (≥ 44×44px hit area).
- Fields (Material 3 "filled", no border): `Input`, `Textarea`, `Select`, `TextField`, `SelectField` (label inside the field). **All use a 16px font** so iOS doesn't zoom; placeholders use `text-muted` (not faded further) for contrast.
- `ChoiceOption` (radio/checkbox row on a native input), `Card`, `Eyebrow` (12px uppercase label), `ProgressBar`.
- Merge classes with `cn()`; a variant's `inline-flex` otherwise beats your `hidden`.

## Touch targets

`.tap` in `globals.css` adds an invisible centred pseudo-element of at least 44×44px. Use it on any small control (chips, icon buttons, footer links, language switch) instead of making the control visually bigger.

## Chrome

- `site-chrome.tsx`: header (h-14; changing its height breaks every `calc(100dvh-…)` in the pages) and footer.
- `locale-switcher.tsx`: UZ/EN/RU, stored in a cookie, then `router.refresh()`.
- `theme-toggle.tsx`: `THEME_SCRIPT` runs before paint via `InlineScript` in the root layout's `<head>`.
- `inline-script.tsx`: renders `type="text/javascript"` on the server and `text/plain` on the client (React never runs client-rendered scripts and warns about them). Use it for any pre-paint script; don't use `next/script` `beforeInteractive` in the root layout.

## Word graph (`word-graph.tsx`)

Obsidian-style association graph used on the results page.

- **d3 does the math, React renders the SVG.** `forceSimulation` (link, many-body, collide, x/y) for layout, `d3-zoom` for pan/zoom on the background. Node dragging uses React pointer events with pointer capture; the zoom filter ignores `[data-node]` targets so the two don't fight.
- The layout waits for the container to be measured, is pre-ticked 300 times (opens settled), then animates gently. Forces follow the container's aspect ratio. The view auto-fits to the central 94% of nodes after the first layout and when the simulation ends, unless the user has panned/zoomed. The fit button shows everything.
- Hover or selection dims everything outside the node's neighbourhood. Selecting the hub (the default) doesn't dim.
- Cue and hub nodes are focusable buttons (Enter/Space selects); answers are not, to keep the tab order short. Labels: always for cues/hub; for answers when large, yours, neighbours of the active node, or zoomed in.
- Colours come from theme tokens (`var(--accent)` etc.), so it works in both themes.
- Props are plain nodes/edges; building them (scope, merging answers into cue nodes, privacy) is the caller's job (`MapPanel` in `results-view.tsx`).

## Other

- `bars.tsx`: horizontal bar list (labels above bars, percent of `total`).
- `counter.tsx`: animated number for the landing stats.
- `logo.tsx`: the association-network mark (also drawn in `app/icon.svg`, `apple-icon.tsx`, `opengraph-image.tsx`).
