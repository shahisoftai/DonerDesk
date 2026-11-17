# Phase 61 — Visual freedom: data-first canvas, full chart gallery, free layout, enforced themes (2026-11-17, branch to be cut from `0025-place-tree`)

**Status (2026-11-17): owner agreed all decisions (free placement the only mode for new canvases; a block's own colour is a visible, clearable override; text blocks auto-grow; every upload goes to the organisation's Google Drive). Built in one pass; see "Built" below and the Phase 61 section of AGENTS.md. Deployment and browser verification are recorded at the end of this file.**

Sources of this plan: the owner's review of Dashboards and Infographics against UN / humanitarian products (OCHA, WFP, WHO, UNHCR, iMMAP, ActivityInfo, DevResults). Reference images are in `Temp/` (31 files, `Temp/SOURCES*.txt` give origins; for review only, never shipped, never copied).

## 0. Owner decisions (2026-11-17)
1. A new canvas starts from **the whole project dataset**, not three indicators.
2. **All chart kinds are visible** (Pie, Donut and the rest); none is silently hidden.
3. **Maximum freedom** in block size, block placement, font size and options. No enforced size classes or gutters.
4. **All automatic text is editable and always wraps** (no "…" truncation, no clipping).
5. **Themes (Look and Tone) are kept and, once selected, are enforced on every block.**
6. **Upload** any image, icon or logo onto a canvas.
7. The **flat DevResults style** (full-width coloured title bar per tile, no drop shadow, no card in card) is preferred over ActivityInfo's rounded shadowed cards; it becomes a **frame style** (a theme option), not the only look.

Open for the owner (defaults in bold, changeable before the batch starts):
- Q1 Free placement the only mode for new canvases, grid kept as a snapping aid? **Yes.**
- Q2 A block's own colour becomes a visible, clearable "override"? **Yes.**
- Q3 Text blocks auto-grow and push content; charts keep their frame and warn? **Yes.**

## 1. What exists today (verified in the tree, 2026-11-17)
| Need | Already there | Gap |
|---|---|---|
| Free layout | `FREE` pages, pixel frames, snapping, guides, rotate/stack (`canvas/free-layout.ts`, `pages.ts`, `edit/arrange`) | Dashboard preset and all templates are 12-column GRID; per-kind min/max sizes in `settleBoxes`; FREE not the default |
| Data to build from | `visual-data` catalogue (`DATA_SOURCES`, `validateVisualQuery`, `shapeTable`), `DATA_VISUAL` wells | A new canvas never opens it; templates ask for 3–4 "roles" (`NewVisualForm`) |
| Chart kinds | ~40 in `CHART_KINDS`; Pie/Donut/Treemap/Waffle all `BUILT` | Picker hides a kind when the data shape does not fit it (Pie needs LATEST/STATUS/PLACE/PLAN/BUDGET; default shape is series-by-period) |
| Missing kinds | `POPULATION_PYRAMID` is `PLANNED`; error bars, word cloud left out on purpose | Pyramid unbuilt; no stat-card-with-sparkline, progress bar, dumbbell, small multiples as chart kinds |
| Themes | 60 themes x light/dark/print/high-contrast, frame styles (`canvas/theme-kit`) | A chosen colour or palette beats the theme (`themedOption` keeps it) |
| Text | `title` format capability, `subtitle` | Generated strings not overridable; print painters cut with "…" (`infographics/kit.ts` truncate), screens use `truncate` (e.g. `screens/series.tsx`) |
| Images | `IMAGE`, `SHAPE`, `ICON` blocks; Studio `AssetLibrary` | No upload control in the canvas editor; no organisation media library |

## 2. SOLID, applied (what "100%" means here)
Each rule is a **table or a port, never a branch**, matching this repo's conventions. Each is enforced by a test, not by review.

- **S — one reason to change per module.**
  - `layout/` (geometry only), `text/` (what a string is and how it wraps), `theme/` (resolving colours/fonts/frames), `data-panel/` (what can be dragged), `media/` (files). No module mixes two.
  - Files ≤ 300 lines and ≤ 1 class (existing architecture test); new directories are added to it.
