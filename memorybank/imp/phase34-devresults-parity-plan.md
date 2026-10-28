# Phase 34 — Dashboards, Chart Studio, Entry Sheet, Maps Studio and the rest of the DevResults surface

Status: **PARTLY BUILT AND DEPLOYED.** Batches 34.0–34.3 and the first slices of 34.4, 34.5 and 34.7 (bookmarks) are in production (`releaseId=20261028133938`, 2026-10-28, branch `0015-compitition`, commits `47dcbe6f` and `d1cdf9e3`). The rest is listed under "What is left". Version: DonorDesk 3.007 (the next product version is set when the owner decides). **Nothing here has yet been tried by a person in the signed-in production app.**
## Status and decisions (updated 2026-10-28, after the deploy)

Owner decisions: (1) basemap = offline by default, opt-in online tiles per organisation (§5.0); (2) the tour images were read (see "Screens seen"); (3) **templates are always drafts** and fully editable (built-ins are copied, never edited in place); (4) **boundaries: bundle all possible** (every country and every licensed level; the licence check is still open); (5) **currency rates are manual**.

### What is implemented (in production)

| Batch | What exists | Where it lives / how it was checked |
|---|---|---|
| 34.0 Foundations | Chart spec v2 and the kind catalogue (`CHART_KINDS`), editable sector templates, design tokens (contrast-tested, muted text fixed to 5.0:1), `Tile`, the dataset layer (`resolveDataset`, `POST /v1/datasets/resolve`), 4-language tile copy | `chart-spec-v2.ts`, `dataset-query.ts`, `features/design`, `components/ui/Tile.tsx` |
| 34.1 Chart Studio | `/projects/:id/charts`: **43 drawable kinds** (bars of every kind, lines, areas, pies, donuts, funnel, waterfall, gauge, radar, treemap, sunburst, waffle, scatter, histogram, box plot, heatmap, bullet, lollipop, tables, finance charts, Gantt, calendar heatmap, Sankey, results by place, graduated-symbol map, country choropleth), full styling (series colour/label/axis, axes, annotations, legend, number format, size presets), refusal-with-a-sentence honesty rules, undo/redo, PNG/SVG/CSV export, **saved charts with the last 10 versions**, add to a dashboard, names in 4 languages | `chart-render.ts` (`buildChart`), `ChartStudio.tsx`; harness `test:studio` (21 checks) |
| 34.2 Entry Sheet | Spreadsheet-style entry inside the period inputs page (Sheet / Form toggle): frozen Code and Indicator columns, typed columns that match an Excel paste, drag fill, undo (100 steps), hide/reorder/resize columns, density and zoom, find and go-to, filters, sort, search, earlier-period columns, by-place table, **autosave** (drafts only) and an **offline queue**, Excel export/import (data validation, hidden-id matching), value history from the audit trail, comments, verify selected, not-applicable answers, locked-cell rules | `entry-sheet.ts` (36 tests), `EntrySheet.tsx`; harness `test:sheet` (16 checks) |
| 34.3 Dashboards v2 and templates | Dashboards hold **any Studio chart, tables, text blocks and saved-report tables**; **6 starter sector templates** (editable drafts) with a gallery, an applying flow that maps roles to the project's indicators, and a full template editor (copy, details, roles, add/update/move/resize/remove charts); organisation templates persisted; extra data sources for charts (plan, activity days, budget, places; never through share links); **tabs** (up to 8, named per chart), **full-screen TV mode** (refreshes every 60 s), **print**, **one-project filter** | `dashboard.ts`, `dashboard-templates.ts`, `sector-templates.ts`, `DashboardView.tsx`, `DashboardTabs.tsx`; harness `test:templates` (14 checks) |
| 34.4 Maps (first slice) | `/projects/:id/maps`: the Studio in map mode on results by place (graduated symbols, choropleth on the bundled world map, rankings, tables), saved map views, PNG, **KML and GeoJSON downloads** of pinned places, unpinned places named | `ChartStudio mode="map"`, `places-export.ts` |
| 34.5 Indicator pages and reports | Indicator page **Views** (against target, over time, by place, **by group pie**, table); the **saved report builder** `/projects/:id/report-builder` (sentence query; rows indicator or period; **breakdown by sex / age group / disability / location / other group**; Run, CSV, save personal or shared; **add a report to a dashboard as a table**); the data sheet now carries each value's split by group; 4 languages | `report-query.ts`, `breakdown-chart.ts`, `ReportBuilder.tsx`, `IndicatorViews.tsx`; harness `test:report-builder` (7 checks) |
| 34.7 (part) Bookmarks | A star on every portal page, a Bookmarks panel on the Homes; per person, in-app addresses only, 30 at most | `bookmark.ts`, `BookmarkButton.tsx`, `BookmarksPanel.tsx` |

Migrations (all additive, applied on production): `20261030090000_saved_charts`, `20261030100000_dashboard_templates`, `20261030110000_bookmarks`, `20261030120000_saved_reports`; RLS forced on `SavedChart`, `DashboardTemplate`, `Bookmark`, `SavedReport`. Tests at deploy: domain 1054, application 863, infrastructure 471, web unit 547 of 548 (the one failure, `pricing-catalog-parity`, is older than this phase), three browser harnesses green.

### What is left (nothing below exists yet)

| Area | Left to build |
|---|---|
| Home and dashboards | pin a dashboard or chart as a **Home tile**; a **viewer-side period filter** and **cross-filtering** (both need a new data call that redraws charts for a chosen period or selection); more widget kinds (KPI tile with sparkline, filters panel); sections inside a tab; **publishing to partners** and the admin switch (34.9) |
| 34.4 Maps Studio proper | layer panel (several layers, order, opacity), **time slider** (needs period-aware place results), small multiples by period, KML / GeoJSON / shapefile **upload** as layers, photo layer, place panel with the projects working there, print layout, **boundaries for every country and level** (licence check first), online-tile opt-in setting, choropleth below country level, a browser-harness check of the downloads |
| 34.5 | **linked forms** (join collection data on a common field), subtotal rows and logframe-level grouping in reports, a place breakdown in reports, a separate Documents tab (the indicator page already lists its evidence), notes written by the domain translated |
| 34.6 Finance | register of expenses and disbursements, multi-currency with a manual dated rate table, advances, cost per result, IATI export (completes 33.11) |
| 34.7 Workspace | project notes wall with followers, document library with folders, photo gallery, calendar feed (iCal), merged swimlane timeline |
| 34.8 | fill-from-project document templates, sign-off line on checklists |
| 34.9 | partner home, partner-built dashboards and the admin switch that disables them |
| 34.10 | accessibility audit (keyboard and screen reader on the new screens), performance budgets, right-to-left check of the new screens, native review of the fr/es/ar drafts |
| 34.2 leftovers | places × periods layout, editing earlier periods inside the sheet, per-column history and comments |
| Other | population pyramid (needs age × sex values the data sheet lacks); server-side PNG so the donor-template Word export can carry charts; translating the English sentences the builder and validator write; translating the admin template screens |
| Owner actions | check the new screens in the signed-in production app (list in AGENTS.md "Deployed 2026-10-28: Phase 34"); boundary licence decision; native reviewers for the translations |

