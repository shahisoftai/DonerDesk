# Phase 47 — ECharts parity and full chart editing (plan, 2026-11-09)

Status: BUILT 2026-11-09 (phases 0–5; see §9 for what was built, what changed from this plan and what is not built). Owner decisions (2026-11-09): start with the style model (Phase 0); build **all** the new chart kinds, not a shortlist; this plan is the written record.
Reason: charts, tiles and UI read as "too basic". The renderer draws good-but-plain ECharts defaults, and a person can change only title, axes range/scale, legend position, labels, colours and annotations. Most of what ECharts can do is either hardcoded in `chart-render.ts` or not reachable.
Sources read: `chart-spec-v2.ts`, `chart-render.ts` (survey and the cartesian builder), `chart-theme-roles.ts`, `features/design/domain/chart-theme.ts`, the Studio's control keys, `infrastructure/src/exports/chart-png-renderer.ts` and `infographics/blocks-core.ts` (server-side SVG), Phase 34.1 / 39 / 45 invariants in `AGENTS.md`.

---

## 1. Audit — what exists

**Pipeline.** `ChartSpecV2` + a dataset → `buildChart` → one ECharts option. The browser draws that option (`chart-theme.ts` registers a theme per mode, `retheme` swaps role colours for dark). Exports draw the **same option** server-side (`echarts.init(null, null, { ssr: true })` → `renderToSVGString` → resvg PNG / svg-to-pdfkit PDF). ECharts 6.1 in web and infrastructure. 40 kinds (`CHART_KINDS`).

**Editable today (complete list):** title, subtitle, caption, alt text, size preset; axes x/y/y2: title, min, max, log, reversed, gridlines; legend position; labels: show, format, number format; palette or explicit colours; per series: name, colour, kind override, line style, labels, hide, axis; annotations: line, band, note (max 12).

**Hardcoded in the builder (not editable):**
| Group | Examples |
|---|---|
| Marks | bar width (lollipop 3 px, gantt 18, progress 12–30), bar gap, corner radius (none), line width, smoothing (sparkline only), symbol shape and size, area opacity (0.25), pie radius (`68%`, `45–70%`), ring `62–80%`, gauge width 14 |
| Layout | grid margins (`left 56, right 24, top 56, bottom 40/52`), axis name gap (38/42), title position (centre) |
| Text | title 14 px, label sizes, label position and rotation, axis label size/rotation/interval, font weight |
| Legend and tooltip | legend icon, orientation, font, paging; tooltip content, format, trigger, style |
| Effects | gradients, shadows, decals/patterns, hover emphasis and blur, selected state, animation easing and duration |
| Data helpers | min/max/average marks, trend line, data zoom, brush, gauge colour bands, visual-map ranges and colours, map region styling |

**Kinds against ECharts.** Covered: bar family, line/step/area, pie/donut/treemap/sunburst/waffle, histogram, box plot, scatter/bubble, heatmap, funnel/waterfall/sankey, gauge/ring/progress/KPI, radar, gantt, calendar heatmap, choropleth/graduated symbols, combo, tables. PLANNED but not built: population pyramid. Not present: nightingale rose, radial (polar) bar, pictorial bar, area range (band), error bars, parallel coordinates, tree, graph/network, theme river, liquid fill, word cloud, multi-ring gauge variants, bar race (no). Out of scope on purpose: 3D (`echarts-gl`), candlestick, the `custom` series.

**Constraints every change must respect**
1. **Print parity.** Style flows through the same option, so PDF/PNG equal the screen. Export fonts are only the bundled Liberation Sans and Noto Sans Arabic: a font option is a choice among those, nothing else.
2. **Honesty rules stay validator rules.** Bars start at zero, a rate is never stacked or sliced, a gap is `null` (never 0), different units never share a raw axis, a log axis excludes zero. A style option that could break one gets a validator rule (e.g. a "min" on a bar axis is already refused; an "area fills below baseline" option must obey the same).
3. **Dark mode.** Defaults use theme roles, so `retheme` works. A person's own colours are left alone, as today. A preset is a palette *plus* both role maps, each checked for contrast in both modes.
4. **A spec holds choices, never data.** Every option is a small serialisable field (no functions). Contracts already pass unknown spec keys through (`.passthrough()` in `dashboards.ts` and `SavedChartSpecSchema`), so a new `style` block is stored without a migration.
5. **Old charts do not change.** A spec with no `style` builds an identical option (pinned by test). `applyChartStyle` returns its input untouched when there is nothing to apply.
6. **"Import everything" means map, not paste.** ECharts' examples and themes are Apache 2.0 (attribution in `/maps/sources`-style credits page). Pasting examples would bypass rule 2, so each example's *look* becomes an option or a preset, and each *chart type* becomes a `CHART_KINDS` row.

