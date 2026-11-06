# Phase 39: Dashboard visual quality (enhancement plan)

**DonorDesk Version 3.007** · created 2026-11-02 · branch `0016-pcw` (the planned `0017-dashboard-visuals` branch was not made) · status: **BUILT AND DEPLOYED 2026-11-03** (`releaseId=20261103044136`, then `20261103054323`); checked in the signed-in test tenant (`../demo/verification-2026-11-03-dashboards.md`). As-built record in §12; invariants in AGENTS.md "Phase 39 invariants"

Source: the dashboards audit of 2026-11-02 (code read of `features/dashboards/`, `features/dashboard/`, `components/ui/Tile.tsx`,
`features/design/domain/tokens.ts`, `reporting/chart-render.ts`; **no browser pass yet**, see Batch 0).

## 1. Goal and non-goals

**Goal.** Every dashboard surface (dashboard canvas, Home, Chart Studio, report figures, exports) looks like one product, in light and dark, on a
phone and on a wall display, without weakening any honesty rule (a gap is never 0, rates are never summed, units never share an axis).

**Non-goals.** No new chart kinds. No schema change, no migration, no new env, no new route (Batches 1-2; Batch 3 adds no routes either, see §9).
No change to what a figure means or how it is computed. No online map tiles.

## 2. Findings this plan closes

| # | Finding (from the audit) | Closed by |
|---|---|---|
| A | `DashboardCanvas` builds its own frame; `Tile` and `--tile-*`/`--viz-*` tokens are not what dashboards use; `HomeParts` exports a second `Tile` | 39.1, 39.2 |
| B | Charts ignore dark mode (`echarts.init` with no theme; hard-coded `#333 #555 #666 #fff #e0f2fe #10b981 #ef4444` in `chart-render.ts`) | 39.1 |
| C | Title drawn twice (widget header and ECharts title) | 39.3 |
| D | KPI tile: no change badge, no progress, bare `toLocaleString()`, sparkline stretched with `preserveAspectRatio="none"`; metric tiles use arbitrary saturated colour | 39.4 |
| E | Default ECharts styling, animation replays on every `setOption` and on TV refresh | 39.5 |
| F | Fixed 84 px rows, one height per widget on phones, no headline row | 39.6 |
| G | One click meaning (period only), plain-text states, tiny Edit/Remove links and 16 px resize handle, no "view data" | 39.7, 39.2 |
| H | Home draws its own SVG; other surfaces use ECharts | 39.8 |
| (new) | Narrative sentence under figures | 39.9 |
| (new) | Slow connections (field offices) | 39.10 |
| (new) | Nothing stops visual drift | 39.11 |

## 3. SOLID rules for this phase (binding, and how each is enforced)

The repo already enforces architecture by test (`test/architecture-boundaries.test.mjs`: ≤ 300 lines per file, one exported class per file,
domain imports nothing outside itself, application never imports infrastructure/Next, web `features/*/domain` never imports React/Next).
This phase adds the rules below and pins each with a test, so "100% SOLID" is checked, not claimed.

**S: Single responsibility.** Each module has one reason to change.
- `domain/` decides *what* (roles, thresholds, sentences, formats). `presentation/` only draws. `chart-theme` only maps tokens to ECharts options.
  `ChartEngine` only owns the ECharts instance lifecycle. No file mixes two of these.
- A widget view never fetches, formats numbers or picks colours itself; it receives a finished view model.
- Test: the existing ≤ 300 lines / one class per file check is extended to the new folders; a grep test fails any `presentation/**` file that
  imports `Intl`/`toLocaleString` (formatting lives in one place) or contains a hex colour literal.

**O: Open for extension, closed for modification.** New behaviour is a new row in a table, never a new `if`/`switch` branch.
- Widget kinds: a `WIDGET_RENDERERS` registry (`kind → renderer`) replaces the chain of `drawing.map ? … : drawing.metric ? …` ternaries in
  `DashboardCanvas`. A new kind registers a renderer; the canvas is not edited.
