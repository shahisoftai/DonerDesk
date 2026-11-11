# Phase 50 — Power BI-grade dashboards: an always-visible editor, richer blocks, multi-value cards, categorical maps

**DonorDesk Version 3.007** · plan written 2026-11-11 · branch to create: `0020-powerbi-parity` · status: PLAN ONLY

## 0. Why

A partner sent a Power BI nutrition dashboard (Pakistan): a filter bar (Province, District, Funding organisation, Implementing
partner, Donor, Month), two headline totals, accent-bar count cards (districts, donors, partners), a province table, a meetings
column chart, programme-site totals (OTP / SC / SFP), a district map coloured by province, and five province panels of nine
figures each laid around the map. We can draw about two thirds of it today. This phase closes the rest. It also replaces the
editor's narrow inspector with a Power BI-style pair of drawers, so most options are on screen while you edit.

The scope comes from the Microsoft Learn pages for slicers, the new card visual, filled maps, table/matrix, visual interactions,
column charts, report themes and "show items with no data" (read 2026-11-11). Shape map and text-box pages returned 404, so
those parts come from community guides.

**We keep these differences from Power BI on purpose:**
- A missing value is "Not reported", never "(Blank)" and never 0.
- A place name never leaves the tenant for geocoding.
- A share link never carries money.

## 1. What exists today (verified in code 2026-11-11)

| Area | Today | Where |
|---|---|---|
| Blocks | 40 kinds in one registry (KPI, METRIC, BIG_NUMBERS, CHART, MAP, TABLE, REPEATER, FILTER_BAR, GROUP, TABS, SHAPE, ICON, …) | `packages/domain/src/contexts/canvas/blocks/registry.ts` |
| Filters | `FILTER_BAR`; dimensions PERIOD, PROJECT, PLACE, SECTOR, STATUS, DRAFTS; one value each | `canvas/filters.ts` |
| Cross-filter | click sets period/place/group/status/level/indicator; no highlight; every block follows every filter it honours | `canvas/cross-filter.ts` |
| Number tiles | `METRIC` = finance + activity counts only | `dashboards/metric-tile.ts:25-32` |
| Map | RESULTS / ACTIVITIES; shading NONE, REACH, ACTIVITIES_DONE, ACTIVITIES_PLANNED, or results gradient | `dashboards/map-widget.ts` |
| Frames | 10 presets over tokens fill/border/padding/radius/shadow; no one-side border | `canvas/theme-kit/frame-styles.ts` |
| Themes | 60 themes × light/dark/print/high-contrast; no import/export | `canvas/theme-kit/` |
| Places | `facility: boolean` only, no facility type | `places/place.ts:42` |
| Editor | `CanvasWorkspace` + one `Inspector` column fed by `PROP_FIELDS` (per-kind field table) + "Advanced" JSON; `BlockPalette` beneath it | `apps/web/src/features/canvas/presentation/editor/`, `domain/prop-fields.ts` |
| Layout | 12-column grid; FREE pages and anchors exist in the domain (48.6), not yet edited on screen | `canvas/edit/free-layout.ts` |

## 2. Principles for this phase

### 2.1 SOLID, made checkable
- **S (single responsibility)**
  - A domain file does one job: rules, models or layout.
  - A presentation file draws one component.
  - A file is at most 300 lines and holds at most one class or component (the existing architecture test is extended to `features/canvas/presentation/editor/**`).
- **O (open/closed)**
  - Every new capability is a **row in a table** and is never branched on by name: blocks, formatting sections, filter dimensions, metrics, map colour modes, conditional-format kinds, interactions, drawer tabs.
  - The test "no `kind ===` outside registries" now also covers the editor and the new section tables.
- **L (Liskov)**
  - Every block definition satisfies the same `BlockDefinition` contract.
  - A new contract test (`block-contract.test.mjs`) runs every kind through: defaults validate; the fixture resolves to `ready|empty|unavailable`; empty data never yields 0; every formatting section it declares applies and is reversible.
- **I (interface segregation)**
  - A block declares the *capabilities* it supports, e.g. `formats: ["title","frame","numbers","conditional","labels","legend","tooltip","interactions"]`.
  - The editor shows only those sections. No block implements a no-op section.
  - The data reader ports stay narrow: `CountReader`, `FacilityReader`, `PartnerReader`, not one "everything" reader.