- **O — open for extension, closed for modification.**
  - A new chart kind = a row in `CHART_KINDS` + builder + a `CASES` row (existing rule).
  - A new overridable text = a row in `TEXT_SLOTS` (new, §4.B); no screen or painter changes.
  - A new frame style = a row in `FRAME_STYLES`; a new theme-enforced property = a row in `THEME_ENFORCED`.
  - A new media source = an adapter behind `MediaStore`.
  - Test: add a fixture row for each table and assert nothing else needed editing (`assertExhaustive`).
- **L — substitutable.**
  - GRID and FREE pages implement one `PageLayout` interface (`frameOf(block)`, `place`, `resize`, `snapTargets`); every edit command and painter works with either, proven by a contract test run against both.
  - Every `BlockDefinition` honours the block contract (`resolve` pure, model plain data); a conformance test runs all 40+ kinds through the same suite.
- **I — small interfaces.**
  - Blocks declare capabilities (`FORMAT_CAPABILITIES`, `texts`, `themeRoles`); a block that has no text slot does not implement a text interface.
  - Ports are split: `MediaReader`, `MediaWriter`; `DataFieldCatalogue` (read) vs `DataFieldQuery` (resolve).
- **D — depend on abstractions.**
  - Domain has no React, Next, ECharts, Prisma (architecture test already pins this).
  - Web presentation talks to `DrawerEditorPort`, `MapServices`-style ports, `MediaStore`; adapters are wired only in `composition.ts`.
  - Painters and screens read a `ResolvedTheme` and `ResolvedText`; they never read a theme id or a hex.

## 3. Principles carried over (do not weaken)
- A missing value is never 0; a rate is never summed or "% of target"; unverified figures are noted; honesty checks stay **validator rules**, so freedom of layout and style cannot switch them off.
- Writers (AI) never receive canvas, layout, text-override or theme data.
- Every upload is validated before it reaches an SVG (a crafted logo once injected script; regression-tested): SVG sanitised, type told from bytes, size capped.
- Public pages (share link, embed) never reach a session-only action; check in a fresh signed-out context (`public-pages-no-session` test).
- Reference images are inspiration only: no vendor branding, icons or layouts copied.
- `"use server"` files export only async functions. Never `prisma format`.

## 4. Batches
Order is chosen so each batch ships alone and is reversible. Every batch ends with: targeted tests, typecheck of the changed packages, the relevant browser harness, and the parity row update (`phase48-parity.md`).

### 61.0 — Benchmark and design standard (no product code)
- Measure the 31 reference images and any further ones the owner adds: page sizes/ratios, margins, widget min/max, gap, type sizes, palettes, title-bar styles, header/footer content.
- Output `memorybank/imp/phase61-benchmark.md`: a table of measured ranges and a **defaults** list. Defaults are starting values only; nothing is enforced.
- Output: "reference presets" data (A4/A3/16:9 etc. already exist; add headline-strip and title-bar presets) as rows, not rules.
- Exit: owner signs the defaults list.

### 61.1 — Data panel and a canvas that starts with all data (owner point 2)
- `DataFieldCatalogue` (domain, pure) built from the existing `visual-data` catalogue for a project: indicators (with level, type, unit), periods, places and levels, breakdown dimensions, finance lines, plan, datasets, form records. Grouped, searchable, with kind badges. Permission-aware; a restricted field is absent, not greyed.
- New canvas (blank or from a template) opens with the panel and an empty free page. A template's "roles" become **suggestions** (auto-filled where a word matches, skippable); no role is required.
- Drag a field onto the page: creates the best-fitting visual (`suggestVisualFor(fields)`: one indicator over time = line; one value by place = map; two = comparison; etc.). Dropping onto an existing chart adds the field. Always editable afterward.
- Replaces the "choose roles" gate in `NewVisualForm`; keeps `applyCanvasTemplate` for templates.
- Tests: catalogue completeness per source; honest suggestions (rate never suggested for pie/stack); existing templates still apply.