- Theme roles, tile states (`TILE_STATES`), change-direction rules (`CHANGE_RULES`), status rules (`KPI_STATUS_RULES`), number formats
  (`NUMBER_FORMATS`), narrative rules (`NARRATIVE_RULES`), cross-filter dimensions (`FILTER_DIMENSIONS`), mobile height per kind
  (`MOBILE_HEIGHT_BY_KIND`) are ordered/exhaustive tables, each with an `assertExhaustive` test, like `DELIVERY_STATE_RULES` and `CHART_KINDS`.

**L: Liskov substitution.** Every implementation of a port is interchangeable behind its contract, proven by a shared contract test.
- `WidgetRenderer` implementations all accept the same `WidgetViewModel` and render the same four states (loading, empty, error, ready); a
  shared contract test (`test/support/widget-renderer-contract.tsx`, same idea as `assignment-source-contract.mjs`) runs against every
  registered renderer.
- `ChartEngine` has two implementations (browser canvas, SVG server render used by exports/visual tests) that must give the same option
  the same description; one contract test runs against both.

**I: Interface segregation.** Small, role-shaped ports; no consumer depends on methods it does not call.
- `ThemeSource` (read tokens), `ChartMount` (init/resize/dispose), `ChartInteractions` (pick/hover events), `NumberFormatter`,
  `NarrativeWriter`, `TileStateResolver` are separate interfaces. A KPI tile depends on `NumberFormatter` and `NarrativeWriter` only,
  not on the chart engine. A static export depends on `ThemeSource` + `ChartMount`, not on `ChartInteractions`.
- No "options bag" props over 6 fields: a component that grows past it is split.

**D: Dependency inversion.** High-level policy never imports a concrete detail.
- Domain (`packages/domain`) defines the interfaces and tables; `apps/web` supplies the ECharts/CSS-variable implementations; the builder in
  `chart-render.ts` talks to **theme roles** (`text`, `muted`, `grid`, `positive`, `negative`, `rampStart`, `rampEnd`, `series[n]`), never to hex.
- Components receive `ThemeSource`, `NumberFormatter` and `ChartMount` through a React context (`DataSurfaceProvider`) with production
  defaults, so tests and the SVG exporter inject their own. No component calls `getComputedStyle`, `echarts.init` or `Intl` directly.
- Test: architecture test fails if `packages/domain` or `features/*/domain` mentions `echarts`, `document`, `window` or a hex colour literal
  outside the token table.

## 4. Target architecture

```
packages/domain/src/contexts/reporting/
  chart-theme-roles.ts      THEME_ROLES (exhaustive), ThemeRoleMap type, no colours here
  chart-render.ts           uses roles only (hex removed)
packages/domain/src/contexts/dashboards/
  kpi.ts                    + change vs previous period, status (KPI_STATUS_RULES, CHANGE_RULES)
  narrative.ts              NARRATIVE_RULES → one grounded sentence (pure, no invented figure)
  widget-heights.ts         MOBILE_HEIGHT_BY_KIND, DEFAULT_HEADLINE_ROW
  cross-filter.ts           FILTER_DIMENSIONS, nextFilter (generalises the period-only rule)
apps/web/src/features/design/domain/
  tokens.ts                 TOKENS + CHART_THEME (light/dark) + pair list for contrast
  number-format.ts          NUMBER_FORMATS (full, compact, percent, currency), one formatter
apps/web/src/features/dashboards/
  application/              view-model builders (pure): widgetViewModel(drawing, ctx)
  presentation/
    DataSurfaceProvider.tsx ThemeSource, NumberFormatter, ChartMount defaults
    chart/ChartEngine.ts    ChartMount implementation (one class: owns instance, resize, dispose)
    chart/echarts-theme.ts  registerTheme from ThemeSource (light + dark)
    widgets/registry.ts     WIDGET_RENDERERS
    widgets/*Renderer.tsx   one per kind, each ≤ 300 lines
    DashboardCanvas.tsx     layout + gestures only
```

## 5. Batches

Each batch is independently shippable (`SCOPE=web` unless noted), has its own tests, and leaves the product working. Use targeted tests per
batch (memory: test only what changed); the full suites run once before deploy.