---

## 2. Design

### 2.1 One style model
`packages/domain/src/contexts/reporting/chart-style.ts` (pure; no ECharts import):
- `ChartStyle` — the optional block on `ChartSpecV2.style`, grouped by element (§3).
- `STYLE_DEFAULTS` — one table of what the builder draws today, per element. It is documentation, the Studio's "default" placeholder, and the reset target. A test pins each default against the option the builder actually produces, so the table cannot drift.
- `validateChartStyle(style, kind)` — ranges, enums, per-kind applicability and honesty rules; problems carry `code` + `path` like `validateChartSpec`, which calls it.
- `applyChartStyle(option, spec)` — a pure post-process over the built option: it patches only what the style names, skips helper series (silent, transparent, track series) and returns the same object when `style` is absent. Chosen over threading `style` through all 20 builders: the builders stay as they are, the change is reviewable in one file, and "no style = unchanged" is provable.

### 2.2 Presets
`CHART_STYLE_PRESETS`: a named bundle = palette + role maps (light and dark) + a `ChartStyle`. Imported from ECharts' stock themes (vintage, macarons, infographic, shine, roma, dark, chalk, essos, walden, westeros, wonderland, purple-passion) and from the product's own design tokens ("DonorDesk", the default). A preset is applied as an edit (undoable) and writes ordinary spec fields, so exports and dashboards need nothing special. A test checks every preset against the contrast pairs.

### 2.3 Where the options appear
Studio "Style" tab, an accordion by element (Title, Plot area, Axes, Series/marks, Labels, Legend, Tooltip, Effects, Annotations, Animation). Clicking a part of the chart selects that element and opens its group (ECharts events). Every group has "Reset to default". Controls show the default as placeholder. Dashboards and canvas blocks read the same spec, so the same options apply there (the widget "Edit" panel links to the Studio for style).

---

## 3. Element inventory (what "extensive" means)

Each row is a field group on `ChartStyle`; the right column says how it is guarded.

| Element | Options | Guard |
|---|---|---|
| **Text** | font family (Sans / Arabic-capable, bundled only), base size, per-element size and weight, colour role | enum + range; colour from role or `#rrggbb` |
| **Title / subtitle / caption** | alignment, size, weight, position (top/bottom), wrap width | range |
| **Plot area / grid** | margins (4 sides), background, border, corner radius, inner padding | range; containLabel kept |
| **Axes** (x, y, y2) | label size, rotation, interval, truncate/wrap, number format, prefix/suffix, tick count, tick/line visibility, axis line style, split-line style, split area bands, name position, name gap, inverse (exists), min/max/log (exist) | bar axis rules unchanged; log rules unchanged |
| **Bars** | width, max width, gap, category gap, corner radius, border, gradient, pattern, background track, stack on/off (where honest), sort | additive-only and zero-baseline rules stay |
| **Lines and areas** | width, smooth (with monotone guard), step, symbol shape/size/visible, area opacity, gradient fill, null handling (gap/connect — connect only when the user says so and the chart says it in a note), end labels | a gap is never drawn as 0 |
| **Pie / donut / rose** | inner and outer radius, start angle, direction, rose type, label position and lines, min angle, "Other" grouping, centre text | rate rule unchanged |
| **Scatter / bubble** | symbol, size range, opacity, regression line (from `echarts-stat`), jitter off | ≥ 3 points |
| **Gauge / progress** | arc width, start/end angle, colour bands (thresholds), pointer, tick and split style, detail format | bands must be ascending and inside the range |
| **Heatmap / calendar / visual map** | colour ramp (sequential, diverging, from the palette), min/max, piecewise vs continuous, legend position, cell border | diverging needs a stated midpoint |
| **Treemap / sunburst / sankey / funnel / radar** | label rules, levels, node width/gap, orientation, align, curve, area fill, shape | per-kind table |
| **Labels** | size, weight, position, rotation, overlap handling, rich text (bold value + muted unit), show max/min only | position enum per kind |
| **Legend** | position (exists), orientation, icon, size, gap, wrap vs scroll, selectable, align | enum |
| **Tooltip** | trigger (item/axis), what it shows (name, value, share, unit, "verified" flag), number format, order, pointer line/shadow, confine | the "not verified" note is always shown when unverified |
| **Data helpers** | mark min / max / average / latest (mark point and mark line), reference lines (exist), target band (exist), threshold colours | marks never drawn on a gap |
| **Effects** | shadow, opacity, hover emphasis (focus: series/self/none), blur of others, selected state, decal patterns (colour-blind safe), rounded caps | decals recommended when ≥ 5 series (Design check) |
| **Interaction (screen only)** | data zoom (slider, inside), brush, toolbox (save image, data view), roam | never in exports; off in print |
| **Animation (screen only)** | on/off, duration, easing, stagger | `prefers-reduced-motion` always wins |
| **Accessibility** | alt text (exists), decals, high-contrast mode, keyboard focus order, "View data" table (exists) | lint rule: chart without alt text fails the Design check (exists for canvas) |
| **Background and frame** | transparent / surface / tinted, border, shadow, corner radius, padding, watermark/source line | role colours |
| **Maps** | region fill, border, hover, no-data colour, label rules, graduated-symbol size/opacity, projection (bundled only) | missing region = grey, never 0 |