- **D (dependency inversion)**
  - Presentation depends on ports (`BlockDataPort`, `EditorStorePort`) and pure domain functions.
  - Adapters are wired only in `composition.ts`.
  - The domain never imports React, ECharts or MapLibre.

### 2.2 Performance budgets (measured, failing the build when exceeded)

| Budget | Target | Check |
|---|---|---|
| Editor first open (signed-in canvas, 20 blocks) | interactive ≤ 2.0 s on desktop, ≤ 3.5 s on Slow 4G | new `test:editor-perf` harness (Chromium, CPU ×4) |
| Selecting a block → edit drawer shows its fields | ≤ 50 ms (no network) | harness timer |
| Typing in a field → block redraws | ≤ 100 ms for styling (local, no fetch); data changes debounced 350 ms (existing preview) | harness |
| Editor JS added by this phase | ≤ 60 KB gzipped on first load; each formatting section is lazy above 8 KB | bundle report in harness |
| Re-renders | changing one block re-renders only that block and the drawer (`React.memo` keyed on block revision; selector-based store) | React Profiler count in harness |
| Filter change on a 30-block page | one dataset request per project per change (batched), ≤ 1 s to redraw on a warm sheet | API test + harness |
| Multi-value card with 9 figures × 6 places (repeater) | one sheet read, not 54 | handler test counts reads |

**How we meet them:**
- **Styling never re-fetches.** Format edits change `block.style`/`props` only. `resolve` caches by `(blockId, dataKey)`, where `dataKey` excludes style.
- **Lazy loading.** Formatting sections load as dynamic chunks per capability. The colour picker and the conditional-format rule editor load only when opened.
- **Virtualised lists.** The block gallery and long field lists (indicator pickers) are virtualised.
- **Batched resolve.** The preview endpoint gets the changed block ids and returns only those (`POST /v1/canvases/preview` gains `onlyBlocks`).
- **Server-side reuse.**
  - Filter options (donors, partners, districts) are read once per page per filter state and cached on the server per `(tenant, project, dataVersion)`.
  - Live versions (Phase 48) invalidate the cache.

### 2.3 Honesty rules carried into every new feature
- Missing is null with a reason. A count of nothing recorded is "Not recorded yet", never 0. A real 0 stays "0".
- "Show items with no data" lists the empty category as **Not reported**, never as a zero bar.
- A rate is never summed, sliced or coloured as "% of target".
- Categorical map colours carry a legend. Colour is never the only signal: the area label or tooltip names the category.
- Cross-highlight dims; it never hides what the person did not ask to hide.

## 3. The editor: two overlay drawers (Batch 50.1)

### 3.1 Layout

```
┌───────────────────────────────────────────────────────────────┬──────────┬────────────────────┐
│ toolbar: undo redo | page tabs | view: fit/100% | Add ▸ | Look  │          │                    │
├───────────────────────────────────────────────────────────────┤  ADD     │  EDIT (selected)   │
│                                                               │  drawer  │ ┌ Build │ Format │ │
│                     canvas (stays full width;                 │ (search, │ │ Data  │ Inter- │ │
│                      drawers overlay, never reflow)            │ gallery, │ │       │ actions│ │
│                                                               │ drag in) │ └───────┴────────┘ │
│                                                               │          │  sections, always  │
│                                                               │          │  expanded by pref  │
└───────────────────────────────────────────────────────────────┴──────────┴────────────────────┘
```

#### Two independent drawers on the end side
- They mirror correctly in Arabic.
- Each is pinnable: **pinned** pushes the canvas narrower, **overlay** floats above it. The default is pinned at ≥1440 px and overlay below.
- Widths can be resized. The width and the pinned state are kept per person (`localStorage`, defensive read, Phase 34 pattern).

#### Add drawer (`AddDrawer`)
- Search box, then blocks grouped by family, read from the registry's `family`. Each block shows a small static preview image.
- **Starter sets** ("Count cards row", "Province panel", "Filter bar for nutrition") insert several blocks at once, as one undo step.
- **Drag a block onto the canvas** (or press Enter, or click "Add") to place it at the drop cell. Drag-to-place works on FREE pages too.
- Recently used blocks come first.

#### Edit drawer (`EditDrawer`)
- It appears when a block is selected; with nothing selected it shows the **page and canvas settings**. Like Power BI, there is always something to edit.
- Four tabs, modelled on Power BI's Build / Format / Analytics plus our own Data:
  1. **Build:** what the block shows. These are the existing `PROP_FIELDS`, regrouped into sections.
  2. **Data:** source, indicators, period range, measure, drafts, "show items with no data", filters this block follows, and a live mini-table of the resolved data.
  3. **Format:** sections from the block's `formats` capabilities (§4).
  4. **Interactions:** for each other block on the page, how this block reacts when that block is clicked: Filter, Highlight or None (§6).