### Batch 39.0: Baseline (no code change)
- Capture light and dark screenshots of every dashboard template, Home (all variants), Chart Studio and a report with charts, at 1440, 768 and 390 px,
  from the signed-in app (user's own account, never store the password).
- Confirm findings A-E on screen; record anything the code read missed in §11.
- Output: `memorybank/imp/phase39-baseline/` (screenshots + a one-page note). These become the "before" images for 39.11.

### Batch 39.1: One frame and one theme (A, B)
1. **Theme roles (domain, D).** `THEME_ROLES` lists the roles; `chart-render.ts` replaces every hex literal with a role lookup. The builder takes a
   `ThemeRoleMap` argument (default: a neutral light map so the builder stays pure and existing tests keep passing). Per-series user colours
   (`SeriesStyle.color`, `HEX_COLOUR`) are unchanged: they are the person's choice.
2. **Token table (web).** `CHART_THEME` in `tokens.ts` maps each role to a CSS variable per mode; `design-tokens.test.mts` is extended so every role has
   a value in both modes and each text/mark pair passes the existing AA thresholds. The domain `CHART_PALETTES[0]` is derived from `--viz-1..8` (a
   test fails if they differ), so palette and tokens cannot drift.
3. **ECharts theme.** `echarts-theme.ts` builds a registered theme from a `ThemeSource`; `ChartEngine` re-reads the source when the colour scheme or
   `data-theme` changes and calls `setOption` with the new theme (no re-fetch).
4. **Tile everywhere.** `DashboardCanvas` renders each widget through `Tile`. `Tile` gains: a skeleton `loading` body, the ⋯ menu carrying Edit and
   Remove in edit mode (replaces the underlined links), and a `dragHandleProps` slot so moving still works by the title bar. The duplicate `Tile` in
   `HomeParts` is renamed `HomeCard` (its job is different: a Home panel).
5. **Registry (O).** `WIDGET_RENDERERS` replaces the ternary chain; one renderer file per kind (chart, table, kpi, metric, map, text, project-list).
- **Tests.** Contract test over every renderer (4 states, label, no throw on missing drawing); token completeness; palette-equals-tokens;
  arch test (no hex outside tokens, no echarts in domain); `test:tiles` and `test:templates` harnesses still pass.
- **Exit.** Charts readable in dark; no hex in `chart-render.ts` or `presentation/**` (except per-series user colours and the token table).

### Batch 39.2: States and touch targets (A, G)
- `TILE_STATES` stays the single source for loading / empty / error / restricted / ready wording (already in `tile-view.ts`); add `stale`
  ("as of {date}", used by TV refresh failure) as one new row.
- Edit-mode controls move into the ⋯ menu and an on-card toolbar with ≥ 44 px targets on touch (`pointer: coarse`); the resize handle grows to 24 px
  (44 px hit area) and gets an accessible name and keyboard path that already exists (Shift+arrows).
- Tests: harness check that every control has a name; target-size check in the Chromium harness.

### Batch 39.3: Title and subtitle (C)
- The builder stops emitting an ECharts `title` for dashboard draws (`ChartBuild.titleMode: "EMBEDDED" | "EXTERNAL"`; dashboards, tiles and Home
  use `EXTERNAL`; exports and the Studio keep `EMBEDDED` so a downloaded image is self-describing).
- `Tile.subtitle` carries unit and period (one line, from the chart's existing `subtitle`/notes).
- Test: option for `EXTERNAL` has no title; `EMBEDDED` output is byte-identical to today (golden test, protects exports and reports).

### Batch 39.4: KPI and number tiles (D)
- **Domain `kpi.ts`:** add `change` (value, direction, label) against the previous period with a figure, and `status`
  (`ON_TRACK | BEHIND | NO_DATA | NOT_JUDGED`). Rules are tables: `CHANGE_RULES` (higher-is-better / lower-is-better / neutral), `KPI_STATUS_RULES`
  (uses the same scheduled-target and cumulative logic as `entryStoplight`; **no judgement, with a reason, when the comparison is unfair**: rate,
  unconfirmed semantics, no target). A missing previous value gives no change (never 0%).
- **View:** big value in `NUMBER_FORMATS.compact` (1.2M, 12.4k; full value in the tooltip/`title`), unit, change badge (arrow + sign + word, never colour
  alone), progress bar to target (hidden for rates), status chip using `--signal-*`, sparkline with fixed `viewBox` and
  `vector-effect="non-scaling-stroke"` and `preserveAspectRatio="xMidYMid meet"` (no stretch).
- **Metric tiles:** colour stays an option, but the default becomes the neutral card; semantic colour only from status; the six fills remain
  available (AA-checked already) for people who want them.
- **One formatter (S, D):** `NumberFormatter` (web, `number-format.ts`) is the only place numbers become text; locale from `I18nProvider`
  (Arabic digits stay Latin, as in infographics). Remove `toLocaleString()` from presentation (grep test).
- Tests: domain tables (every rule row, boundaries, missing previous, rate, lower-is-better); snapshot of badge text in four languages; `test:tiles`.

### Batch 39.5: Chart styling and motion (E)
- Theme (39.1) carries font family (the app font stack), 12 px tick labels in `muted`, no axis line, thin dashed `grid`, shared tooltip style
  (background `--tile-bg`, border `--tile-border`, 12 px, tabular numbers), legend style.
- **Direct labels:** `LABEL_RULES` table: ≤ 4 series on a line chart → label the last point and hide the legend; otherwise legend.
- **Honesty marks:** target = dashed line labelled "Target"; unverified values = lighter fill with a hatch pattern (`decal`) and the existing
  "N of M not verified yet" note; gaps stay gaps. Marks are never colour-only.
- **Motion policy (one table):** `MOTION = { first: 300 ms, update: 0, tvRefresh: 0, print: 0, reduced: 0 }`; respects `prefers-reduced-motion`.
  `setOption` uses `notMerge` only when the spec changed; a data refresh updates in place (no replay).
- Tests: option snapshots per kind (light/dark); motion table exhaustive; harness check that a refresh does not restart animation.

### Batch 39.6: Layout and responsive (F)
- **Headline row:** each built-in template gets 4-6 KPI widgets first (`DEFAULT_HEADLINE_ROW`, roles not ids, as templates already work). Applying
  with an unchosen role leaves that tile out and names it (existing behaviour).
- **Heights:** `MOBILE_HEIGHT_BY_KIND` (KPI 2 rows, chart 4, map 5, table 4, text auto) replaces `w.h * ROW_PX` below 640 px; desktop is unchanged.
- **Row unit:** `ROW_PX` becomes a prop from `DashboardCanvas` (default 84) so TV mode can scale rows (`rowPx = viewportHeight / rows`) and fill a wall
  display without scrolling.
- **Container-aware charts:** `ChartEngine` reports the box size class (`S | M | L`); the builder's `COMPACT_RULES` table drops legend, subtitle and
  tick density at `S` (data and honesty marks are never dropped).
- Tests: layout functions stay pure and table-tested (`timeline`-style); harness at 1440/768/390.

### Batch 39.7: Interaction (G)
- **Cross-filter on any dimension.** `FILTER_DIMENSIONS` = `PERIOD | PLACE | GROUP | STATUS | INDICATOR`; a chart declares which dimension its labels
  carry (`ChartBuild.pickDimension`); `nextFilter(state, dimension, value)` generalises `nextPeriodFilter` (same value again clears). A widget that
  cannot be filtered by a dimension says so in its ⋯ menu, never silently ignores it. Filters are viewer-side only (the saved dashboard never
  changes; share links apply them in the page, not the stored spec). A visible filter chip row with "Clear" sits above the canvas.
- **Hover link:** `ChartInteractions.hover(dimension, value)` highlights the same value in other charts (event bus in the provider, no widget
  knows another).
- **View data:** every tile's ⋯ menu has "View data" opening a table of exactly the plotted values (from the same resolved dataset, so it cannot
  disagree), with the unverified note and CSV copy. This is also the accessible alternative to the picture.
- Tests: pure `nextFilter` table; harness: click a place filters a chart and a table; hover highlights; Escape clears.

### Batch 39.8: One engine on Home (H)
- Replace `DeliverySparkline`, `PaceBar`, `ResultsBars` (`HomeWidgets.tsx`) with the shared builder plus `Tile`, fed by the same dataset functions.
  Home keeps its server-rendered shell; charts mount lazily through `ChartEngine`.
- Where a hand-drawn bar is simpler and static (e.g. `PaceBar`), keep it but draw it through the shared theme roles and `NumberFormatter`
  (the rule is one *look*, not one library for everything).
- Tests: Home variants render; the architecture test forbids a second chart engine import in `features/dashboard/presentation`.

### Batch 39.9: Narrative sentences (new)
- `narrative.ts`: `NARRATIVE_RULES` (ordered, first match wins) turns a KPI/chart's resolved facts into one sentence, e.g. "78% of target, 12
  points ahead of the time elapsed." Facts only; a figure appears only if it is in the inputs (same grounding stance as the writer rules), no
  forecast, no cause. A rate, an unfair comparison or missing data gives no sentence (not a vague one).
- `NarrativeWriter` is a port; the only implementation is deterministic. **No model call.** (An AI-written option, if ever wanted, is a separate
  opt-in phase under the Ask rules.)
- Copy lives in the typed four-language catalogue; Arabic avoids number agreement (existing convention). Tests: every rule row, a fact-absent
  case per rule, copy-lint.

### Batch 39.10: Field-office performance (new)
- First paint without animation; charts mount when scrolled into view (`IntersectionObserver` inside `ChartEngine`); one `echarts` chunk per page.
- **Low-data mode** (`prefers-reduced-data` or a per-device toggle kept in `localStorage`, defensive): maps and large charts show their "View data"
  table with sparklines instead; nothing is lost, only drawn lighter.
- Budget: dashboard route JS added by this phase ≤ 15 KB gzip (measured in the build); chart chunk stays lazy.
- Tests: harness with throttled network check that the headline row paints before charts.

### Batch 39.11: Visual regression and docs (new)
- A Chromium harness (`pnpm --filter @donordesk/web test:visuals`, not part of `pnpm test`, like the other harnesses) renders every template and
  every widget kind in light and dark at three widths, with fixed data and fixed time, and compares with stored PNGs (threshold set per
  image; updating a baseline is an explicit `--update` run reviewed in the PR).
- Update `AGENTS.md` with the Phase 39 invariants (§8) and `memorybank/Features` dashboards spec; add a short "How to add a widget kind / theme
  role / narrative rule" note (the Open/Closed recipe).

## 6. Dependencies and order

39.0 → 39.1 → {39.2, 39.3} → 39.4 → 39.5 → 39.6 → 39.7 → {39.8, 39.9} → 39.10 → 39.11.
39.11 can start after 39.1 (add baselines as batches land). 39.8 needs 39.1 and 39.5. 39.9 needs 39.4. Do not start 39.7 before 39.3 (the
`EXTERNAL` title mode decides where pick events come from).

## 7. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Removing hex from `chart-render.ts` changes exports/reports | Neutral default `ThemeRoleMap` equals today's colours; golden option tests for `EMBEDDED` kinds before and after; exports keep using it |
| Dark theme changes a chart's meaning (colour pairs) | Contrast pairs for every role in both modes; marks are never colour-only |
| Renderer registry hides a missing kind | `assertExhaustive(WIDGET_RENDERERS, WIDGET_KINDS)` fails the build |
| Cross-filter confuses people | Visible chip row, clear-all, per-widget "does not respond" note; viewer-side only |
| Narrative sentence states something untrue | Rules read only resolved facts; each rule has a "fact absent" test; none for rates or unfair comparisons |
| KPI status reads as a judgement we don't make | Reuses `entryStoplight`'s fairness rules; `NOT_JUDGED` with a reason |
| Scope creep into new chart kinds | Non-goal; new kinds go through `CHART_KINDS` in a different phase |
| Visual tests flaky | Fixed data/time, animation off in harness, per-image thresholds, baselines reviewed |

## 8. Invariants to add to AGENTS.md when built

- **A chart's colours come from theme roles, never hex** (except a person's own series colour); the roles map to tokens in both modes and the palette equals the tokens.
- **Every widget renders through `Tile` and a registered `WidgetRenderer`**; a new kind is a registry row plus a renderer, never a branch in the canvas.
- **Numbers become text in one place** (`NumberFormatter`); presentation never calls `toLocaleString`/`Intl`.
- **Exports keep their embedded title; live surfaces use the external one.**
- **Motion is a table**; a data refresh never replays the intro; reduced motion is respected.
- **A narrative sentence states only resolved facts** and is absent when the comparison is unfair.
- **Filters are viewer-side and name their dimension**; a widget that cannot respond says so.
- **Every chart has "View data"**, built from the same dataset as the picture.