### 61.2 — Full chart gallery, nothing hidden (owner point 3)
- Picker shows **every** `CHART_KINDS` row grouped by family with a small preview. A kind the current data cannot show is **shown with the reason** and a one-click fix (`suggestedFix`): e.g. Pie over a series becomes "use the latest period by category".
- `reshapeFor(kind, dataset)` (domain, pure): the data shape a kind needs; selecting the kind applies it as one undo step. A reshape that would mislead (rate stacked, mixed units, missing values) is refused with a sentence, never silently done.
- New kinds (each a row + builder + `CASES` row + data-table twin + honesty rule):
  1. **Population pyramid** (age x sex, from LOCATION-free breakdowns recorded one dimension at a time: needs a defined rule for two dimensions; if not recorded, refuses and says why). Decision needed in the batch, may stay `PLANNED` with a documented reason.
  2. **Stat card with sparkline** (reuses KPI + sparkline; not a new engine).
  3. **Progress bar** (value against target; counts only).
  4. **Dumbbell** (two periods or two groups per category).
  5. **Small multiples** (one chart repeated per place/sector via the existing repeater container; no new data path).
  6. **Stacked people-reached by sex and age** (a preset of grouped/stacked bar, not a new kind, if the data supports it).
- Explicitly not built (reasons stay): error bars (no interval recorded), word cloud (no file output).
- Tests: every kind appears in the gallery (walk `CHART_KINDS`); every refused combination has a reason and, where possible, a fix; translated names in four languages.

### 61.3 — Free placement for every block (owner point 3/4 of the second round)
- New canvases default to a FREE page; the Dashboard preset becomes a fluid FREE page (width fluid, height grows with content, blocks in px or % of width).
- `PageLayout` interface; GRID and FREE both implement it; conversion `gridToFree` is lossless; `freeToGrid` is offered only when it can place blocks without overlap, otherwise it says which blocks collide (never moves them silently).
- Move/resize from any edge or corner, arrow-key nudge (Shift = larger), exact X/Y/W/H fields in the Format tab, aspect lock, rotate, z-order, lock, group. All as commands in `CANVAS_COMMANDS` (palette, toolbar, shortcut sheet from one table).
- Snap is a helper, not a rule: grid, guides, block edges, centres; each toggle remembered per device; hold a key to bypass.
- Remove `BlockDefinition` min/max sizes **except** a floor where a block cannot draw (`drawFloor`, one number per kind, with a reason); everything else is free. `settleBoxes` no longer inflates or caps.
- Align and distribute, equal spacing, "fit to content", "fill row".
- Auto-height for text blocks (Q3); charts keep their frame and the Design check warns if content cannot fit.
- Tests: `PageLayout` contract suite run against GRID and FREE; layout pure (no clock/React); golden canvases (59 pinned) re-baselined deliberately with `UPDATE_GOLDEN=1` after review; keyboard and pointer parity harness.

### 61.4 — Font and size freedom
- `TEXT_STYLE` capability: font family (bundled fonts only; `bundled: true` stays pinned to files), size in px/pt with any value in a safe range (6–400), weight, italic, case, letter and line spacing, alignment, colour role. Per block, per text slot.
- Page-level type scale is a **default**, overridable at block and slot level.
- Print path honours the same values (painters must match the screen; parity test).
- Tests: capability row + web section; contrast check uses the resolved colour; RTL/Arabic fonts for `ar`.

### 61.5 — Editable, always-wrapping text (owner point 5)
- `TEXT_SLOTS` (one table per block kind, registered with the definition): headline, subtitle, caption, source line, "as of" line, legend entries, axis titles, KPI label/caption, empty-state text, narrative.
- Every slot resolves to `ResolvedText { value, origin: "AUTO" | "EDITED", auto }`. Auto text is the placeholder; once edited it is stored as an override on the block (`textOverrides[slot]`) and no longer follows data; "Edited" mark and **Reset to automatic** per slot and "Reset all text".
- Figures inside auto text stay generated: an override replaces the whole string, so the Design check warns when an edited string contains a figure not in the block's facts (honesty: no stale number masquerading as live).
- Wrapping: one `wrapText(text, width, font)` in the domain (grapheme-aware, bidi-safe) used by screen and print painters; **no "…" truncation anywhere** (a test greps for `truncate`, `line-clamp`, `…` in canvas screens/painters and fails on new ones; known uses are migrated). Screen uses CSS wrap; print uses the same measurer.
- Overflow policy table (`OVERFLOW_POLICY` per kind): text = grow; chart/map = keep frame, Design check "text does not fit" with the cut-off slot named.
- Tests: long French and Arabic strings, very long indicator names, no clipping at 6 px size; override survives data refresh and theme change.