- **Sections** are collapsible. A per-person "Expand all" preference makes most options visible at once.
- A **search box** at the top filters sections and fields by label. Power BI has the same search.
- **Reset** works per field and per section. Fields changed from the default show a dot.
- With several blocks selected, the drawer shows only the **fields they share**. Editing one of them is one undo step for all selected blocks.
- The Advanced JSON editor stays, at the bottom of Build.

#### Keyboard
- `Ctrl/⌘+Shift+A` opens Add and `Ctrl/⌘+Shift+E` opens Edit.
- Esc closes the floating drawer first.
- Focus returns to the selected block.
- Both shortcuts are added to `CANVAS_COMMANDS` (Phase 48), so the palette and shortcut sheet list them.

#### Phone
- Under 640 px the drawers become bottom sheets, with the same components.

### 3.2 SOLID structure (web)

```
features/canvas/editor/
  domain/
    sections.ts           FORMAT_SECTIONS: Record<FormatCapability, SectionSpec>   (pure; label key, fields, applies(block))
    drawer-state.ts       pinned/width/tab/expanded; parse + defaults (pure)
    multi-select-fields.ts sharedFields(blocks) (pure)
    field-search.ts       matchFields(sections, query) (pure)
  ports/
    editor-store.ts       EditorStorePort (select, update, history) — implemented by use-canvas-editor
  presentation/
    AddDrawer.tsx  EditDrawer.tsx  DrawerShell.tsx  SectionView.tsx  FieldWidget.tsx (existing, extended)
    sections/<Capability>Section.tsx   one per capability, lazy
```

- Every field kind (`text`, `number`, `select`, `color`, `slider`, `toggle`, `font`, `alignment`, `spacing`, `rule-list`, `indicator(s)`, `place-level`, `dimension-list`) is one widget registered in `FIELD_WIDGETS`.
- The new widgets: `color` (theme roles first, then a custom colour with a contrast warning), `slider`, `alignment`, `spacing` (four sides plus a link toggle), `font` (bundled fonts only) and `rule-list`.

### 3.3 Tests
- **Unit tests:**
  - every capability has a section;
  - every section field path is valid for each kind that declares the capability;
  - `sharedFields`;
  - `matchFields`;
  - drawer prefs parsing.
- **Harness** (`test:editor-drawers`):
  - open and pin both drawers;
  - drag a block in;
  - edit in each tab;
  - multi-select edit;
  - search;
  - reset;
  - RTL;
  - phone sheet.
- **Performance budgets** (§2.2), checked in the same harness.

## 4. Formatting capabilities: comprehensive editing for every block (Batch 50.2)

Each capability is a row in `FORMAT_CAPABILITIES` (domain, `canvas/format/`). It has a pure `apply(style, model) → presentation hints`, a validator and defaults. The screen painter and the **print painter** read the same hints, so print parity holds.

| Capability | Fields | Applies to |
|---|---|---|
| `title` | show, text, subtitle, font, size, weight, colour role, alignment, divider under title | all |
| `frame` | preset, fill, border (all / **one side: start, end, top, bottom**), border width 1–8, radius, shadow, padding (4 sides) | all |
| `accentBar` | side (start/top/bottom/end), thickness 2–12, colour role or rule | KPI, METRIC, BIG_NUMBERS, MULTI_CARD, TEXT, CALLOUT |
| `numbers` | display units (Auto, none, K, M, B), decimals 0–4, prefix/suffix, thousands separator, negative style, locale digits rule kept | any block with figures |
| `callout` | value size, weight, colour, label position (below/above/start), label style | KPI, METRIC, BIG_NUMBERS, MULTI_CARD |
| `referenceLabels` | show, which secondary figures, layout, divider, colour | KPI, MULTI_CARD |
| `labels` | data labels on/off, position, font, density (auto / all / none) | CHART, MAP |
| `legend` | show, position, title, font | CHART, MAP |
| `axes` | Phase 47 `STYLE_FIELDS`, surfaced here | CHART |
| `colors` | series colours, palette, **conditional colour** (see below) | CHART, MAP, TABLE, KPI, MULTI_CARD |
| `conditional` | rule list: by **gradient** (2–3 stops), **rules** (ordered value bands with ≥, <, between; colour = theme role incl. good/bad/neutral), **field value**, **icons** (arrows, dots, flags), **data bars** | TABLE cells, CHART bars, MAP areas, KPI/MULTI_CARD values |
| `table` | gridlines, header style, row banding, column widths (fit / grow / fixed / per column), hide column on phone, wrap text, totals row (sum / average / min / max / count / distinct count / none, per column; refused on rates) | TABLE, LOCATION_RESULTS, PORTFOLIO_TABLE |
| `tooltip` | fields shown, extra indicators, format | CHART, MAP, KPI |
| `emptyData` | "show items with no data" (lists "Not reported" categories), empty message text | CHART, TABLE, MAP, MULTI_CARD |
| `motion` | Phase 48 motion (existing) | as today |
| `visibility` | hide on phone/print/share link, lock, alt text | all |