## 9. Deploy

Web only for 39.1-39.11 (`scripts/deploy-fast.sh` with `SCOPE=web`; `SKIP_TYPECHECK=1` only after `pnpm -r typecheck` has just passed on this tree).
Domain changes (`kpi.ts`, `chart-render.ts`, tables) are in `packages/domain`: build contracts → domain → application → infrastructure before
testing (tests run against `dist/`), and ship `SCOPE=both` if the API serves `drawCharts` (it does: `GetDashboardDataHandler`), so the KPI `change`/`status`
fields reach the browser. No migration, no env, no `rls.sql`, no `/ready` change. Batch the batches: one deploy per two or three, not per tweak.

## 10. Definition of done (per batch and for the phase)

- Typecheck, lint, the batch's targeted unit tests and its Chromium harness pass; full suites green once before deploy.
- Architecture test passes with the new rules (§3); no file > 300 lines; one exported class per file.
- Light, dark and 390 px screenshots reviewed against the 39.0 baseline.
- Copy in four languages (typed catalogue); drafts flagged for native review as before.
- AGENTS.md and the feature spec updated; checked in a signed-in browser by a person (this has been missing for earlier phases; do not claim it done without it).

## 11. Open questions

1. Which KPI colour default does the user want: neutral card (recommended) or the current solid fills?
2. Is the "headline row" added to existing dashboards on next open, or only to new ones from templates? (Recommended: new only; offer "Add headline row" to existing.)
3. Low-data mode: automatic from `prefers-reduced-data`, per-device toggle, or both? (Recommended: both.)
4. Do share-link and embed pages get the filter chips? (Recommended: yes, viewer-side, no stored change.)
5. Findings from 39.0 that the code read missed: to be filled in.