Not offered, on purpose: anything that cuts a bar axis, plots a gap as 0, stacks or slices a rate, puts two units on one raw axis, or loads a font/asset the exporter lacks.

---

## 4. New chart kinds (all of them)

Each is a `CHART_KINDS` row (shapes, additiveOnly, startsAtZero, minPoints), a builder case, a fixture and a `CASES` row in `chart-render.test.mjs` (the test fails until each drawable kind has one). Order is by value to this product, but all ship.

| Kind | Data shape | Honest-use rule |
|---|---|---|
| Pictorial bar (icons for people, houses, litres) | LATEST, TARGET_TRIPLE | counts only; one icon = a stated number; partial icon shown as partial |
| Nightingale rose | LATEST, STATUS, PLACES | counts only (additive); radius encodes value, not angle |
| Radial (polar) bar | LATEST, SERIES_BY_PERIOD | zero baseline |
| Area range (band) | SERIES_BY_PERIOD | needs low/high from recorded min/max or target range; never invented |
| Error bars / interval | SERIES_BY_PERIOD, LATEST | only recorded intervals; no fabricated uncertainty |
| Parallel coordinates | LATEST (several indicators per place) | each axis its own unit, stated |
| Tree | logframe (goal → outcome → output → activity) | structure only; no values invented |
| Graph / network | logframe links, partner links | structure only |
| Theme river | SERIES_BY_PERIOD | additive only |
| Liquid fill | TARGET_TRIPLE | percent of target only; cap at 100% with a note |
| Word cloud | feedback / complaint categories (`echarts-wordcloud`) | counts shown on hover; never from free text without a count |
| Population pyramid | breakdown by age and sex | already designed (PLANNED); build it |
| Multi-ring gauge, grade/speed gauge variants | TARGET_TRIPLE | bands ascending |
| Candlestick, 3D | — | not built (no fit) |

New npm packages: `echarts-stat` (regression), `echarts-wordcloud`, `echarts-liquidfill` — all Apache 2.0 / BSD; each must work in `ssr` mode, or the kind is screen-only and says so (as a repeater is). Decided per kind when built; a kind that cannot export is a failure of the kind, not a reason to loosen parity.

---

## 5. Phases

| Phase | Work | Exit check |
|---|---|---|
| **0 — Style model** | `chart-style.ts`: `ChartStyle`, `STYLE_DEFAULTS`, `validateChartStyle`, `applyChartStyle`; `style?` on `ChartSpecV2`; `validateChartSpec` calls the style validator; `buildChart` applies style on every ECharts path (series, extra shapes, maps); subpath export. First groups wired: title, grid, bars, lines, areas, pie radii, labels size, axis labels, legend, animation. | `chart-render`, `chart-spec-v2`, `canvas-print-parity`, `export-charts` unchanged and green; new `chart-style.test.mjs` |
| **1 — Presets** | Import ECharts' stock themes + the product theme as `CHART_STYLE_PRESETS`; role maps for both modes; credits entry. | Every preset passes contrast; a preset applied then reset equals the original spec |
| **2 — Element options** | Fill in every row of §3, group by group (text → axes → marks per kind → labels → legend → tooltip → data helpers → effects → maps), each with validator rules and a table-driven test row. | `chart-style.test.mjs` walks `STYLE_FIELDS` (one row per option: default, range, kinds it applies to, honesty rule) |
| **3 — New kinds** | The §4 list, one `CHART_KINDS` row each + builder + fixtures. | Every BUILT kind has a drawing case; export test draws each to SVG |
| **4 — Studio UI** | "Style" tab, click-to-select element, per-element reset, presets, default placeholders, live preview, plain-language names (typed catalogue, four languages). | `test:studio` extended; copy lint passes |
| **5 — Everywhere + parity** | Dashboards, canvas blocks, infographic charts and reports read `style`; `forScreen` keeps working; export parity and SVG determinism; fonts limited to bundled; spec version note; AGENTS.md invariants; Design-check rules (decals for many series, contrast). | `test:visuals` baselines reviewed; `canvas-print-parity` green; `test:studio`, `test:tiles` green |
| **6 — Polish pass** | Re-theme tiles and tooltips from the reference products (separate visual spec); motion; empty and loading states. | Reviewed pictures, light and dark, three widths |