### 61.6 — Themes enforced everywhere (owner point 5b)
- `THEME_ENFORCED` table: font family, text colour roles, surface/border, frame style, chart palette, spacing defaults, map ramp, KPI accents. A property in the table cannot be set to a value the theme does not own **except** as an explicit override.
- `ResolvedTheme` is the only thing screens, painters and chart options read (no hex, no theme id in a block). `themeChartOption` stops preferring a person's colour silently: a person's colour is stored as `overrides.colour[role]`.
- **Overrides are visible and clearable**: Format tab shows "Differs from theme" per property; page panel lists "N blocks differ from the theme. Reset all / Reset this block". Selecting another theme re-applies to every block; overrides are kept only if the person marks them "keep when theme changes".
- Honesty colours (no-data grey, signal colours) come from the theme's signal roles and cannot be overridden into a meaning change (validator).
- Keeps all 60 themes and the Look and Tone control; custom theme files (`importThemeSpec`) still work.
- "Theme conformance" in the Design check (`lint.ts`): lists deviating blocks, fails nothing by default, can be made a publish gate per profile.
- Tests: for every theme x block kind, resolved output contains only theme roles (property test); changing theme changes every block (screen and print parity); contrast pairs still pass.

### 61.7 — Flat title-bar frame style (owner point 7)
- New frame styles as rows in `FRAME_STYLES`: **FLAT_TITLEBAR** (full-width coloured bar with white title, no shadow, thin gutters; the DevResults look), plus FLAT_PLAIN, and the existing styles unchanged. Bar colour is a theme role (`accent`, `accent2`, `neutral`, `danger`), selectable per block.
- Title bar text is a `TEXT_SLOTS` headline (editable, wraps, auto-grows the bar).
- Painters and screens get it via `ResolvedTheme.frame` only (no new branches).
- Contrast of white-on-bar checked (AA for small text) like the number tiles' colours.

### 61.8 — Upload images, icons and logos (owner point 6)
- `MediaStore` port (read/write split) with an adapter writing to the organisation's own storage (Google Drive per the existing document rule, or the evidence storage; decided in the batch with the owner, **no server-disk fallback** where Drive is the rule).
- Upload paths: Add drawer "Upload", drop a file on the page (creates an IMAGE/ICON/LOGO block at the drop point), and "Replace" on an existing block.
- Accepted: PNG, JPEG, WebP, SVG; type told **from bytes**; size and pixel caps; SVG sanitised (no script, no external references, no `foreignObject`); EXIF stripped; images shrunk in the browser for screen use, original kept for print.
- Organisation media library (logos, flags, cluster icons, photos): tags, search, per-project or organisation scope, alt text **required** (Design check), usage count, safe delete (blocked while a published export uses it; frozen exports keep their own copy).
- Block features: free placement/resize (aspect lock), crop, fit/fill, opacity, background image for a page or block, tint for single-colour icons by theme role.
- Share links and exports include the image through the same sanitised path; public pages read it as a guest with no session.
- Bundled starter icon set (cluster/sector icons) is a data file with licences recorded per file.
- Tests: crafted SVG/PNG corpus (script tags, polyglots, huge dimensions, wrong extension) all refused; public page test; export parity.

### 61.9 — Fewer, better templates (inspiration, not constraint)
- Replace the generated per-sector variants as the main surface with about 8 standard products built to the 61.0 defaults: Situation report (A4 portrait), Flash update (A4), Country brief (A4), Response dashboard (16:9), Cluster 3W (A3 landscape), Results one-pager, Funding coverage, Social card.
- Everything remains a draft in a free canvas; the other variants move under "More templates" (not deleted; parity test requires every id keeps a row).
- Header band standard (logo, title, "as of", scope, source line, disclaimer) and headline strip (3–5 big numbers) as **optional blocks**, not forced.
- Cluster/sector icon set from 61.8 wired in.

### 61.10 — Close-out
- Translation of new strings (fr, es, ar drafts) and typed catalogue tests.
- Support articles (one navigation map, `ux-4000-map.md`), AGENTS.md invariants section, memory-bank index, parity and retirement rows.
- Signed-in browser check on production data (Chart gallery, drag from data panel, free resize, theme switch, text override, image upload), including a **fresh signed-out check of a share link and embed**.