## 12. As built (2026-11-03)

### 12.1 Deploys and commits
| Release | What | Notes |
|---|---|---|
| `20261103044136` | Batches 39.0–39.11 and the first fixes, whole working tree, `SCOPE=both` | Built from the uncommitted tree (the user chose to ship the whole tree, including unfinished wizard work); verify green, 1086 s. No migration, no env. |
| `20261103054323` | Toolbar select width cap, every label on small category axes, **instant tile drawing** (`POST /v1/dashboard-preview`), **richer share links** (plan, activity days, results by place and maps; money, budget and project lists still excluded), tile names kept when a tile cannot be drawn | Verify green, 948 s. No migration, no env. |

Commits on `0016-pcw`: `d63e1c2a` (wizard follow-ups, kept apart), `2f3b254e` (dashboards: Phase 39, preview, share links, 75 files), `018152de` (AGENTS.md deploy note). `Temp/` (third-party donor spreadsheets) was deliberately not committed.

### 12.2 What each batch became
| Batch | Result | Where |
|---|---|---|
| 39.0 baseline | Four production pictures (two dashboards, light and dark) and a findings note, taken read-only from the user's Chrome over CDP | `phase39-baseline/` |
| 39.1 frame and theme | Colour roles (`chart-theme-roles.ts`), chart-library theme from tokens (`chart-theme.ts`, `useColorMode`), every widget a `Tile` via `WIDGET_RENDERERS`, `HomeParts` card renamed `HomeCard` | `ariaLabel` added to `Tile` because the harnesses find widgets by `section[aria-label]` |
| 39.2 states and touch | 44 px Edit/Remove/resize on touch | The ⋯ menu was **not** built (harnesses click the visible buttons) |
| 39.3 titles | `splitEmbeddedTitle` drops the in-picture title on tiles; the subtitle is its own line | Reports and exports unchanged |
| 39.4 KPI | `change`, `status`, compact numbers (`number-format.ts`), progress bar, fixed-shape sparkline | Status set is `NO_DATA / NOT_JUDGED / TARGET_MET / IN_PROGRESS`: **no "behind"** (share of target is against the final target) |
| 39.5 chart styling | Theme styling, motion table (`MOTION`: 300 ms first draw, none on update), `forScreen` end labels | Hatched unverified marks **not** built (needs per-point verification in the option) |
| 39.6 layout | Headline row (`headline-row.ts`, **three** rows tall, not two), phone heights per kind (`widget-heights.ts`), wall-display `fitHeight` | Container-aware simplification **not** built |
| 39.7 interaction | View data (`optionToTable`), hover link; the existing period filter and notice kept | Place/group/status cross-filter **not** built: the period filter is applied by the API, other dimensions need an API change |
| 39.8 Home | Bars and line drawn from `--viz-*` / `--tile-*`; no chart library | The plan allowed "one look, not one library" |
| 39.9 narrative | `narrative.ts` (`NARRATIVE_RULES`, key + params, translated on screen) | No model, no forecast |
| 39.10 field offices | `useRenderWhenSeen`, `renderAllCharts` for Print and Download image, `useLowData` | Maps not covered by low-data mode; the 15 KB budget was not measured; no throttled-network test |
| 39.11 regression and docs | `test:visuals` (light/dark × 1300/768/390), AGENTS.md invariants | Baselines were regenerated after the first look found a halo on donut labels and a clipped KPI |