Each phase ends with a targeted test run (build contracts → domain → application → infrastructure first; package tests run against `dist/`), not a full-suite run, until the pre-deploy gate.

---

## 6. Risks and answers

| Risk | Answer |
|---|---|
| A style option misleads (cut axis, 0 for a gap) | Validator rule per option; "Not offered" list in §3; every row of `STYLE_FIELDS` carries its honesty rule |
| Screen and PDF diverge | One option; export test draws every kind with a style applied and compares to the screen's SVG |
| Fonts differ in export | Font choice limited to the two bundled families |
| Presets fail dark mode | Contrast test on every preset in both modes |
| `chart-render.ts` is already 860 lines | Style lives in its own files (≤ 300 lines, one export group each); the builder only gains one call per return path |
| Extra packages break SSR | Each tested in `ssr` mode before the kind is BUILT; otherwise screen-only and named as such |
| Too many controls overwhelm | Accordion by element, defaults shown as placeholders, "Reset", presets first; advanced groups collapsed |
| Old saved charts | No `style` = identical option (tested); `style` is optional and additive; no migration |

## 7. Not in this phase
3D, candlestick, the `custom` series, user-uploaded fonts, user-written ECharts option JSON (an "advanced JSON" box would bypass every honesty rule), online map tiles.

## 8. Deploy
No migration, no env. `SCOPE=both` (the API draws dashboard charts). Ship after Phase 5; Phases 0–4 can ship as they land because an absent `style` changes nothing.