## 5. Test and architecture gates (new)
- `visual-solid.test.mjs` (domain): every registry-like table is exhaustive over its keys (`assertExhaustive`); no `kind ===` / theme-id branches outside registries; `PageLayout` contract for GRID and FREE; block contract suite over all kinds.
- `no-truncation.test.mts` (web) and the same for `infrastructure/src/canvas` painters.
- `theme-enforced.test.mjs`: property test over themes x kinds.
- `media-safety.test.mjs`: hostile file corpus.
- Existing: architecture-boundaries (≤300 lines, ≤1 class, no adapter import from presentation), `visual-parity.test.mts`, canvas golden (re-baselined only on purpose), copy lint, four-language completeness.

## 6. Risks and how they are handled
- **Freedom vs honesty.** Free size and font cannot disable data rules: all honesty rules live in validators and builders, not in layout or style (tested by trying hostile styles).
- **Free layout and print.** Fluid dashboards and fixed A4 pages differ; free pages store px plus an optional "fluid width" flag; print always uses the page preset's size.
- **Auto-grow text pushing content.** Only in text blocks; pushing is opt-in per page ("flow") so absolute-positioned designs stay put.
- **Theme enforcement removing intended colours.** Overrides are first-class and visible; migration keeps existing canvases looking the same by converting every existing own-colour into an explicit override on first open (no visual change, no surprise).
- **Golden churn.** 59 golden canvases and generated templates re-baselined in one reviewed step per batch.
- **Uploads.** Treated as hostile input (see 61.8); no code path puts an uploaded string into SVG without the kit escape helpers.
- **Scope.** 61.0 and 61.1 deliver the biggest visible change; later batches can be reordered or dropped by the owner.

## 7. Deploy notes (expected, to confirm per batch)
- 61.1–61.5, 61.7, 61.9: web + domain; `SCOPE=both` because the domain/exports change.
- 61.6: stored overrides — additive field in the canvas document JSON (no migration); a one-time open-time conversion for existing canvases.
- 61.8: migration for `MediaAsset` (+ RLS per table, `/ready` pair), storage adapter config; no env unless the storage choice needs one.
- Tests: build contracts → domain → application → infrastructure first (package tests run against `dist/`), targeted tests only per batch, full suites once before release.

## 8. Not in this phase
Real-time co-editing of free layouts beyond existing presence, animation redesign, new data sources, a model-written layout, vendor-branded templates, native review of translations (still owed).


## Built (2026-11-17) and where it differs from the plan
- 61.0: the reference images are in `Temp/` with sources; no measured benchmark document was written (the defaults came from the owner's review of the samples: flat title bar, A4/16:9 presets, headline strip as an optional block). Still open.
- 61.1 Data panel (`DataPanel`, `data-fields.ts`), template roles optional, blank page starts with the panel. 61.2 `pickableKinds`/`reshapeForKind`/`ChartKindField`. New kinds: most already existed (progress bar, dumbbell, diverging bar, sparkline in KPI, small multiples via the repeater); population pyramid stays PLANNED.
- 61.3 free pages: domain edit API, `FreePageView`, page size picker, snap toggle, X/Y/W/H handles. No separate numeric X/Y/W/H fields yet (handles and arrow keys only). 61.4 typography capability. 61.5 text overrides + no truncation. 61.6 theme enforcement + conformance panel. 61.7 flat title bar presets. 61.8 Drive-backed pictures. 61.9 eight standard templates first, 154 others under "More templates", a "Look of the blocks" choice.
- Files (PNG/PDF/SVG/PPTX) stay one column of sections; free positions are approximated by reading order and width.

## Deployed and verified (2026-11-17 to 11-18)
Releases `20261117190000`, `…203000`, `…221500`, `…233000`, `20261118010000` (SCOPE=both, no migration). Browser-checked on production (DEMO-14): free drag/resize/typed sizes/nudge/undo, headline override wrapping, theme enforcement, Drive upload and download, data panel to chart and KPI, all eight starters create and export, 69 kinds listed with reshape notes, a signed-out share link showing free positions. Found and fixed by that checking: quoted-font export crash, data-panel props dropped, form indicators not loaded, A4 starter refused, empty bands. Chart value labels (last release) were checked by drawing nine kinds to images, not in the browser. Feature doc: `memorybank/Features/70-Visual-Freedom-Phase-61.md`; support article `basic-information-dashboards-and-infographics.md`.
Test canvases titled "ZZ TEST …" remain on DEMO-14.