#### Rules and theme colours
- Conditional colours resolve to **theme roles** (`good`, `bad`, `neutral`, `accent1..8`), so changing the theme recolours them and contrast is checked per mode. A custom hex is allowed, with the AA warning from Phase 47.
- Conditional formatting **never colours a missing value**; a gap stays grey with "Not reported".
- Rules on a rate compare the rate itself, never a share of target.

## 5. New and upgraded blocks (Batch 50.3)

### 5.1 `MULTI_CARD`: several figures in one card (new kind)
This is the Power BI new card. It draws the province panel and the count-card row.
- **Props:**
  - `items[]` (1–12): each item is `{ source, label?, format? }`. A source is an indicator measure, a **count metric** (§5.2) or a finance/activity metric.
  - `layout`: grid, row or column, with `columns` 1–4.
  - `order` of callout, label and reference.
  - An optional `header` that names the place or project. Inside a repeater, this comes from the repeated item.
- **Model:** `{ items: [{ label, value: number|null, reason?, unverified, unit }] }`.
- **Validation:** at most 12 items; no item twice; a money item needs one currency.
- **Inside `REPEATER` over PLACE:** one sheet read for all places. The repeater passes the place key; `resolveMultiCard(items, sheet, placeKey)` reads the place breakdown. A place with nothing is "Not reported" per item.
- **Print painter:** shares the layout function with the screen.

### 5.2 Count metrics (extend `METRICS`)
Added rows:

| Metric | What it counts |
|---|---|
| `PLACES_REACHED` | places at a chosen admin level with a recorded value in range; "level" is a field |
| `DONORS` | distinct funding sources with project funding |
| `PARTNERS` | distinct implementing partners from the 3W rows / project partners |
| `FACILITIES` | by `facilityType` (§5.3) |
| `ACTIVITIES_BY_TYPE` | if 50.6 chooses activity types |

- Each metric has a reader behind its own narrow port (`CountReader`).
- The counts are deterministic and are counted under the viewer's own access.
- Through a share link: places and facilities are allowed, donors and partners are **not** (they are funding information; this follows `ShareLinkExtras`).

### 5.3 Facility type on places (data model)
- **Schema:** `Place.facilityType` (nullable text). The organisation keeps its own list, `OrganisationFacilityType {key, label, sector?}`, seeded per sector library: nutrition gives OTP, SC, TSFP/SFP; health gives PHC, hospital; education gives school.
- **Rules:** `validatePlace` requires `facility: true` when a type is set. Import and export carry the type as a column (Phase 49 round trip). The Places screen gains a filter and a column for it.
- **Migration** `2026111509000_place_facility_type` (additive), plus RLS for `OrganisationFacilityType`.

### 5.4 `FILTER_BAR` v2 (slicers)
Dimensions become a registry, `FILTER_DIMENSION_DEFS`. Each row says: how it reads its options, whether it is hierarchical, whether it may go through a share link, and which block slots honour it.
- **Added dimensions:**
  - `DONOR` and `FUNDING_SOURCE`: finance register; never on a share link.
  - `PARTNER`: 3W and project partners.
  - `PLACE` becomes **hierarchical**: province → district → … through `resolvePlace` and the places tree.
- **Per filter control:**
  - style: dropdown, list, tiles or buttons;
  - single or multiple selection;
  - "Select all" (which means no filter);
  - search;
  - "show selected first";
  - for periods: a relative choice ("last full month", "last 3 periods", "this year"), computed from today in the project zone.