### 12.3 Additions that were not in the plan
- **Instant tile drawing**: `PreviewDashboardChartsHandler`, `POST /v1/dashboard-preview` (`project.view`, in `RULES`; a size outside the grid is fitted like a save), `previewDashboardChartsAction`, and an effect in `DashboardView` that asks for any tile without a drawing and redraws one whose settings changed. Asked for by the user ("a new tile must be generated in edit mode, not after a save").
- **Share-link scope change**: `ShareLinkExtras` (plan, activity days and results by place delegate; budget, finance, project lists and bookmarks do not), `ShareMapReader` (places list, province-level results, planned activities and country, read once on the server and sent as `map.preloaded`), `MapWidget` → `SharedResultsMap` / `SharedActivityMap`, `MapExplorer` gained `staticData` and `loadResults`. This **reverses an earlier rule** ("a share link never carries the plan or maps"); the page text says so.
- **A tile that cannot be drawn keeps its name** (`ownTitle`: chart, map, number tile, KPI or list title).
- **`test:templates` repaired**: it had not built since Phase 35 (`MapWidget` imports server actions the harness did not stub); it now shares the tiles harness stubs.

### 12.4 Verification at the time of writing
- Browser harnesses on the final code: `test:tiles` 18/18, `test:templates` 12/12, `test:visuals` 6/6 against baselines taken the same day; application dashboard tests 9/9; domain tests for the new modules; `apps/api` authorization-coverage 2/2 (the new route has its rule).
- Live, signed-in test tenant: see `../demo/verification-2026-11-03-dashboards.md`.

### 12.5 Answers to the open questions (§11)
1. KPI colour default: the plain card; colour is an option.
2. Headline row on existing dashboards: new dashboards from templates only.
3. Low-data mode: both (the toggle, and the browser's "reduce data" request when nothing is chosen).
4. Filter chips on share links: not built (the public page has no period filter).
5. What the baseline found beyond the code read: the toolbar wrapped badly with a short title, a one-period line chart showed a lone dot on an empty grid, and the dark page's side glow stopped at 900 px. The toolbar was fixed on 2026-11-03; the other two remain.

### 12.6 Still open
Template charts that cannot draw for the chosen indicators (a scatter and a waterfall were created and showed "needs two indicators" / "needs at least 2 values"); the dashboard page's pin button never changes to "Unpin" after pinning (the pin works); a single-slice pie is a solid disc; the ⋯ menu; non-period cross-filtering; hatching; bundle and slow-network checks; native review of the new FR/ES/AR labels; three of four test maps vanished from the test dashboard before the second deploy (not reproduced; adding and saving a map works).