Owner decisions: (1) basemap = offline by default, opt-in online tiles per organisation (§5.0); (2) the tour images were read (see "Screens seen"); (3) **templates are always drafts** and must be fully editable (no sign-off gate, no "reviewed" label; built-ins are copied, never edited in place); (4) **Boundaries: we need all possible.** Bundle administrative boundaries for every country at every level a licensed source provides (admin 0 to admin 3 or deeper where available), not a priority list; organisation uploads stay for anything finer or newer. (5) **Currency rates are manual** (an administrator's dated rate table; no rate feed).
**Boundary work this implies (inside 34.4, started with a spike):** source and licence check first (candidates: geoBoundaries, GADM, Natural Earth, OCHA COD-AB for humanitarian contexts; some are non-commercial or need attribution, so the licence decides what may ship); a generator like `build-site-geo.mjs` that simplifies and splits by country so only a country's file is loaded (never in a first bundle); a name and code index for place resolution (`resolvePlace`) and the auto-assign of a point to its admin path; version and attribution recorded per file (shown in the map footer and the exports); bundle size budget and lazy load per country; disputed borders shown with the source's own labelling, never "corrected". Unknown or missing levels fall back to the level above and say so.

Source: DevResults public tour (`devresults.com/tour`) and help centre (partner dashboards, "view data", MultiMatrix), read as **text only**.
The tour video (Vimeo 107087838, "DevResults Trailer (Silent)") could not be opened (bot check) and has no audio, so **no screen was seen**.
Every "visual" statement below is our own design, inferred from their wording. Before 34.3 and 34.4 start, capture their `/demo` screens or
screenshots and compare layouts (owner action, see §12).

Builds on, and does not repeat: Phase 33 (places, results by place, formulas, period submission, forms, offline, dashboards v1, Ask,
languages), Phase 30 (maps), Phase 31/32 (infographics). Where 33.x lists something "not built", it is picked up here.

Rules carried over from AGENTS.md (they bind every batch): a missing value is never `0`; rates are never summed or judged as % of target;
different units never share a raw axis; one rule per concept (a chart, a layout, a permission is decided in one place); pure domain code,
no clock, table-tested; every route in `RULES`; every tenant model in `rls.sql`; copy through the copy lint and the i18n catalogue
(`t()`/`tp()`, never concatenated); writers never receive workflow or presentation state; hidden, not disabled; all geo data bundled.

## Screens seen (the 16 images on the tour page, read 2026-10-28)

What the screens show, and what we take from each (our look stays our own):
- **Results**: a left **tree of the results framework** (outcome → output) that filters the page; a header strip of plain counts ("12 activities · $68,092 awarded · 10 indicators"); a **grid of indicator cards**, each with an orange code badge, the title, and a small line chart where the **target is a faint ghost line behind the bold actual line**; a card with nothing says "No data". → 34.5 indicator cards and 34.3 results dashboard; keep "No data" honest.
- **Indicator page**: tabs Definition · Targets & Data · Reports · Documents, a star to bookmark, a "show results for (all activities)" filter, and on Reports a **map, a trend chart and a pivot table side by side**, the map and chart sharing hover popups. → 34.5.
- **Report builder**: a **sentence-style query** ("Showing results from [any period] for [any activity] implemented by [any organization]; Display [actual #] by [Region & Prefecture] broken down by [Year]"), a **Run Report** button, nested row groups with bold subtotal rows, male/female sub-columns with totals, Download. → the saved-report builder in 34.5 (a sentence reads easier than a form of dropdowns; we keep it).
- **Maps**: small-multiple maps **one per year, side by side**, graduated symbols above and choropleth below, grey for no data; a map **on a street basemap** with a popup listing the projects working at that place (name and organisation), circle colour for state; hover popups naming place and value. → 34.4: small multiples by period are added to the layer list; the place popup lists projects.
- **Locations (admin)**: a geography tree on the left, a table (name, parent path, facility flag, latitude, longitude), **New / Export / Import / Choose columns**, an import dialog. → we already have most of this in Places (33.1); add the tree filter, the column chooser and a facility flag in 34.4.
- **Budget**: coloured category swatches, line table (amount, USD, expenses, remaining), a pie "Budget Breakdown", a stacked bar "Budget Status" (budget, expenses to date, disbursed to date, **time elapsed** as the last bar), an expenses-and-disbursements ledger with a running balance and an age column. → 34.6; the "time elapsed" bar is the juxtaposition we already prefer to a score.
- **Timeline**: grouped lanes per grant with a **range overview strip** on top, WEEK / MONTH / YEAR / ALL zoom, a **"today" marker**, milestone dots (done = green tick, upcoming = grey), a popover for the next milestone with its assignee. → 34.7.
- **Notes**: a post box, threaded replies, and a **"these users will be notified of comments"** panel listing who follows the project. → 34.7 (show the followers; our digest rule stays).
- Not opened but listed: calendar, checklists, documents, photo, forms, exchange (currency rates), admin divisions.
Their look is dense, grey chrome with one orange accent and white cards; a **single accent colour** on code badges and highlights is worth keeping in our tokens (34.0 design pass), in our own colour.

---

## 0. What the user asked for (the brief)

1. A **home / project dashboard in the DevResults style** (snapshot at a glance), with **ready-made dashboard templates per sector**.
2. A **comprehensive chart feature**: every kind of chart (not only bars) and **full editing tools**.
3. **Data entry like a spreadsheet**, with columns and rows visible.
4. **Maps as a full tool**, with all the DevResults map features.
5. **All other features extracted from DevResults** (§1 lists them; each is placed in a batch).

## 1. DevResults feature inventory → our decision

| # | DevResults feature | DonorDesk today | Decision | Batch |
|---|---|---|---|---|
| 1 | Dashboard: map of projects, funds obligated/awarded/disbursed, results visuals, upcoming tasks, overdue-milestone and over-budget alerts, breakdown by sector/status/mechanism, bookmarks | Overview per project, Portfolio page, no single home snapshot | Build **Home snapshot** + alert strip + breakdown tiles + bookmarks | 34.3 |
| 2 | Dashboards assembled from many visualizations, unlimited per user, pushed by a dashboard manager | Dashboards v1 (chart widgets only, 3 scopes, share link) | Extend: widget kinds, templates, publish to roles/partners | 34.3 |
| 3 | Four views per indicator: targets-vs-actuals graph, matrix query, map (choropleth / graduated), pie | Data Center charts and pivot; no per-indicator page | **Indicator page** with those four tabs | 34.5 |
| 4 | MultiMatrix: matrix across several indicators, save as report or dashboard | Data Center pivot, one sheet | **Saved reports** (multi-indicator query) | 34.5 |
| 5 | Spreadsheet-style entry and Excel import/export of results | `IndicatorEntryGrid` (form-like rows) | **Entry Sheet** (true grid) | 34.2 |
| 6 | Custom map layers, KML export, bulk place import, auto admin-boundary assignment | One boundary layer per org; places import (33.1) | **Maps Studio** | 34.4 |
| 7 | Geotagged photo map (click place → thumbnails) | Evidence has files, no photo map | Photo layer | 34.4 |
| 8 | Disaggregation, targets per programme/project, saved/shared reports | Done (breakdowns, group targets) | Keep; surface in Sheet and Chart Studio | 34.1/34.2 |
| 9 | Shared calendars, notes wall emailed to staff, photo gallery, document library with folders | Comments on items; calendar on Overview; evidence | **Project workspace**: notes feed, library, gallery, iCal | 34.7 |
| 10 | Timeline: milestones, deliverables, reporting periods, events | Plan timeline, calendar, deadlines (separate) | One **swimlane timeline** | 34.7 |
| 11 | Budget lines, expenses/disbursements register, burn rate, outstanding advances, multi-funder, multi-currency with auto conversion | Budget view exists; 33.11 not started | **Finance** | 34.6 |
| 12 | Checklists with milestone due dates, "complete & approved" sign-off | Checklist + attestations | Sign-off presentation; milestone link | 34.8 |
| 13 | Standard forms library that fills from project data | None | **Document templates** (fill from project) | 34.8 |
| 14 | Partner portal: only their reporting periods; tiles filtered to their projects; admin can disable partner-built dashboards | External partners (named projects, allow-list) | Partner home + published dashboards + admin switch | 34.9 |
| 15 | Data tables linked on a common field so indicators read from them | Collection forms feed indicators; no linking | Linked forms (join on a field) | 34.5 |

We **refuse**: one fixed geographic level per indicator (already refused, D2); changing a disaggregation deleting data (D3); a map that
requires every result to have a place (we keep "project-wide" results valid, they appear in the Map's "not placed" list).

---

## 2. Foundations (Batch 34.0) — build once, used by everything after

### 2.1 Visual design system pass
DevResults reads as a *dense, tile-based, data-first* product. We adopt the idea, not the look.
- **Design tokens** (colour, spacing, radius, elevation, type scale) in one file; light/dark; WCAG AA contrast checked by a unit test per token pair.
- **Tile primitive** (`Tile`): title, optional subtitle, "as of" stamp, menu (⋯), loading / empty / error / "from a project you cannot see" states. Every dashboard widget, home tile and map panel is a `Tile`; the empty state says why ("Not yet reported"), never a placeholder figure.
- **Density setting** per user (comfortable / compact), used by the Entry Sheet and tables.
- **Chart theme** (§3.6) and **map theme** (§5.6) derive from the tokens, so charts and maps follow dark mode and the organisation's brand colour.
- Domain-free: a web `features/*/domain` module stays pure (architecture test).

### 2.2 Chart Spec v2 (the contract used by Charts, Dashboards, Reports, Infographics)
`DataChartSpec` (today: template, indicatorIds, measure, type, period range, showTarget, title, colors) becomes a **versioned, extensible spec**:
`ChartSpecV2 { version: 2, dataset, marks[], encodings, axes[], scales, legend, labels, annotations[], theme, size, sort, filter, topN, a11y }`.
- `migrateChartSpec(v1) → v2` is pure and lossless; stored v1 specs (dashboards, section charts, infographics) are read through it and never rewritten until the user saves.
- One validator `validateChartSpec` (same function in browser, API and exporter). A spec that cannot be drawn honestly (a pie of baseline/target/achievement, a line joining unrelated indicators, a radar of raw counts) is refused with a reason — the existing `CHART_BINDING_TYPES` rule generalises to a table `CHART_KIND_RULES` (kind → required data shape → allowed measures).
- One renderer path: `optionForType` generalises to `optionForSpec`; the browser renders the option, the export renders the same option (as today). Deterministic output, regression-tested by bytes.

### 2.3 Dataset layer
Charts, Sheet, Reports and Maps all read **one** `DataSheet` shape (Data Center). Add the missing dimensions so every chart/map can slice by them without a second query: `placeId` path, disaggregation group, funder, sector, project, status, finance line. A "dataset" is a *query spec* (`DatasetQuery`: scope, indicators, periods, places, groups, measure) resolved by one handler, `ResolveDatasetHandler`, with one sheet read per project. No chart stores data.

### 2.4 Sector pack registry
`SECTORS` (domain, table): WASH, Health (incl. MNCH), Nutrition, Education, Food security and livelihoods, Agriculture, Protection and GBV, Shelter and CCCM, Governance and civil society, Economic development, Climate and resilience, Humanitarian response (multi-sector). Each pack = indicator **roles** + dashboard templates + chart presets + map presets + report blueprint hints. Roles, not ids (see §4.2).

### 2.5 Tests/gates for 34.0
Token contrast test; spec migration table (every v1 stored in fixtures → v2 → draw equals v1 draw); architecture test; copy lint on new copy tables.

---

## 3. Batch 34.1 — Chart Studio (every kind of chart, full editing)

### 3.1 Chart kinds (all drawn deterministically from the dataset; each has a rule row in `CHART_KIND_RULES`)
| Family | Kinds | Honest-use rule (refused otherwise) |
|---|---|---|
| Comparison | Bar (vertical), horizontal bar, grouped bar, stacked bar, 100% stacked, lollipop, bullet (value vs target), dot plot | stacked only for additive types; rates never stacked |
| Trend | Line, multi-line, step line, area, stacked area, sparkline, slope chart, calendar heatmap | gaps shown as gaps (`null`), never 0 |
| Part-to-whole | Pie, donut, treemap, sunburst, waffle, nested donut | one period/one additive measure; ≤ 8 slices then "Other" |
| Distribution | Histogram, box plot, density strip, population pyramid (age × sex) | needs ≥ 5 values; pyramid needs age and sex groups |
| Relationship | Scatter, bubble, correlation heatmap | two measures of comparable scope; no trend line unless n ≥ 8 |
| Matrix | Heatmap (indicator × period, place × period, place × indicator), conditional-format table | colour scale legend always shown |
| Flow/stage | Funnel (reached → completed → retained), waterfall (baseline → change → result; budget bridge), sankey (activity → output → outcome, funder → line → place) | funnel steps must be nested counts |
| Progress | Gauge, progress ring, progress bar, stoplight, KPI number with delta, speedometer-free "target met / below" chip | rate never read as % of target |
| Schedule | Gantt (plan items), milestone strip, burn-up/burn-down | plan dates are plain days |
| Geographic | Choropleth, graduated symbols, pie-on-map, heat points, flow lines | defined in §5; embeddable as a chart widget |
| Combination | Bar + line, bar + area, dual-axis | a second axis is allowed **only** when explicitly set, labelled with its unit, and different units never share an axis silently (existing rule) |
| Small multiples | Any of the above repeated per place / per project / per group | same scales option (shared vs free) with a note |
| Table | Pivot table, scorecard table with in-cell bars, sparklines, stoplights | missing = "Not measured" |
| Text | KPI strip, callout, annotation block | figures must come from the dataset (no typed numbers) |

### 3.2 The editing surface (a three-pane studio: data · canvas · properties)
- **Data pane**: choose dataset (project / programme / portfolio / place subset), indicators (multi-select with search), measure (period, cumulative, baseline, target, % of target, variance, change vs previous), disaggregation (split / stack / facet by group), periods range with "last N", places (level + selection), filters (status VERIFIED only toggle, funder, sector), sort, top-N + "Other", calculated series (sum of selected, ratio — only for additive/ratio-safe types), and a **data table view** (the numbers behind the chart, with unverified/draft marked).
- **Canvas**: live preview, undo/redo (50 steps), zoom, drag legend/labels, click-to-select any element (series, axis, title, annotation) to edit it in the properties pane, keyboard-operable.
- **Properties pane**:
  - *Chart*: kind switcher (only kinds the data supports are enabled; a disabled kind says why), title, subtitle, caption/source line (auto "Source: DonorDesk, as of <date>").
  - *Series*: colour, per-series kind (combo), line style/width, markers, area opacity, stack group, order, show/hide, rename legend label, data labels (value / % / name), number format (thousands, decimals, compact, currency, %), null handling (gap / connect / hide).
  - *Axes*: title, min/max (auto/manual), tick interval, log scale (counts only, no zeros), reversed, gridlines, tick label rotation, secondary axis, units shown, "start at zero" guard for bars (bars always start at 0; a toggle is refused).
  - *Reference & annotations*: target line, baseline line, average, custom line, shaded band (e.g. reporting window), text note anchored to a point, arrow, event marker (from plan milestones), threshold colouring (stoplight bands).
  - *Legend & layout*: position, hide, wrap, size presets (square, wide, tall, A4 half/full, slide 16:9), padding, background, border, fonts (bundled families only), text size scale.
  - *Palette & theme*: existing palettes + colour-blind safe default + sequential/diverging ramps + per-category colour pinning (a group keeps its colour on every chart in the project: `colorForGroup(projectId, group)`), brand colour from the organisation.
  - *Interaction*: tooltips (content template), click-through (to the indicator page, the record, the place), hover highlight, legend toggle.
  - *Accessibility*: alt text (auto-generated sentence from the data, editable), pattern fills for colour-blind/print, data table always available, keyboard focus order, reduced-motion.
- **Presets**: "Sector chart presets" (e.g. WASH: people with access over time by service level; MNCH: ANC cascade funnel; Education: attendance heatmap by school × month). A preset fills the data pane by **role**.
- **Save / reuse**: save to the project's chart library (named, owner, shared within project), duplicate, version history (last 10 specs), "Use in": dashboard, report section, infographic, Map panel.
- **Export**: PNG (1×/2×/4×), SVG, PDF (vector), CSV/XLSX of the data behind it, copy to clipboard, embed code (shared dashboard widget only). The exported image carries source and "as of" lines by default.

### 3.3 Honesty rules (domain, one place: `chart-honesty.ts`)
Bars start at zero; a missing value is a gap; a rate is never summed (so never stacked or pie-sliced) nor labelled "% of target"; unverified/draft values are plotted only if the user turns **Include draft values** on (existing user decision), with the note and badge; roll-up reports chart cumulative against project target; different units → % of target with a note, or two explicit axes; truncated axes on line charts are allowed but flagged "Axis does not start at zero". Each rule has a table-test row.

### 3.4 Reports and infographics
- A Chart Studio chart inserted into a report is the existing `CHART` artifact (`dataBinding: "DATA_CENTER"`, snapshot, stale on read). The spec field grows to v2; `isDataCenterChart` unchanged. Table-derived charts stay as they are (rebuilt on every text save).
- The Python donor-template Word export still draws no charts (AGENTS: known gap). **Include in 34.1**: the worker receives the rendered PNG for each chart artifact (the API renders, the worker embeds) — closes the gap.
- Writers never receive chart specs or edit state.

### 3.5 Deliverables
Domain: `chart-spec-v2.ts`, `chart-kind-rules.ts`, `chart-honesty.ts`, `chart-presets.ts`, builders per family (pure). Application: `SaveChartHandler`, `ListChartsHandler`, `RenderChartHandler`. Infrastructure: `ChartRepository`, renderer extended in `renderChartPngCached` (SVG path via the same option). Web: `ChartStudio` (route `/projects/:id/charts`, modal from Data Center/Dashboards/Reports), `FieldWell`, `PropertiesPane`, `AnnotationLayer`.
Tests: per-kind builder tables (≥ 3 cases each incl. all-null, one point, negative values), honesty rules, spec migration, byte-stable render, a11y (alt text sentence), copy lint, `rls-coverage` for `Chart`.
Deploy: additive migration (`Chart` table, RLS), `/ready` pair `Chart.specJson`.

### 3.6 Chart theme
Derived from tokens (§2.1); dark-mode safe; fonts bundled (Liberation Sans, Noto Sans Arabic already shipped); RTL charts flip back geography (existing `flipBack`) but mirror axes for Arabic.

---

## 4. Batch 34.3 — Dashboards v2, sector templates, Home snapshot

### 4.1 Widget kinds (Dashboards v1 has chart widgets only)
`CHART` (any Chart Studio spec) · `KPI` (big number + delta + target chip) · `KPI_STRIP` · `TABLE` (scorecard / pivot) · `MAP` (a Maps Studio view) · `TEXT` (markdown subset, same as report text) · `IMAGE` (organisation asset) · `TASKS` (my / project work) · `ALERTS` · `CALENDAR` (next 30 days) · `TIMELINE` (mini Gantt) · `PHOTOS` (geotagged gallery strip) · `FINANCE` (obligated/awarded/disbursed, burn rate) · `STATUS` (period data status by project) · `BREAKDOWN` (projects by sector/status/funder, click filters the list) · `LEADERBOARD` (top/bottom places or indicators, no rank score) · `ASK` (Ask DonorDesk box, only when enabled). Every kind has a data function (pure) and an empty state.

### 4.2 Sector templates (the user's explicit request) — always drafts, fully editable
A template is `{ id, sector, title, audience, roles[], layout[], presets[] }`. **A template references indicator roles, never ids.**
- `IndicatorRole` = `{ key, label, hint, types[], unit?, required }`. Example WASH: `people_basic_water`, `people_basic_sanitation`, `handwashing_facilities`, `water_points_functional`, `schools_wash_facilities`, `hygiene_kits_distributed`, `odf_communities`.
- **Applying a template** opens a mapping step: each role suggests matching project indicators (code/name/keyword match, existing `suggest` style), the person confirms or leaves a role unmapped. Unmapped required role → the tile shows "Choose an indicator" and is excluded from exports; the template still works with incomplete data (rule from infographics). Mapping is stored on the dashboard (`roleMapJson`); re-applying never overwrites edits.
- **Audience variants** for each sector: *Programme manager* (progress, pace, late items), *Donor view* (results vs targets, reach, finance bars; no workflow state), *Field/Partner view* (my reporting periods, my places), *Executive* (portfolio KPIs + map).
- Template catalogue (v1, ≥ 2 each, all with a Home-style KPI row, 4–8 charts, a map, a table):

| Sector | Template | Key tiles (roles) |
|---|---|---|
| WASH | Access & hygiene | People with basic water/sanitation over time; water points functional % (rate, not summed) ; handwashing facilities by place (choropleth); schools with WASH; hygiene promotion reach by sex/age; ODF communities funnel (triggered → verified → declared) |
| WASH | Infrastructure delivery | Gantt of construction items; budget vs spend by line; water points by type (treemap); functionality heatmap place × month |
| Health / MNCH | Maternal & newborn cascade | ANC1→ANC4 funnel; skilled birth attendance rate by place; PNC; facilities with essential supplies; stock-outs heatmap facility × month |
| Health | Disease & service use | OPD consultations trend (stacked by service); referral flow (sankey); immunisation coverage by antigen (bullet vs target); catchment map |
| Nutrition | Screening & treatment | Screened (MUAC) vs admitted (waterfall); SAM/MAM recovery, default, death rates (stoplight); admissions by place; supplies |
| Education | Access & learning | Enrolment by sex × grade (pyramid); attendance heatmap school × month; teachers trained; learning outcome pre/post (slope) |
| Food security & livelihoods | Assistance & outcomes | Households assisted (cash/in-kind) by place; transfer value (finance); FCS/rCSI (rates); livelihoods asset delivery funnel |
| Agriculture | Production & adoption | Farmers trained → adopting (funnel); yield change (bullet); hectares by crop (treemap); input distribution map |
| Protection & GBV | Services reached (confidentiality-safe) | Cases by service type (counts only, small-cell suppression < 5 shown as "<5"); referrals; safe spaces map (no individual points); training reach |
| Shelter & CCCM | Shelter delivery | Units completed vs target by place; materials distributed; site population pyramid; Gantt |
| Governance & civil society | Capacity & participation | Organisations supported; trainings; participation by sex/age; policy milestones timeline |
| Economic development | Enterprise support | Businesses supported; jobs created (cumulative); loans disbursed (currency); revenue change |
| Climate & resilience | Adaptation | Hectares restored; early-warning coverage by place; hazard layers (custom layers) + beneficiaries |
| Humanitarian (multi-sector) | Response snapshot | People reached by sector (stacked); sites map; funding vs needs; sitrep tiles |
| Portfolio | Executive home | Funds obligated/awarded/disbursed; projects by sector/status/funder; map of all projects; alerts; late reports |

- **Small-cell and confidentiality rule** (protection, health): a count below the organisation's threshold (`smallCellThreshold`, default 5, setting) is shown as "<5" in tiles, charts and maps; applies to shared/embedded links always.
- **Every template is a draft, always** (`status: "DRAFT"`, no sign-off state exists). Built-in templates are never changed in place: "Copy and edit" makes the organisation's own copy (`copyTemplate`, `basedOn` kept).
- **Template editor** (built in 34.0 as pure functions, screens in 34.3): rename/describe/change sector and audience; add, rename, retype and remove **roles** (a role's key never changes; removing a role that charts use is refused, naming the charts); add, retitle, rewire (change its roles/kind/measure), move, resize and remove **charts and text blocks** on the 12-column grid with the same layout rule as dashboards; every edit is checked as a whole, so a template that cannot be applied cannot be saved; revision counter; later: duplicate widget, import/export a template as a file, share a template between organisations.
- Org admins can also **save any dashboard as an organisation template** (roles are inferred from the mapping).

### 4.3 Layout and interaction (DevResults-style, our rules)
- 12-column grid (existing `settleLayout`), **sections** (collapsible header rows), **tabs** within a dashboard (Overview / Results / Finance / Map), full-screen "TV mode" (auto-rotate tabs), print/PDF of the whole dashboard (A4 landscape, page breaks between sections).
- **Dashboard filters** (per viewer, not saved into the layout): period range, project(s), place, sector, funder, status, group. Every widget declares which filters it honours; a widget that cannot honour a filter shows a small "not filtered" chip.
- **Cross-filtering**: clicking a bar/place/slice sets a filter chip that the other widgets honour; "Clear" resets. Never changes stored data.
- **Drill-through**: any figure links to its owner (indicator page, record, report, plan item).
- **Bookmarks**: star project/indicator/dashboard/chart/map view; "Pinned" row on Home (`Bookmark`, per user).
- **Alerts** (single rule table `ALERT_RULES`, derived on read, never stored): overdue milestone / plan item, report deadline in N days, period data returned, indicator value overdue, budget over threshold (burn rate vs time elapsed), project with no data this period, evidence unverified > N days. Each alert names its cause and links to the owning screen.
- **Home snapshot** (`/`): role-aware, composed from the same `Tile`s: KPI strip (projects, reporting this month, people reached, funds), map of projects, "Needs you" (existing queue), alerts, upcoming (calendar), results highlights, breakdown tiles, pinned. Visibility by `ROLE_SURFACES`; hidden, not disabled.
- **Publish**: push a dashboard to roles / named people / partners (read-only copy that follows the source; editing stays with the owner). External partners see tiles **filtered to their projects** (existing project boundary) and an admin switch `partnerDashboardsEnabled` (default on) controls whether partners may build their own.
- **Share/embed** (existing hash-token links): add optional password, view-count, "data as of" stamp, allowed filters; finance still stripped for outside viewers.
- **Performance**: one dataset resolve per dashboard (`ResolveDatasetBatchHandler` batching widgets by scope), result cache keyed by data version (`sheetVersion`), widget lazy-load below the fold, skeletons.

### 4.4 Deliverables / tests
Domain: `dashboard-v2.ts` (widget kinds, filters, sections), `sector-packs/*.ts`, `template-apply.ts` (role mapping, pure), `alert-rules.ts`, `small-cell.ts`. Application: `ApplyDashboardTemplateHandler`, `PublishDashboardHandler`, `GetHomeSnapshotHandler`, `ListAlertsHandler`, `BookmarkHandlers`. Web: `DashboardCanvas v2`, `TemplateGallery`, `RoleMapper`, `FilterBar`, `HomeSnapshot`.
Tests: every template applies cleanly to a fixture project with all roles, none, and half (no throw, no placeholder figure); every widget kind empty-state; alert rule table; small-cell suppression in tile/chart/map/export; layout determinism; copy lint; server/client boundary test; role matrix test.
Deploy: migrations `Bookmark`, `DashboardPublication`, `Dashboard.roleMapJson/sectionsJson` (additive); RLS; `/ready` pairs; web + api together.

---

## 5. Batch 34.4 — Maps Studio (a full mapping tool)

### 5.0 Decision needed first: basemap
Phase 30 chose **no tile server, no external geocoding** (a location never leaves the tenant). DevResults-style maps normally sit on street/satellite tiles. Plan:
- **Default stays offline**: bundled world/admin-1 shapes, uploaded org boundaries, optional bundled admin-2 for priority countries (generated like the existing geo data), plus a clean "no basemap" style.
- **Optional online basemap, per organisation, opt-in** (`mapTilesProvider`: none | self-hosted | named provider). When on, the browser requests tiles from the provider (viewer IP and tile coordinates leave the browser — not place names or data); the setting page says so; shared/embedded maps never use online tiles unless the org enabled it. **Owner decision required (§12).**

### 5.1 Layers (the core model)
`MapView { baseStyle, layers[], viewport, filters, time, legendState }` — stored as config, never data (like infographics).
Layer kinds, each a pure `buildLayer(dataset, spec) → LayerModel`:
1. **Boundaries** — country / admin 1 / 2 (bundled or the org's uploaded layer); labels; selectable.
2. **Places** — points and areas from the Places registry; style by type, admin level, tag; clustering at low zoom; label rules.
3. **Indicator choropleth** — one indicator, one period (or cumulative), at a chosen admin level, with roll-up through the Place tree (existing `rollupByPlace`); classification **equal interval / quantile / natural breaks (Jenks) / manual breaks / target-based (met, near, behind)**; sequential/diverging ramps; legend with counts; "no data" is its own grey class, never the low colour.
4. **Graduated symbols** — circle size by value, colour by second measure (optional).
5. **Pie/bar glyphs on map** — breakdown by group per place (e.g. sex, service type), additive types only.
6. **Heat layer** — density of beneficiaries/activities (points only; disabled when small-cell rule would be broken).
7. **Activity & plan layer** — planned activities coloured by delivery signal (existing `SITE_SIGNAL_COLOR`), risks attached.
8. **Photo layer** — geotagged evidence images (EXIF GPS or the activity's place); cluster thumbnails; click → gallery drawer; confidentiality respected (`CONFIDENTIALITY_READERS`; restricted images show a lock, never a thumbnail).
9. **Custom context layers** — KML, KMZ, GeoJSON, zipped Shapefile, CSV (lat/lon) → validated by one `validateMapLayer` (extends existing), stored per organisation (many, named, groupable, project-scoped or org-wide), styled (fill, stroke, opacity, label field), toggled per view. Examples: watersheds, flood zones, roads, health catchments.
10. **Reference layers** — bundled: population density grid (optional), country borders, capitals.
11. **Draw layer** — user-drawn points/lines/polygons/notes saved with the view (annotations; not Places unless promoted via "Add as place").
12. **Compare layer** — second indicator or second period (swipe, split view, or bivariate colouring).

### 5.2 Interaction toolset
Pan/zoom, fit to project / country / selection, zoom-to-place search (Places + gazetteer, no external geocoder), layer panel (order, opacity, visibility, legend per layer), **time slider** (period steps, play/pause, "cumulative" toggle), **indicator picker** (one at a time like DevResults, plus pinned second), **admin level selector** (rolls up/down), measure tools (distance; area of drawn polygon), **select by area** (draw/lasso → list of places and totals inside), **buffer** ("places within N km of a point", using bundled coordinates only), **coverage gaps** ("admin areas with no activity / no data"), click popup → **Place panel** (name, path, projects working there, indicators with latest value and target, photos, contacts/notes, records to confirm), hover tooltips, keyboard navigation (focus places in order, Enter opens the panel), full-screen, mini-map, coordinate readout, scale bar, north arrow.
- **Filters**: project(s), sector, funder, status, period, place level, group, "verified only" (draft values shown only when toggled, flagged).
- **Saved views**: named, owned, shareable inside the project, bookmarkable, linkable (`?view=`), default view per project, org-wide views for portfolio maps.
- **Portfolio map**: all projects' places in one map (obeys `countedElsewhere` and project access); overlap warning (same place, overlapping dates) as an info marker; never a combined score.
- **Embedding**: map as a dashboard widget, report figure (snapshot artifact, stale on read, same rules as data charts), infographic block (existing map block reads the same function), shared read-only link (tokenised, finance-free, small-cell safe).
- **Print/export**: PNG/PDF (A4/A3, portrait/landscape) with title, legend, scale bar, north arrow, source and "as of"; GeoJSON of the view's data layer; **KML/KMZ export** of places and layers (with styles); CSV of the place table; shapefile export of places (optional, later).

### 5.3 Places administration inside the Studio
Bulk import (CSV/XLSX/KML/GeoJSON/shapefile, existing "any bad row blocks, names its row, preview with `apply:false`"), **auto-assign admin path** (point-in-polygon against bundled/org boundaries; suggestion, confirm), duplicate detection (same name+parent, or < 200 m), merge (records keep what was typed), "Places to confirm" shortcut, edit pin by dragging (audited), contacts/tags/address per place, project assignment ("Where we work") with map selection, retire with live-children refusal (existing).

### 5.4 Honesty rules for maps (one file `map-honesty.ts`)
No value is guessed into a place; unplaced results listed in a side list with count; a rate is never summed up the tree (shown only for the place that recorded it); a parent "partly reported" marker; classification breaks shown in the legend and exported; "no data" ≠ 0; small cells suppressed as "<5"; draft values only when toggled and flagged; sensitive projects (protection) can mark **"generalise to admin 1"** so exact points are never plotted or exported.

### 5.5 Technical
- Rendering: continue with ECharts geo for choropleth/symbols (already bundled, lazy), and add a **vector map engine** (MapLibre GL JS, self-hosted, no tiles needed for offline vector style) for pan/zoom performance, clustering, drawing and large custom layers. Decide at the start of 34.4 with a spike (bundle size, RTL, SSR, offline use of `/field`). Nothing geo enters a first bundle (existing rule).
- Spatial maths in domain (pure): `pointInPolygon`, `bbox`, `haversine`, `buffer`, `classify` (breaks), `centroid`; table-tested.
- Server: `GET /v1/projects/:id/map-data?layers=...` (project.view) assembling only what the viewer may see; `POST/PUT/DELETE /v1/map-layers` (project.edit / org.manage); `GET/PUT /v1/map-views`. Layers stored in `IStorage` under `map-layers/<tenant>/<id>`; metadata in `MapLayer` (RLS), views in `MapView` (RLS).
- Performance: simplify geometries by zoom (precomputed), limit 50 000 vertices per uploaded layer (message names the limit), tile points client-side, cache classified results by sheet version.

### 5.6 Deliverables / tests
Domain: `map-view.ts`, `map-layers/*.ts`, `classification.ts`, `spatial.ts`, `map-honesty.ts`, `kml.ts` (parse/write), `shapefile-lite.ts` (via a vetted parser in infrastructure, domain gets plain GeoJSON). Application handlers: `GetMapDataHandler`, `Upload/ListMapLayersHandler`, `Save/ListMapViewsHandler`, `AssignAdminPathHandler`, `ExportMapHandler`. Web: `MapStudio` (route `/projects/:id/map`, `/portfolio/map`), `LayerPanel`, `TimeSlider`, `PlacePanel`, `LegendEditor`, `DrawToolbar`.
Tests: classification tables (all methods, ties, all-equal, one value, all-null), point-in-polygon edge cases, KML/GeoJSON/shapefile round-trips, malformed-file refusals, confidentiality of photo layer, small-cell and generalise rules, honesty rules, export determinism, authorisation coverage, `rls-coverage`, a11y (keyboard path), `/ready` pairs (`MapLayer.storageKey`, `MapView.configJson`).
Deploy: additive migrations, rls per table, web + api together.

---

## 6. Batch 34.2 — Entry Sheet (data entry as a real spreadsheet)

Replaces/extends `IndicatorEntryGrid` (`/projects/:id/reports/:periodId/inputs`). The form-like rows become a true grid; the old view stays available as "Form view" until the Sheet is verified on a phone and a desktop, then becomes the fallback for narrow screens.

### 6.1 Layout — rows and columns always visible
- **Rows** = indicators (code, name, unit, type chips) with **expandable sub-rows** for each disaggregation group and each place; **columns** = fields for the chosen period (Baseline · Target (cumulative) · Previous · This period · Cumulative · % of target · Status · Note) **or** periods across the top (a multi-period sheet: P1 P2 P3 … with the selected one highlighted).
- Three **orientations** (one toggle): *Indicators × Periods*, *Indicators × Places*, *Places × Periods (one indicator)*, and *Groups × Places (one indicator, one period)* — the same cell model, different axes.
- **Frozen** header row and first columns (code, name); sticky group headers; column resize/reorder/hide; row grouping by output/outcome (collapsible); zebra rows, cell borders, row/column headings like A, B, C / 1, 2, 3 optional (`Show cell references`); zoom 75–150%; full-screen; density (compact/comfortable); virtualised rows/columns (thousands of cells smooth).
- **Totals**: column footer (sum only for additive types; rates show "—"), row subtotals for groups with a **consistency line** (existing: breakdown total vs period total).
- **Cell states** (colour + icon + text, never colour alone): empty · typed (unsaved) · saved draft · handed in · verified (locked) · returned (with reason) · not applicable (reason) · calculated (formula, read-only) · invalid · conflict (changed by someone else) · outside entry window (read-only with the dates) · locked by approved report.

### 6.2 Editing like a spreadsheet
- Click/arrow keys to move, **Enter/Tab/Shift+Tab** to commit and move, **F2** edit, **Esc** cancel, type to overwrite, **Ctrl+Z/Y** (sheet-wide undo/redo with a visible history of the session), **Ctrl+C/V** (copy/paste ranges within the sheet and **from Excel/Sheets** (tab/newline parsing, locale decimals), mismatched shape → preview with the problems), **fill down/right** (Ctrl+D/R) and a drag fill handle (copy only; a series-fill option for "same as previous period" — never invents values), **multi-cell select** (shift-click, drag, Ctrl-click), select row/column, delete clears (an empty cell never clears a stored *submitted* value silently — it marks "clear?" for confirm), **find** (Ctrl+F) and **go to** (indicator code), **sort/filter rows** (status, empty, invalid, late, returned), **freeze/unfreeze**.
- **Cell editors** by type: number (thousands/decimal per locale, min/max hints), percentage, currency (unit shown), date, select (for categorical indicators), text note; **Not applicable** as an action on a cell/row (reason required); **Not measured** stays empty.
- **Inline validation** as you type: type rules (`indicatorValueProblem`), negative where not allowed, breakdown ≠ total (warning with the difference), cumulative < previous cumulative (warning), implausible jump vs previous (z-score/ratio hint, never blocks), required evidence missing (link), formula cells read-only.
- **Suggestions in the cell** (existing `indicator-entry-suggestions.ts`): previous period value, running total for SUM indicators; shown as ghost text, accepted with Tab, never replace typed values.
- **Cell panel** (right drawer, or popover on mobile): history of changes with who/when (append-only), note, evidence attach/preview, source (typed / form records / import / connector), comment thread, reviewer note, formula explanation, "see in Data Center".
- **Comments on cells**: red-corner marker; `COMMENTABLE_ENTITIES` gains `indicator-cell`.
- **Autosave**: debounced per row to draft; "Saved 12:04" indicator; offline: edits queue in the outbox kind `indicator-values`; conflict = parked cell with both values shown (resolved by the person). Existing `expectedUpdatedAt` check remains.
- **Bulk actions**: Submit for review (existing handler), Send back (reviewers), Verify selected, Mark all empty as "not applicable" (reason required, preview), Copy from previous period (preview, fills **empty** cells only), Clear drafts (confirm).
- **Import/export**: download the sheet as XLSX with the same layout (locked header cells, data validation lists, hidden id sheet); import validates the same way (any bad row blocks, error file with highlighted cells); paste-import for a range.
- **Reviewer mode**: same sheet read-only with Verify/Return per row or selection, inline "return with reason", diff against previous submission (changed cells outlined).
- **Stoplight column** (existing `entryStoplight`) and pace chips remain; no new score.
- **Mobile**: under 640 px the Form view is shown; the Sheet is offered landscape on tablets.
- **Accessibility**: ARIA grid roles (`role="grid"`, `aria-rowindex/colindex`), screen-reader announcements for cell state, full keyboard parity, visible focus, no colour-only states.

### 6.3 Domain/engine
Pure `entry-sheet` module (web `features/reporting/domain`): `SheetModel`, `cellAddress`, `applyPaste`, `fillRange`, `undoStack`, `validateCell`, `diffSheet`, `toWritePlan` (cells → `BulkUpsertIndicatorUpdatesHandler` payload). No React/Next/clock. The save goes through the existing handler (entry window, locks, verified values, formula refusal, not-applicable rule all still apply — **no second write path**).

### 6.4 Deliverables / tests
Table tests for paste (locales, quoting, ragged shapes, merged cells), fill, undo/redo, validation matrix per indicator type, write plan equality with the old grid for the same inputs (golden), keyboard map, ARIA snapshot, concurrency (two editors), offline queue, import/export round-trip, performance test (2 000 rows × 24 periods renders < 100 ms interaction), copy lint, i18n keys.
Deploy: web only for the grid; API additive: `GET …/indicator-sheet` (one read for the sheet model; `indicator.update`/`project.view` as the old inputs read), no migration (cell history uses `IndicatorUpdate` revisions — verify; if none exist add `IndicatorUpdateRevision`, additive).

---

## 7. Batch 34.5 — Indicator pages, saved reports (MultiMatrix), linked forms

- **Indicator page** `/projects/:id/indicators/:iid`: header (code, name, type, unit, direction, aggregation, status, owner), KPI row (baseline, target, latest, cumulative, % of target when applicable, pace chip), **four tabs: Graph (targets vs actuals, Chart Studio embedded) · Matrix (query) · Map (choropleth/graduated at level) · Pie/Breakdown (one period, groups)**, plus **Data** (the sheet slice), **Evidence**, **Formula/Source** (how it is read and where its values come from), **History** (definition versions), **Comments**.
- **Matrix query tool**: choose rows (period / place / group / project), columns (measure or period), filters, totals rules (additive only), conditional formatting; save as a report; export CSV/XLSX; add to a dashboard as `TABLE`.
- **MultiMatrix / Saved reports**: same over several indicators (rows = indicators, columns = periods/places); named, shareable in project, scheduled email (weekly/monthly, in the org's 07:00 hour via the existing reminder runner; recipients with access only; PDF/XLSX attached; "data as of").
- **Linked forms**: a collection form may declare a **join field** shared with another form (e.g. household id) so an indicator can count distinct households across forms (`aggregateRecords` gains `joinOn`); validated (same field type, no cycles); missing join = listed apart, never dropped.
- Tests: matrix tables (additive/rate/null), saved report round-trip, schedule idempotency (`ReminderLedgerEntry`), join semantics, permission matrix.
- Deploy: `SavedReport` (+ schedule) table, RLS, `/ready` pairs.

## 8. Batch 34.6 — Finance (completes 33.11, DevResults finance parity)

- **Budget** per project: lines (code, name, category/cost type, output link), versions (original, revised; each revision a record with reason), **funding sources** (donor, award no., currency, amount, period), **multi-currency**: each amount carries its currency; org **primary currency** and **rate table** (dated rates, source, entered by an admin; a conversion uses the rate dated on the transaction, shown beside the figure; a missing rate → "Rate needed", never a guessed conversion).
- **Register**: disbursements (funder → project), expenses (line, date, vendor, amount, currency, evidence link), **advances** (given, accounted, outstanding), reclassifications; approval status; imports (CSV/XLSX with error file).
- **Views**: budget vs actual by line/quarter, **burn rate** (spend vs time elapsed; juxtaposition, no projection), outstanding advances, funds obligated/awarded/disbursed (portfolio KPI), **cost per result** (budget line ↔ output/indicator; spend ÷ achievement for additive indicators only; "not computed" for rates or zero/missing achievement), finance charts (waterfall budget bridge, stacked by line, sankey funder → line → place).
- **Honesty**: finance only reaches a writer when `financeDataMode` is on and the summary is VERIFIED (existing); outside viewers never see it (existing); every conversion shows currency and rate date.
- **Cross-cutting**: markers (gender, environment, disability) on activities and budget lines (additive), IATI export (activities + transactions, validated against the schema before download; sensitive projects excluded unless flagged).
- Tests: conversion tables (rate dates, missing), burn rate, advances ageing, cost-per-result refusals, IATI schema validation, RLS, export lists.
- Deploy: migrations `BudgetLine…`, `FundingSource`, `CurrencyRate`, `Expense`, `Advance`; RLS; `/ready` pairs.

## 9. Batch 34.7 — Project workspace: notes, library, gallery, calendar, timeline

- **Notes wall**: a running project log (post, edit within 15 min, pin, reply one level deep, @mention, attach file/photo, tag a place/indicator/activity). Linked staff get **one daily digest** (existing `PersonNotifier` mode: always / only urgent / never), not an email per post. Not part of report claims, never sent to a writer.
- **Document library**: folders (nest ≤ 5), upload multiple, rename/move, tags, version stack (new version keeps the old), per-folder confidentiality (existing levels), search by name/tags/extracted text, "Used in report X" badge, preview (PDF/image/office text), bulk download as zip. Evidence stays the system of record for report proof; the library links to evidence when a file is promoted ("Use as evidence").
- **Photo gallery**: grid of image evidence and library photos with caption, date, place, activity, photographer; filters; slideshow; geotag editor (set/fix pin); consent flag ("do not publish") that hides it from shared links, infographics and public pages.
- **Shared calendars**: project and portfolio calendars (plan items, milestones, deadlines, events the team adds, entry windows), month/week/agenda, colour by type, **iCal subscribe feed** (token, read-only, no confidential titles), add-to-calendar per item.
- **Timeline (swimlane)**: lanes = outputs / workstreams / owners; items = planned activities, milestones, deliverables, reporting periods, events, entry windows; drag/resize (existing confirm-bar rules), dependencies ("comes after"), critical path highlight (display only), baseline ghost (original dates), zoom (week/month/quarter/year), today line, export PNG/PDF. Merges the plan Timeline and Calendar views over one `toWorkPlanRow`-based model (no second definition of "late").
- Tests: digest idempotency, folder moves, version stack, consent hiding, iCal content, timeline layout table.
- Deploy: `ProjectNote`, `LibraryFolder`, `LibraryFile(+Version)`, `CalendarEvent`, `EvidenceFile.publishConsent`… additive; RLS; routes in `RULES`.

## 10. Batch 34.8 — Document templates and sign-off

- **Standard forms library**: a registry of fill-from-project documents: monitoring visit report, quarterly narrative cover sheet, closeout checklist, site visit form, training attendance sheet, beneficiary feedback form, handover certificate, no-cost extension request. Each is a template (domain registry + DOCX layout) with **merge fields** from the project (names, dates, donor, award no., places, indicator snapshot, budget summary). Output: DOCX/PDF download; the generated file is saved in the library with the data it used (snapshot). Org templates uploadable (DOCX with `{{field}}` markers, validated: unknown field → refused with the list).
- **Checklist upgrades**: milestone due dates (link to plan milestone), "Complete & approved" sign-off line (approver, date, note), overdue flagged on the Overview and Home alerts; state items still close from data (existing reconciler).
- Tests: merge-field resolution table, missing-field behaviour ("Not provided", never blank-looking-complete), DOCX validity, unknown field refusal.

## 11. Batch 34.9 — Partner portal and publishing

- **Partner home**: only their projects/periods ("what you must submit", entry window countdown, returned items with reasons), their dashboard(s) (published or self-built when allowed), their places, their forms (Field app), their documents library folders shared with them.
- **Publish to partners/roles**: `DashboardPublication`, `SavedReport` shares; partners get a **filtered copy** (tiles scoped to their projects through the existing boundary); revoking removes access immediately.
- **Admin settings**: `partnerDashboardsEnabled`, `partnerCanExport`, `smallCellThreshold`, `mapTilesProvider`, `defaultLanguage`. Each audited.
- Tests: project-boundary matrix for every new route (partner sees only own), external allow-list (`EXTERNAL_ALLOWED`) additions each with a normal rule, export scoping.

## 12. Batch 34.10 — Polish, accessibility, performance, languages

- **Accessibility audit**: axe on every new screen; keyboard-only run-through for Sheet, Chart Studio, Maps Studio and Dashboard canvas; chart/map text alternatives; reduced motion; high-contrast theme.
- **Performance budgets** (CI-checked where possible): first bundle unchanged (geo/ECharts/MapLibre lazy), Sheet interactions < 100 ms, dashboard first paint < 1.5 s with skeletons, map pan 60 fps on a mid phone for ≤ 5 000 points.
- **Languages**: new copy added to `en.ts` first, then fr/es/ar; RTL checks for Sheet, dashboards and charts (axes mirror, geography not).
- **Docs/support**: feature docs `Features/53-…` onward, support articles (held in `_unpublished-phase34/` until checked in a browser with the user's account — public copy stays honest), operator runbook entries, sector template guides.

---

## 13. Cross-cutting design rules (new, binding for Phase 34)

1. **One spec, one renderer** for charts; **one view model, one resolver** for maps; **one write path** for values (the Sheet never writes elsewhere).
2. **Roles, not ids** in templates; mapping is explicit and reversible.
3. **A stored view is config** (chart spec, dashboard, map view, saved report), never data; every figure is recomputed on open from the sheet and stamped "as of".
4. **Small-cell and generalisation** protections apply to every surface that can be shared (tile, chart, map, export, link, API).
5. **Unverified is visible**: draft values appear only when asked, badge + note, never in a shared/external view unless the owner explicitly includes them.
6. **No new scores**: no composite health score, no ranking index; juxtaposition only.
7. **Everything keyboard-operable and screen-reader describable**; colour is never the only signal.
8. **Hidden, not disabled** by role (`ROLE_SURFACES`); each new surface adds rows to the exhaustive tables (the test fails until filled).
9. **Every new route has a `RULES` entry**; every new tenant table has RLS; every new `select` field joins `REQUIRED_PRISMA_FIELDS`; additive migrations before code.
10. **Writers never receive** chart, dashboard, map, sheet or workspace state (add the keys to `WRITER_EXCLUDED_PERIOD_KEYS` mirror tests where relevant).

## 14. Data model summary (all additive, RLS forced)

`Chart(specJson, ownerId, scope, projectId?)` · `ChartVersion` · `Bookmark(userId, kind, refId)` · `DashboardPublication(dashboardId, audience…)` · `Dashboard.roleMapJson/sectionsJson/tabsJson` · `DashboardTemplate(orgId, json)` · `SavedReport(specJson, scheduleJson)` · `MapLayer(storageKey, kind, scope)` · `MapView(configJson)` · `ProjectNote` · `LibraryFolder` · `LibraryFile` · `LibraryFileVersion` · `CalendarEvent` · `BudgetLine` · `BudgetRevision` · `FundingSource` · `CurrencyRate` · `Expense` · `Advance` · `DocumentTemplate` · `GeneratedDocument` · `Organization.smallCellThreshold/partnerDashboardsEnabled/mapTilesProvider` · `EvidenceFile.publishConsent` · `IndicatorUpdateRevision` (if absent).

## 15. Order, size, dependencies

| Order | Batch | Why this order | Size |
|---|---|---|---|
| 1 | 34.0 Foundations | tokens, Tile, ChartSpec v2, dataset layer, sector registry | M |
| 2 | 34.2 Entry Sheet | biggest daily-use change, independent of charts | L |
| 3 | 34.1 Chart Studio | needed by dashboards, indicator pages, reports | L |
| 4 | 34.3 Dashboards v2 + templates + Home | the headline the user liked; needs 34.0/34.1 | L |
| 5 | 34.4 Maps Studio | needs 34.0 and place roll-up; MapLibre spike first | XL |
| 6 | 34.5 Indicator pages, saved reports, linked forms | uses 34.1 and 34.4 | M |
| 7 | 34.6 Finance | completes 33.11; feeds dashboard FINANCE tiles | L |
| 8 | 34.7 Workspace | independent; can run in parallel with 34.6 | L |
| 9 | 34.8 Document templates | after 34.7 library | M |
| 10 | 34.9 Partner portal | after 34.3 publishing | M |
| 11 | 34.10 Polish | continuous; final gate | M |

Each batch ships alone behind its own deploy, with migrations first, `/ready` pairs, rate limits for any new public route (dashboard and map share links reuse the `dd_public_dashboards` zone), and a browser check on prod with the user's own account (never store the password).

## 16. Owner decisions and actions needed

1. **Basemap policy** (§5.0): offline-only (default) vs opt-in online tiles per organisation, and which provider.
2. **Screens**: capture DevResults demo/screens so layouts for Home, dashboard and map can be compared (the tour video was not viewable).
3. ~~Sector specialists review~~ **Decided: templates are always drafts and editable.** Confirm the sector list and which templates to write next.
4. **Small-cell threshold** default (5?) and which sectors apply it by default.
5. ~~Which countries first~~ **Decided: all possible.** Open: confirm a boundary source whose licence allows shipping it in a commercial product (§Status).
6. ~~Currency rates~~ **Decided: manual table.**
7. **Online map/engine dependency**: approve MapLibre GL JS (BSD-3) after the spike.
8. **Scope control**: 34.6/34.7/34.8 are large and independent; confirm whether they run before or after Maps Studio.

## 17. Definition of done (per batch)

Domain tables tested; `pnpm -r typecheck`, `pnpm -r build`, package tests on fresh `dist/`, web unit suite, architecture and rls-coverage tests, authorization coverage, copy lint and i18n completeness green; AGENTS.md invariants section added; feature spec written; support drafts held; deploy notes with migration names; browser verification recorded (what was seen, what was not).

## 18. Not in Phase 34

Certification (ISO 27001), a native mobile app, a general survey engine beyond collection forms, GIS-grade analysis (this is "not intended to replace GIS", same as DevResults), real-time collaborative cell editing (conflicts are detected, not merged), BI connector beyond the public API/CSV, AI-generated charts (possible later through Ask with the same grounding check).


## 19. Implementation notes by slice

The per-slice notes written while building were folded into the status tables above; the rules each slice must keep are in AGENTS.md ("Phase 34 …" sections) and in `memorybank/Features/53-…` to `58-…`.