- **Bar-level options:**
  - "Clear all";
  - an optional "Apply" button for slow pages;
  - filters narrow each other (the district options follow the chosen province);
  - sync across pages, a per-canvas setting so one choice applies to every page.
- **State:** a multi-value filter is a sorted array, kept in the URL (`?f=`) so a view can be shared and bookmarked. It is never saved into the canvas.
- **Performance:** option lists come from one `GET /v1/canvases/:id/filter-options?dims=` per state change, cached per data version.

### 5.5 MAP upgrades
- **`colorBy`:** `VALUE` (today's gradient), `RULES` (bands), `CATEGORY` (one colour per area at a chosen level, or per a recorded category) or `NONE`.
  - `CATEGORY` uses the theme's categorical palette, colour-blind-checked (Phase 48 check), and **always shows a legend**.
- **Area labels:** name, value or both, with collision handling by MapLibre's symbol placement and a minimum zoom.
- **Tooltip fields:** chosen indicators and counts for the area.
- **Click an area** to set the PLACE cross-filter; click again to clear it.
- **Callouts anchored to areas** (`callouts`): for chosen areas, a small card of 1–6 figures (a MULTI_CARD model) is drawn beside the area's label point, with a leader line.
  - **Placement** is a pure function, `placeCallouts(areas, viewBox, cardSize)`: deterministic, avoids overlaps, uses greedy placement on the eight positions around the anchor and falls back to a side column.
  - **Screen:** MapLibre markers plus SVG lines.
  - **Print:** the composer draws the same positions.
  - **Without WebGL** (table mode), the callouts appear as a table. Callouts are limited to 12 per map.

### 5.6 CHART and TABLE upgrades
- **CHART:**
  - colour by rules and by field value, through `conditional`;
  - "show items with no data" (Not reported categories listed, not drawn as 0);
  - data-label density;
  - a reference line from a constant or a target.
- **TABLE:**
  - conditional formatting: gradient, rules, icons, data bars;
  - totals row per column (refused on rates and on unique-people fields);
  - column widths;
  - sticky header;
  - a column hidden on phones;
  - copying a cell or a selection.

### 5.7 Free placement over a map
The FREE page editing from Phase 48.6 comes on screen:
- drag;
- a 4 px snap;
- smart guides;
- z-order;
- grouping;
- locking.

This lets text boxes, shapes and cards sit over a map, as in the screenshot. Callouts (§5.5) are the data-bound alternative and are recommended.

## 6. Interactions (Batch 50.4)
- **Per-block, per-source rules:** `Canvas.interactions: { [sourceBlockId]: { [targetBlockId]: "FILTER" | "HIGHLIGHT" | "NONE" } }`.
  - The default is FILTER, as today.
  - The pure rule `effectOf(source, target, canvas)` applies them.
  - They are edited in the Edit drawer's Interactions tab, or through an "Edit interactions" mode where icons appear on each block (Power BI style).
- **Cross-highlight:** the target keeps every point and dims those outside the selection to 25% opacity. Charts use ECharts `emphasis`/`blur` with no re-fetch.
  - Maps and line charts cannot highlight, so their option says "Filter or None" only, as in Power BI.
- **Drill:** an option for whether drilling filters the whole page.
- **Performance:** a highlight is client-only (no request). A filter batches one preview request for every affected block.

## 7. Themes (Batch 50.5)
- **Import and export** of a canvas theme as JSON (`ThemeSpec`): colours, roles, `good/bad/neutral`, fonts (bundled only), frame defaults.
  - `validateThemeSpec` rejects unknown keys and a contrast below AA (it proposes `fitToSurface` fixes).
  - Organisation themes are stored in `OrganisationTheme` (RLS; `org.manage`).
- **Semantic roles** `good`, `bad`, `neutral` are added to every built-in theme, with light and dark values checked.
- Per-block formatting **survives a theme change**, and a "Reset to theme" action exists per block and per page.

## 8. Data decision (Batch 50.6, needs the owner)
**Meetings, and similar "counts of things done".** Two options:
1. **(A) Record them as an indicator.** This works today; we ship guidance and a starter template.
2. **(B) Add `ActivityUpdate.activityType`.** Organisation-defined types; a migration; the activity form gains a type picker; `ACTIVITIES_BY_TYPE` counts by place and period.

The recommendation is **A now and B later**: B touches the activity form, the import and the offline pack.

## 9. Batches, order, deploy

| Batch | Content | Migration | Ships |
|---|---|---|---|
| 50.0 | Contract test for all blocks, capability declarations on every kind, perf harness and budgets (baseline numbers recorded first) | none | — |
| 50.1 | Add / Edit drawers, sections, field widgets, search, multi-select, phone sheets, RTL | none | web |
| 50.2 | Formatting capabilities (§4) incl. accent bar, one-side borders, numbers, conditional formatting, emptyData, print parity | none | both |
| 50.3a | MULTI_CARD + count metrics (`PLACES_REACHED`, `DONORS`, `PARTNERS`) + repeater pass-through | none | both |
| 50.3b | Facility types | `place_facility_type` + RLS | both |
| 50.3c | FILTER_BAR v2 (dimension registry, hierarchy, multi-select, relative periods, URL state, filter-options endpoint) | none | both |
| 50.3d | MAP colorBy / labels / tooltips / click-to-filter / anchored callouts (screen + print) | none | both |
| 50.3e | CHART/TABLE upgrades, free placement on screen | none | both |
| 50.4 | Interactions (filter / highlight / none), edit-interactions mode | none (stored in `docJson`) | both |
| 50.5 | Theme import/export, semantic roles, organisation themes | `organisation_theme` + RLS | both |
| 50.6 | Meetings guidance (A); optional activity types (B) after owner decision | (B only) | both |
| 50.7 | Acceptance: rebuild the Pakistan dashboard as a starter template ("Nutrition sites by province") on a demo project; golden canvas; four-language copy (drafts); docs; AGENTS.md section | none | both |

**Deploy rules:**
- Follow AGENTS.md: migrations before code, RLS per table with `relrowsecurity` checked, and `/ready` pairs for every new column.
- `deploy-fast.sh` with the smallest scope; batch 50.1 and 50.2 into one release.

## 10. Tests per batch
- **Domain (`node --test`):**
  - the block contract;
  - each capability's apply/validate/reversibility;
  - conditional rules (gaps never coloured, rates never shared);
  - `resolveMultiCard` (gap vs 0; one read);
  - the count metrics (access, share-link exclusion);
  - the filter dimension registry (hierarchy narrowing, relative periods, URL round trip);
  - `placeCallouts` (deterministic, no overlap, fallback column);
  - `effectOf`;
  - `validateThemeSpec`.
- **Print parity:** for every new capability, the painter output equals the screen hints for the fixtures (extends `canvas-print-parity.test.mjs`); golden canvases refreshed deliberately.
- **Architecture:**
  - no kind/capability/dimension named outside registries;
  - file size;
  - presentation never imports adapters;
  - editor sections are lazy.
- **Harnesses:**
  - `test:editor-drawers`;
  - `test:editor-perf` (budgets);
  - `test:filters`;
  - `test:map-callouts`;
  - `test:pakistan-template`, which is the acceptance test: the rebuilt dashboard with every element of the original present.
- **API:**
  - filter-options and preview `onlyBlocks` (in `RULES`, authorization-coverage test);
  - share-link exclusion of donors and partners.

## 11. Element-by-element acceptance (the screenshot)

| Original element | Phase 50 equivalent |
|---|---|
| Six slicers | FILTER_BAR v2: PLACE (province→district), FUNDING_SOURCE, PARTNER, DONOR, PERIOD (month), dropdown style |
| TotalChild / TotalWomen | KPI ×2, numbers = none (full digits), callout size XL, purple top+bottom accent (frame one-side borders) |
| 106 districts / 8 donors / 19 IPs | MULTI_CARD column, items PLACES_REACHED(level 2), DONORS, PARTNERS, accentBar start, yellow role |
| Data Sharing by Provinces | TABLE (LOCATION_RESULTS), outline frame |
| Meetings by Province | CHART bar, split by place, show items with no data |
| OTP / SC / SFP | MULTI_CARD of FACILITIES by type, accentBar start |
| District map coloured by province | MAP colorBy CATEGORY at admin 1, district outlines, legend |
| Province panels with leader lines | MAP callouts (MULTI_CARD model, 9 items) — or REPEATER of MULTI_CARD on a FREE page |
| "(Blank)" | "Not reported", by design |

## 12. Not in this phase
- Power BI DAX-like formulas beyond formula indicators.
- Q&A visuals (Ask exists).
- Paginated reports.
- Bookmarks of filter state beyond the `?f=` URL.
- An online basemap.
- Native-reviewed translations: the copy ships as drafts, as before.