## 9. Progress log
- 2026-11-09: audit done; plan written.
- 2026-11-09: **Phase 0 built** (`chart-style.ts`, `chart-style.test.mjs`, 12 tests). Deviation from §2.1: style is applied as a pass over the finished option (`applyChartStyle`, called from `buildChart`), not threaded through each builder; a spec with no `style` is unchanged (tested). First groups: title, grid, bars, lines, area, pie radii, label size, axis labels, legend, animation. Not yet covered by a test: maps and the plan/budget/calendar shapes (they pass through the same call).
- 2026-11-09: **Phase 1 built** (`chart-presets.ts`, generated `chart-presets-data.ts`, `scripts/build-chart-presets.mjs`, `chart-presets.test.mjs`, 8 tests). 36 stock themes read from `echarts@6.1.0/theme` plus the DonorDesk look = 37 presets (`preset:<id>` palette ids). Colours are fitted to 3:1 on the light and the dark surface (`fitToSurface`: same hue, mixed toward black/white; order and count kept; a colour that already reads is never changed). Themes made for a dark surface are flagged (`forDark`). `applyPreset` swaps palette and style, keeps a person's series colours and drops style groups the chart cannot use. Unknown `paletteId` is now a validation problem. Not done: the credit line is exported (`CHART_PRESET_CREDIT`) but not yet shown on the credits page; a dark screen asking for `presetColors(id, "dark")` is Phase 5.
- 2026-11-09: **Phase 2 built.** The style model is one table, `STYLE_FIELDS` (`chart-style-fields.ts`, ~110 options in 25 groups; scope per option; label, range or choices, default, help). The validator (`chart-style.ts`), the Studio's controls and the defaults test all read it. `chart-style-apply.ts` + `chart-style-series.ts` apply it (title, frame, plot area, axes x/y with prefix/suffix/rotation/gridlines/bands, bars incl. gradient/track/outline, lines incl. symbols/round caps, area fade, pie incl. rose/start angle/slice gap, points, labels incl. position, legend, hover box, marked values (highest/lowest/average/latest, never on stacks), shadows/opacity/hover/decals, gauge bands, heat ramps and steps, radar, funnel, flow, map, animation incl. easing and stagger). `applyScreenInteraction` adds zoom bars and the picture button for screens only (a built chart never carries them). `chart-style-fields.test.mjs` walks the table: every option is valid in its own scope, changes the drawing on at least one chart type in that scope, is refused out of range, and is named "not for this chart type" outside its scope.
- 2026-11-09: **Phase 3 built** (`chart-render-kinds.ts`, `chart-icons.ts`, `chart-kinds.test.mjs`, `chart-kinds-export.test.mjs`): pictorial bar, rose, radial bar, range band, range bars, parallel coordinates, tree, network, stream (theme river), fill gauge, progress rings. **Changed from §4:** *error bars* are not built (they need ECharts' `custom` series, out of scope, and no interval is recorded anywhere); *word cloud* is not built (the extension needs a browser canvas, so it cannot be drawn in a file and would break print parity); *population pyramid* stays planned (a breakdown is recorded one dimension at a time, not as age by sex). *Liquid fill* became the **fill gauge** (a shape filled to the share of target, built from `pictorialBar` clipping, no extra package). *Area range* and *range bars* draw the span between **two indicators the person chooses**, never an invented interval. *Graph* became the **network** of donors and categories (fixed circular layout: a picture is the same every time).
- 2026-11-09: **Phase 4 built**: Studio "Look and feel" panel (`StylePanel.tsx`, `StyleControl.tsx`, `GaugeBands.tsx`, `studio-style.ts`): theme picker with swatches, one control per option grouped by part of the chart, per-group reset, count badge, "Reset all style", click a part of the picture (series, title, axes) to open its group. Studio downloads (SVG and PNG) are drawn from the option without zoom bars. Strings in four languages (drafts); the *names of individual options* are English only, read from the table.
- 2026-11-09: **Phase 5 built (partly)**: dashboards and canvas blocks carry the chart's `paletteId` and screen-only `interaction` in the drawing (`ChartDrawing`), draw a theme's dark colours on a dark screen (`optionForMode`), and add zoom bars/toolbox on screen only. **Known limits:** (1) an option that needs a function (axis prefix/suffix, staggered animation, hover text) works wherever the chart is built in the browser (the Studio) but is lost where the option travels as JSON (dashboards through the API, files): the same limit the builder's own number formatting already has there; (2) infographics and files take the document's brand palette (`themedOption` drops series colours), so a theme's colours and gradients do not reach them; (3) no Design-check rule for patterns on many series yet; (4) table-derived charts in reports use the older chart config and carry no style.
- 2026-11-09: **Three own presets added** (DonorDesk Modern, Print, Quiet): 40 presets in all. **Deployed to production** `releaseId=20261109111114` (`SCOPE=both`, the host declined the build for low memory so it built locally, 926 s; verify green; no migration, no env). Verified after deploy without a login: the 97 chart domain tests and the 5 server-side render tests ran green on the host against the deployed `dist`; the web build holds the new panel; the dashboard handler returns `paletteId`; public pages answer; Studio and Maps routes redirect to sign-in. **Not done: a signed-in browser check on production** (no credentials were available); the same screens passed 41 checks in the Chromium harness (`pnpm --filter @donordesk/web test:studio`) and the dashboard tiles harness (18) against the real components. Left: the Design-check rule for patterns on many series, Phase 6 (a visual polish pass of tiles and tooltips), translations of individual option names, themes in infographic files (they take the brand palette).
- 2026-11-09 (second pass, same day, signed in on production as the owner, project DEMO-16): production walk found the eleven new types draw on real data (10 first time; AREA_RANGE drew on replay: the first refusal came from a racing script). Fixes made from it: a pictorial bar's small value was invisible (now one fainter icon for a part of a unit), the average line's label ran off the plot (`insideEndTop`), changing the chart type left a style that could not be saved (`pruneStyleForKind`). Closed the still-open list: Design-check rules, option names in fr/es/ar, a theme's or chosen palette's colours reach files, no style option writes a function, tooltip/tile polish (soft hover box, tile hover lift, easing).
- 2026-11-09 (third release `20261109125815`, verified in a signed-in browser on production, DEMO-16): all eleven new types draw on real data; themes and options change the picture and its downloaded file; click-to-edit opens the group; fr/es/ar panels (Arabic reads right to left); dark mode with a dark theme; gauge bands (visible after the progress arc fix) and the fill gauge (readable text); a saved chart added to "Education: access and learning" **now appears on the dashboard** (found while testing: it had gone only to the old dashboard record). Test data removed: the saved chart and the dashboard block. **Left behind, cannot be removed from the product:** two "ZZ TEST p47 fill gauge" widgets on the *old* dashboard record `7398dc9d-…` (hidden since it was converted to a canvas); direct database access was refused, so they remain until someone removes them. Also changed the dashboard tile test stub (`loadAdmin1File`).
