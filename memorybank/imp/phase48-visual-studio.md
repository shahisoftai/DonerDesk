# Phase 48 — Visual Studio: one place for every chart, map, dashboard and infographic, on a state-of-the-art Canvas

Status: PLAN (2026-11-09). Nothing built. Branch to cut: `0019-visual-studio` from `0018-optimisation`.
Builds on Phase 45 (one Canvas), 47 (chart style/themes), 41 (maps), 34/35 (dashboards, Chart Studio), 32 (Infographic Studio).

## 0. Decisions (confirmed by the owner 2026-11-09)

Ambition (owner, 2026-11-09): charts, dashboards and infographics must match high-end web tools (Flourish, Datawrapper, Infogram, Canva, Tableau, Power BI, Figma) in options, styles, themes, motion and output — without dropping a single DonorDesk honesty rule. §2b is the benchmark; batches 48.11–48.16 deliver it.

| # | Question | Decision | Why |
|---|---|---|---|
| D1 | Free positioning or finer grid? | **Both, by page mode.** A page is `GRID` (dashboards, 12 columns, as today) or `FREE` (infographics, posters, slides: pixel positions on a fixed page size). A block never changes its model; only its frame differs. | Keeps "one model feeds screen and print"; avoids breaking every saved canvas. |
| D2 | Live multi-user editing? | **Not in the first release.** 48.7 ships block comments, suggest mode and a visual version diff. Presence/cursors (48.8) only after a realtime channel decision. | Realtime is the most expensive item and needs infrastructure we do not run. |
| D3 | Does Chart Studio / MapExplorer get rewritten? | **No.** They are hosted inside the Visual Studio as block editors. | Their behaviour is browser-tested; a rewrite loses features. |
| D4 | Do old screens vanish? | **Redirect first, delete later**, one at a time, after the parity gate and the browser harnesses pass. | Reversible cutover, as in Phase 45. |

## 1. Goal and non-goals

Goal: one Visual Studio where a person makes any visual (chart, map, KPI row, dashboard, infographic, one-pager, slide) with the editing feel of Figma/Canva and the data honesty of DonorDesk, and where nothing the older screens did is lost.

Non-goals: a general drawing tool (no freehand illustration), a BI query language, video, online map tiles, a model that writes figures (AI stays opt-in, grounded, unaccepted until a person accepts it).

## 2. Audit — where visuals live today (the starting point)

| Entry | Code | Fate in this phase |
|---|---|---|
| Left nav "Dashboards and infographics" `/visuals` | `features/canvas`, 40 block kinds | **Becomes Visual Studio** |
| Left nav "Older dashboards" `/dashboards`, `/dashboards/templates` | `features/dashboards` (TemplateGallery, TemplateEditor) | Redirect; templates move into the Studio library |
| Project tab Dashboards (`/dashboards?project=`) | redirect | Removed (project filter in Studio) |
| Project tab Infographics, `/portfolio/infographics` | `features/infographics` (`InfographicsList`, studio/*) | Merged into Studio "Designs"; brand kit, image library, saved templates move to the shared library |
| `/projects/:id/charts` | `features/charts` (Chart Studio) | Hosted as chart block editor + "Charts" library |
| `/projects/:id/maps` | `features/maps` (MapExplorer, PhotosMapPanel) | Hosted as map block editor + "Maps" library |
| `/projects/:id/report-builder` | `features/report-builder` | Stays a data tool; adds "Send to Visual Studio" |
| `/projects/:id/data` | `features/data-center` | Stays the data tool; chart/table outputs "Send to Visual Studio" |
| Report editor inspector | `ReportChartPanel`, `DataChartsPanel`, section infographics | Inserts from the Studio library; snapshots stay as artifacts |
| Home, project Overview, plan map/timeline/Gantt | `HomeGrid`, `PortfolioMapPanel`, `SiteMap*`, overview sections | Stay as consumers of the same block models (not moved) |
| Logframe `IndicatorResultsPanel` | charts | Consumer of the same chart builder |
| Public | `/shared/dashboard`, `/shared/infographic`, `/shared/canvas`, `/embed/dashboard` | One share/embed path |

Canvas today (keep): 40 block kinds in one registry; pure `resolve()` models shared by screen and print; undo/redo (`edit/history.ts`); snap and drag/resize (`BlockFrame`, `edit/layout.ts`); containers (group, tabs, repeater); cross-filters; review, versions (30), kept copies, frozen/live share links, scheduled snapshots; AI blocks (opt-in); Design check; four-language editor text.
Canvas editor UI is thin: ~640 lines across `BlockFrame`, `CanvasPageGrid`, `CanvasWorkspace`, `editor/*`.

## 2b. Benchmark — what high-end tools offer, and where it lands

Each row becomes a parity row (§3) with batch and test, so the benchmark is enforced like the old-screen inventory.

| Area | High-end reference | DonorDesk today | Phase 48 target | Batch |
|---|---|---|---|---|
| Chart catalogue | Flourish/Datawrapper ~60 types | ~50 kinds | ~85 kinds (§48.11 list), each with refusals | 48.11 |
| Chart options | per-element styling, number formats, annotations, reference lines | Phase 47 style groups | full inspector: every element, number/date formats, annotation layer, reference lines/bands, conditional colours, label collision control | 48.11 |
| Tables | Datawrapper tables: heatmap cells, bars, sparklines, search, pagination | plain TABLE block | pro table: conditional formats, in-cell bars/sparklines/icons, sticky header, sort/search/paginate, totals row, mini-maps of rows | 48.12 |
| Maps | choropleth, symbol, dot density, flow, hex/tile, cartogram, locator | choropleth, symbols, pins, drill | + dot density, flow lines, hex/tile grid, locator inset, bivariate choropleth, label control, map annotations | 48.12 |
| Themes | theme gallery + builder + brand import | 40 chart presets, brand kit | 60+ curated canvas themes, theme builder, brand import from logo, colour-blind safe sets, sequential/diverging scale builder, dark/print variants | 48.13 |
| Typography | font library, text styles | system-bundled fonts | 40+ self-hosted OFL fonts (Latin, Arabic, Devanagari, Ethiopic), text styles, rich text, text-on-shape | 48.13 |
| Design elements | icons, shapes, lines, illustrations, frames, masks | IMAGE block, asset library | 2,000+ licensed icons, isotype pictograms, shapes/lines/arrows/connectors, image crop/mask/filters, backgrounds/patterns/gradients, QR, logo strip | 48.14 |
| Motion | Flourish story, bar race, transitions | 300 ms first draw | entrance/emphasis animations, chart transitions between steps, animated counters, bar/line race over recorded periods, scrollytelling, reduced-motion respected | 48.15 |
| Dashboards | filter panes, drill hierarchy, views, alerts, subscriptions, playlists | period filter, cross-filter, TV mode | filter pane, drill hierarchies (logframe level → indicator; country → admin 4), saved views, threshold alerts, email subscriptions, TV playlists, mobile layout | 48.16 |
| Templates | hundreds of templates | 8 canvas + sector templates | 120+ templates (sector × purpose × format), template search, org template library | 48.16 |
| Assistance | "suggest chart", auto-design, alt text | AI text (opt-in) | deterministic chart recommender, layout auto-tidy, contrast fixer, alt-text drafts; AI opt-in for words only | 48.16 |
| Output | PNG@DPI, SVG, PDF, PPTX, GIF/MP4, embed, social sizes | PNG/PDF/SVG/PACK | + PPTX, XLSX, PNG at chosen DPI/scale, transparent PNG, print bleed and crop marks, animated WebM/GIF, social presets, responsive embed | 48.9, 48.15 |
| Collaboration | comments, versions, live cursors | versions, review | comments, suggest mode, diff, merge (48.6); presence (48.8) | 48.6, 48.8 |

**What we will never copy** (honesty rules stay above style): forecasts or trend projections presented as data; truncated bar axes; 3D charts; dual axes without labels; filling gaps with 0 or interpolation; adding rates; pictograms that round a figure without saying so; animations that hide the final value. Each is a validator refusal with a plain sentence and, where possible, a one-click fix.

## 2c. Data — every visual is connected, every dashboard is live (owner requirement 2026-11-09)

Today data reaches visuals through several paths (data sheet, `resolveDataset`, `DatasetExtrasService` sources PLAN/ACTIVITY_DAYS/BUDGET/PLACES, finance register, `CanvasFacts`, infographic data, portfolio handlers). Phase 48 puts **one data catalogue** in front of them so any block can use any data the viewer may see, and keeps it live.

- **Catalogue** (`packages/domain/src/contexts/visual-data/catalogue.ts`, a registry `DATA_SOURCES`): each source declares its fields (dimension or measure, type, unit, additive or not, grain), joins (project, period, place, indicator, logframe node, sector, donor/grant) and permission. Sources: indicators and values (period, cumulative, life of project, targets, schedule, breakdowns, status, not applicable), formula indicators, logframe tree, reporting periods and report status, places and results by place, plan (planned/held/late, milestones, leads), completed activities and participants, beneficiaries and reach, collection forms and records (accepted only feed figures), finance register (funding, disbursements, expenses, budget lines, advances; per currency), budget vs spend, risks, tasks and requests, evidence counts and verification state (never restricted content), comments counts, portfolio (projects, programmes, grants, sectors, countries, health band), sector library references. A new source is a row plus a resolver behind a port, nothing else.
- **One query shape** (`VisualQuery`: source, fields, filters, grouping, measure, period range, includeDraft) resolved by one application service (`VisualDataService`) that reuses the existing readers (`GetProjectDataSheetHandler`, `DatasetExtrasService`, place results, finance, portfolio). Same honesty rules everywhere: gap = null, rates never summed, currencies never added, unverified counted, `countedElsewhere` never added.
- **Data panel in the Studio** (left rail "Data"): browse sources and fields like Tableau/Power BI, search ("girls enrolled"), see a field's meaning, unit and freshness; **drag a field onto the canvas to make a visual** (recommender picks the kind), onto a block to add it, onto the filter pane to filter. A preview table under every block ("View data").
- **Calculated fields, safely**: ratio, sum, difference, share (the formula-indicator rules: counts only, no rate arithmetic, missing term = not measured); stored as part of the visual, never written back as data.
- **Live**: every resolve answer carries `asOf` and a data version per source. Dashboards refresh on (a) a data-change signal: writes that the audit trail announces (indicator value saved/verified, activity accepted, expense approved, record accepted) bump a per-project data version; open canvases poll a cheap `GET /v1/visual-data/version?projects=` every 30 s (SSE later with 48.8) and re-resolve only blocks whose sources changed; (b) manual refresh; (c) TV mode interval. Blocks show "Updated 2 min ago" and highlight changed figures briefly. Frozen snapshots and files say "as of" and never change.
- **Access**: resolved as the viewer (session) or as the outside guest for links (`ShareLinkExtras` rules: no finance, no project lists); a source the viewer cannot read is "not available here", never empty or zero. Webhooks and API keys untouched.
- **Data health in the Studio**: per block, "3 of 12 values not verified", "2 places not on the map", "rate shown without % of target" — the same notes files carry, with links to fix the data at its source (Entry Sheet, Places, Finance).

## 2d. Ease of use — high quality without getting lost (owner requirement 2026-11-09)

Inspiration and what we take from each:

| App | Pattern we adopt |
|---|---|
| Canva | start from "what are you making?" with size presets and template thumbnails; left rail of elements; contextual top toolbar for the selected thing; magic resize to other formats |
| Figma | layers panel, right inspector with collapsible sections, smart guides, multi-select, command palette, components |
| Datawrapper | step flow for one chart: Data → Check → Visualise → Publish, with sensible defaults so the first result is already good |
| Flourish | template-first charts, story steps, preview at phone/tablet/desktop |
| Power BI / Tableau | data pane with fields; drag a field to make a visual; filter pane; "Show me" recommendations |
| Notion / Linear | `/` to insert, ⌘K for any command, keyboard-first, quiet UI |
| Google Docs | autosave, comments in the margin, version history with names |

Principles (each becomes a checked rule or a harness step):
1. **Start right**: "New" asks *what* (dashboard, one-pager, infographic, social card, slide deck, single chart, map) and *for which project(s)*, then offers templates **previewed with the person's own data**; roles map automatically (`suggestRoleMapping`) and only unanswered ones are asked. Blank is always available.
2. **Good by default**: every new block arrives styled by the theme, sized, titled from its data, with source line and alt-text draft; a person never has to style anything to get a publishable result.
3. **Progressive disclosure**: the inspector shows *Basics* (data, title, kind, colours) first; *More* and *Advanced* expand on demand; the 300+ style options never show at once. A search box in the inspector finds any option by name.
4. **One layout, always the same**: left rail (Add · Data · Templates · Assets · Layers), canvas centre, right inspector for the selection, top bar (undo/redo, zoom, preview, comments, share/publish), bottom page strip. Contextual toolbar floats over the selection with the 5 most used actions.
5. **Never lost**: breadcrumbs (Studio › Project › Design › Page), "Back to all designs", recent items, search everything (designs, charts, templates, fields, commands), autosave with "Saved" state, undo for everything, named versions.
6. **Fix, not just warn**: problems appear on the block and in a "Ready to publish" checklist (Design check + data health) with one-click fixes; publish is a guided last step (who sees it, link or file, format, schedule).
7. **Learn in place**: first-run tour (from `workflow-rules.ts`), empty-state hints in every panel, tooltips with a short example picture, shortcut hints in menus, a help link per inspector section to the support article.
8. **Preview honestly**: one-click Preview as viewer, as share-link guest, and at phone/tablet/desktop/print.
9. **Same everywhere**: one icon set, one wording table (copy-lint, no raw codes), four languages, RTL, keyboard and screen-reader paths, 44 px touch targets.
10. **Measured**: task tests in the harness (make a donor one-pager from a template in ≤ 5 minutes, add a chart by dragging a field, fix a refusal, publish a link) and a moderated test with 5 real users (an M&E officer, a PM, a field officer, a grants officer, a director) before 48.10; findings are batched fixes, not opinions.

## 3. Parity inventory (the gate — nothing is skipped)

`memorybank/imp/phase48-parity.md` holds one row per item below: `source | feature | Studio home | batch | test`. `apps/web/tests/unit/visual-parity.test.mts` reads it and **fails on any row without a Studio home or test**, and on any exported symbol in the listed source files that no row mentions. Rows (initial, complete the file in 48.0):

**Chart Studio**: 40+ chart kinds and families (`CHART_KINDS`); data shapes and refusals with one-click fixes; style groups (`STYLE_FIELDS`); 40 theme presets + `fitToSurface`; gauge bands; marks; patterns; axis options; saved charts (MINE/PROJECT scope, expectedUpdatedAt); last 10 versions + restore; undo 50; "Add as KPI tile"; "Use in a dashboard" (original six kinds only — limit removed here); alt text; View data table; PNG/SVG downloads; map mode with KML/GeoJSON downloads; finance shape; waffle, sunburst, range, stream, rose, pictorial, radial.
**Maps**: MapLibre/ECharts engine switch; drill admin 1–4; boundary catalogue and credits; period slider; side-by-side periods; legend/bands; place panel; place tree; overlays (GeoJSON, KML/KMZ, shapefile in browser); area drawer and pin picker; tenant boundary layers; photos map; sites map and table; low-data mode; sources page; map data table; share-link map-results.
**Infographics**: six templates; ~25 block kinds; sections list; block editor; brand kit; asset/image library; saved templates; suggestions from records; Design check; languages en/fr/es/ar + RTL; publish (immutable exports PNG/PDF/SVG); share links; report insertion; portfolio designs; AI text (opt-in); presence rows from plan.
**Dashboards**: tiles (KPI with change/narrative, number tiles, status donut, project list, notes/headings, map widgets); tabs; full screen/TV mode; print; Download image; period filter and click-to-filter; templates (gallery, editor, role mapping, sector templates incl. library-generated); featured and pinned dashboards; headline row; widget heights; edit in place; share and embed.
**Data Center / Report Builder / report editor**: send-to-report chart and table; table-derived charts (stay in reports); saved reports as widgets; breakdown pie.
**Canvas (keep)**: all of the "Canvas today" list above.

## 4. Architecture rules for this phase

1. **One model, many frames.** `BlockModel` (from `resolve`) is unchanged. New: `BlockFrame` = `{ grid: {x,y,w,h} } | { free: {x,y,w,h,rot,z} }` per page, plus optional per-breakpoint overrides. Only `canvas/edit/layout.ts` knows frames.
2. **Registries, not branches.** New tables: `CANVAS_COMMANDS` (palette + shortcuts + menus from one list), `STYLE_TOKENS`, `PAGE_PRESETS`, `PARAMETER_KINDS`, `BLOCK_ACTIONS`. Tests walk every table. No `kind ===` outside registries (existing rule).
3. **Ports and adapters** for the editor shell: `features/canvas/ports` (`SelectionStore`, `Clipboard`, `Pointer`, `Realtime`), adapters hold the browser/DOM code. Presentation never imports adapters; ≤300 lines per file, ≤1 component per presentation file (extend `architecture-boundaries.test.mjs`).
4. **Editing is pure domain.** Every gesture is a function `(doc, input) → doc | refusal` in `canvas/edit/*`, table-tested, deterministic (as `settleBoxes` is). Undo steps = one gesture.
5. **Honesty unchanged.** A gap is never 0; rates have no % of target; unverified is labelled; a file names what it skipped. A style option can never switch off an honesty rule (Phase 47 rule).
6. **Additive documents.** `Canvas.docJson` gains optional fields (`pages[].mode`, `theme`, `params`, `frames`); an old canvas reads unchanged (golden fixtures from all 8 starter templates and converted dashboards/infographics). `contentHash` ignores nothing new silently: a save that changes nothing writes no version.
7. **Access never loosens.** Library items (charts, maps, components, assets) use the saved-chart rule (`canSee/canEdit`: MINE owner only; PROJECT needs `project.edit` to change). A block reading a project the viewer cannot see is "unavailable".

## 5. Batches

Each batch: pure domain first with table tests → application handler/route (in `RULES`) → web → browser harness → docs. Targeted tests per batch; full suites only before deploy.

### 48.0 — Parity inventory and test harness (gate)
- Write `phase48-parity.md` (all rows above, completed by grepping each source feature's exports and routes).
- `visual-parity.test.mts` (fails on unmapped rows/exports); `canvas-golden-docs` fixtures (every starter template, a converted dashboard, a converted infographic, a canvas with containers) used by every later batch to prove old documents still read and print the same.
- Baseline screenshots for the Canvas (extend `test:visuals`: light/dark, 1300/768/390).
- Exit: test red for every unmapped row, green when mapped.

**48.0 status (2026-11-09): built and green, except two items moved on purpose.**
- Done: `phase48-parity.md` (52 rows + enumerations: 51 chart kinds, style groups, 40 theme presets, 40 block kinds, widget kinds, metrics, dataset templates, 24 infographic and 8 built-in canvas templates), `phase48-retirement.md` (route, nav, feature, API, table, test and doc rows), `apps/web/tests/unit/visual-parity.test.mts` (8 checks; proven to fail on an unlisted kind, an uncovered route and a link to a redirected route), `packages/domain/test/canvas-golden.test.mjs` (59 golden documents: 33 canvas templates, 24 converted infographic templates, a converted dashboard, a canvas with containers; refresh with `UPDATE_GOLDEN=1`). The test found two uncovered API routes while being written; both are now rows.
- Moved: (a) dead-code scanner (`knip`) needs a new dev dependency; add it in 48.1 with the first removal-capable batch and run it as a report. (b) Canvas baseline screenshots and the bundle/timing budgets need the canvas browser harness; they land with `test:canvas-edit` in 48.1 so the baseline is taken once, with the harness that keeps it.

### 48.1 — Editing feel (track 1)
- Selection model (`canvas/edit/selection.ts`): single, shift-add, marquee/lasso, select-all, select-within-container, select-same-kind.
- Gestures: multi-move/resize, nudge (arrows; Shift = 10), duplicate (Alt-drag, Ctrl+D), copy/cut/paste (within and across canvases through a typed clipboard payload that carries no data, only block definitions + bindings; paste re-checks visibility), delete, lock, hide, z-order (front/back), group/ungroup, rename, replace block kind where props map (`convertBlock`, refuses when fields would be lost, naming them).
- Align and distribute (left/centre/right/top/middle/bottom; even gaps), match size, smart guides and spacing readout while dragging (grid snap stays; guides added for free pages).
- Layers panel (tree incl. containers, drag to reorder, eye/lock toggles, search).
- Command palette (Ctrl/⌘+K), shortcut sheet (`?`), right-click menu, all from `CANVAS_COMMANDS`; every command available by keyboard (accessibility rule).
- Zoom/pan (Ctrl+wheel, space-drag, fit, 100%), rulers, grid toggle.
- Undo/redo keeps the cap (raise to 200), selection restored with each step.
- Tests: selection and gesture tables, `canvas-edit.test.mjs`; harness `test:canvas-edit` (marquee, align, paste across canvases, keyboard-only authoring of a one-page dashboard).

### 48.2 — Theme and design system (track 3)
- `CanvasTheme` (`canvas/theme.ts` extended): font pair (bundled fonts only), type scale, colour roles (reuse chart roles + brand kit), spacing scale, radii, shadows, light/dark/print variants. One theme per canvas, org default, brand kit feeds it.
- `STYLE_TOKENS`: block frame styles (fill, border, radius, shadow, padding, header on/off) as tokens; a block references tokens, never raw hex, so `retheme` and print both work.
- Reusable **components**: a saved group of blocks (`CanvasComponent`, organisation/project scope, versioned). Instances follow updates; "detach" makes a copy; overrides limited to declared slots.
- Contrast check for every theme × block pair (WCAG AA, extends `CONTRAST_PAIRS`); Design check gains theme rules.
- Chart presets from Phase 47 become theme-aware: choosing a theme can restyle all chart blocks (applied as ordinary edits, undoable).
- Migration: `CanvasComponent` table (RLS forced), `Canvas.docJson.theme` optional.

### 48.3 — Parameters, interaction and drill-through (track 4)
- `PARAMETER_KINDS`: period, period range, place, group, status, indicator, project, text. A parameter has a default, allowed values (from data the viewer may see) and a scope (page/canvas).
- Control blocks (selector, slider over periods, toggle drafts-on/off, search) bind to parameters; any block may declare which parameters it reads (`BlockDefinition.params`, trait-style, no kind names).
- Existing cross-filter becomes a parameter set by a click; keep its rules (only period/place/group/status; group shows no project target).
- `BLOCK_ACTIONS`: on click → set parameter | open another page | open another canvas (with parameters) | open link in app (in-app addresses only, same rule as bookmarks) | open the underlying table. No action runs code or calls out.
- Tooltips with mini chart (model-driven, no new data path); anchored annotations/callouts on a data point (stored as text + point id; shown in files).
- Page navigation block (tabs across pages), breadcrumbs, back.
- Server: `ResolveCanvasHandler` takes `params`; viewers' choices never saved; share links honour only parameters the link allows.

### 48.4 — Pages, free layout and responsive (track 2, D1)
- `PAGE_PRESETS`: Dashboard (grid), A4 portrait/landscape, Letter, 16:9 slide, 4:3 slide, square/story social sizes, custom.
- Multi-page canvases (page strip, reorder, duplicate, per-page background and theme override); files render one page per sheet/slide.
- `FREE` mode: pixel frame with rotation and z-order; snapping to guides, to other blocks and to margins; safe-area and bleed for print.
- Auto-layout containers (row/column stack with gap, padding, wrap) that reflow when a child is "not yet reported" and collapse an empty block on screen (print keeps "Not yet reported"). Distinct from `GRID`.
- Responsive: breakpoints (desktop ≥1024, tablet 640–1023, phone <640). Default is stacking in reading order (today); per-breakpoint overrides optional. Editor previews each breakpoint.
- `canvasAsDesign` and the composer learn `FREE` frames (rotation via SVG transform); parity test with painters stays byte-for-byte where frames are unrotated.
- Migration of nothing: existing canvases are one `GRID` page. `canvasStructureProblems` gains page limits (≤40 pages, ≤400 blocks).

### 48.5 — Visual Studio shell and merge (the first plan)
- Route `/visuals` becomes the Studio: left rail **Designs · Charts · Maps · Templates · Assets**; project filter; search; scope filter; recent. Project tab "Visuals" replaces Dashboards/Infographics/Charts/Maps tabs (redirects, relative, one-time conversion as before).
- **Designs**: canvases + legacy dashboards/infographics not yet converted ("Open as canvas" kept) + portfolio designs.
- **Charts library**: `SavedChart` list (same scope rules); drop onto a canvas = a CHART block bound to the saved spec (live link or detached copy, user's choice); "Edit chart" opens Chart Studio inside a side sheet and writes back through `saveChartAction` with `expectedUpdatedAt`.
- **Maps library**: saved map specs (`RESULTS_BY_PLACE` charts already exist; add `SavedMap` only if needed for overlays/drawn areas — decide in 48.0 from the inventory) + "Edit map" hosting `MapExplorer` in a sheet; photos map and sites map as blocks (MAP kinds: RESULTS, ACTIVITIES, PHOTOS, SITES).
- **Templates**: sector templates, library-generated templates, built-in canvas templates, saved infographic templates, organisation templates; gallery, apply with role mapping, editor (TemplateEditor reused).
- **Assets**: brand kit, image library, palettes/themes, components (48.2) — one panel, one permission rule (`org.manage` for brand, `report.edit` for images).
- Every CHART kind becomes addable as a canvas block (limit "original six" removed); `AddDashboardWidgetHandler.mirrorToCanvas` generalised.
- Data Center, Report Builder, report editor get "Send to Visual Studio" (creates a library chart or a block on a chosen canvas; never duplicates data).
- One public path: `/shared/canvas/[token]` (+ embed). Legacy `/shared/dashboard`, `/shared/infographic` tokens keep resolving through a thin adapter; new links are canvas links only.
- Moves of dashboard features not yet in Canvas: tabs (→ 48.4 pages), full screen/TV mode, print, Download image, headline row on template apply, featured/pinned dashboards (Home pins accept canvases), Home arrangement unchanged.
- Infographic features: Design check panel, suggestions panel, language and RTL, publish panel parity, section infographic insertion into reports (snapshot artifact kept; source becomes a canvas export).
- Exit gate: `visual-parity.test.mts` green for every row marked batch 48.5.

### 48.6 — Collaboration without realtime (track 5, D2)
- Block comments: pinned to `canvasId:blockId` (never claim ids), one level threads, resolve/reopen, @mentions through `COMMENTABLE_ENTITIES` (add `CANVAS_BLOCK`), notifications via existing notifier (author never told, nobody twice).
- Suggest mode: edits by a reviewer without edit right are stored as a suggestion set (`CanvasSuggestion`: ops list against a revision), accepted/rejected by the owner; stale suggestions flagged.
- Visual version diff: two versions side by side with changed/added/removed blocks outlined; restore a single block from a version (not only the whole document).
- Conflict-safe save: on `expectedRevision` mismatch, 3-way merge on block ids (non-overlapping block edits merge automatically; same-block conflict asks per block). Nothing silently overwritten.
- Activity feed per canvas from the audit trail (`canvas.*` events), counts and ids only.
- Migration: `CanvasComment`, `CanvasSuggestion` (RLS forced; add to `rls.sql`, check `relrowsecurity`).

### 48.7 — Performance and accessibility (track 5)
- Render budget: virtualised blocks (render when seen, reuse `useRenderWhenSeen`), chart/map libraries load on first visible block, resolve answers streamed per block (a slow block shows its own loading line, never blocks the page), per-block error boundary (exists) with retry.
- Budgets measured by a harness: first meaningful canvas ≤2.5 s warm on the test tenant, 100-block canvas interaction frame ≤16 ms p95 during drag, editor chunk ≤ budget set in 48.0 after measuring.
- Accessibility: reading order = page order (editable), tab order follows it, every command keyboard reachable, focus ring on selection, live-region announcements for moves/aligns ("Moved to column 3, row 2"), alt-text required where `needsAlt` (Design check blocker for donor canvases), reduced motion, forced-colours support, touch targets ≥44 px under `pointer: coarse`.
- RTL: editor chrome mirrors; geography never mirrored (existing `flipBack`); free pages in RTL keep absolute frames but mirror the default insertion side.

### 48.8 — Realtime presence (only if D2 changes)
- Port `Realtime` with one adapter (decision needed: SSE from the api vs a small WebSocket service; Contabo single host, nginx in front). Presence (who is here, which block is selected), live cursors, soft block locks ("Amina is editing this chart"). Edits still go through revisions and 48.6's merge; presence never carries data.
- Off by default per organisation; no new third party; documented in the security page before anyone is told.

### 48.9 — Output and story mode (track 6)
- PPTX export from a canvas (each page = a slide; charts as images + data table in notes; text editable; uses `pptxgenjs` only if already allowed, else a small writer in `infrastructure/canvas/pptx`), XLSX of the canvas's own tables (`canvasTables(canvas)` pure; missing = empty cell; rate has no % of target; names which blocks were skipped).
- Existing PDF/PNG/SVG/PACK paths extended for pages, free frames and themes; `skipped` list stays honest.
- Story mode: ordered steps (page, highlighted block, parameter state, caption); present full screen with keyboard, share as a link (LIVE/FROZEN rules unchanged); captions are the author's words only (AI opt-in unchanged).
- Embed with a parameter allow-list (`frame-ancestors` rules decided deliberately, as noted in Phase 33.8).
- Scheduled snapshots can email a link list (reminder timer, existing notifier).

### 48.11 — Chart engine pro (catalogue and inspector)
- New kinds (rows in `CHART_KINDS`, each with shapes, refusals, a `CASES` row in `chart-render.test.mjs`, a painter for files):
  - Comparison: dumbbell, lollipop, slope (exists) with labels, grouped/stacked/100% columns and bars (horizontal variants), diverging bar, bullet (exists) with bands, marimekko, butterfly (two groups side by side, recorded breakdowns only).
  - Time: area/stacked area, step line, bump chart (rank over periods), calendar heatmap (activity days), Gantt (plan), streamgraph (exists), cycle plot, sparkline grid.
  - Part-to-whole: treemap, sunburst (exists), waffle (exists), pie/donut with "other" grouping, nested donut, parliament/hemicycle, isotype (pictogram units; rounding stated).
  - Flow and relations: sankey (budget → result, people across stages), alluvial over periods, chord (only where links are recorded), network of results chain (logframe).
  - Distribution: histogram (exists), box plot, beeswarm/dot strip, violin (only with ≥ N values, else refused), ridgeline, dot plot.
  - Progress: gauge (exists), progress rings (exists), radial progress, thermometer, KPI with target band, waterfall (exists).
  - Correlation: scatter, bubble, connected scatter, heatmap matrix, parallel coordinates.
  - Error bars and confidence bands **only from recorded interval values** (lower/upper indicators chosen by a person), never computed.
- Inspector covers every element: title/subtitle/caption/source/notes, legend (position, shape, interactive toggle), axes (min/max, ticks, gridlines, log, reversed, label rotation, number format, unit prefix/suffix), series (colour, opacity, line style/width, smoothing — off by default with a note, markers, area fill, gradient), labels (position, format, collision avoidance, show for selected only), tooltips (template fields, mini chart), sorting and Top N with "others", small multiples (facet by indicator/place/group with shared scale), reference lines/bands (target, baseline, average, median, a typed value — all labelled; no projection), annotation layer (text, arrow, highlight range, point note; stays in files), conditional colour rules (above/below target, by status), patterns for colour-blind safety.
- Number and date formatting: one formatter table (`number-format.ts` extended): decimals, thousands, compact, percent, currency, units, locale incl. Latin digits for Arabic.
- Chart recommender (deterministic): from the selected data shape and indicator types, ranks kinds that fit and says why; never recommends a kind the validator would refuse.
- All new options are `STYLE_FIELDS` rows (Phase 47 rule): validator, inspector and tests read one table; a spec with no style draws as before.

### 48.12 — Tables and maps pro
- Table block: columns chooser, reorder, width, wrap, alignment, number formats, conditional formatting (colour scale, threshold, icon sets), in-cell bars and sparklines, status pills, sticky header/first column, sort, search, paginate, totals/averages row (only additive columns sum; rates show "—"), row grouping by logframe level/place, row highlight, "Not measured" styling, export CSV/XLSX of what is shown.
- Maps: dot density (one dot = N, stated; recorded counts only), flow map (from/to where recorded, e.g. referrals, distributions), hex/tile grid map, bivariate choropleth (two indicators, legend grid), proportional symbols with legend, locator inset, label control (which levels, collision), map annotations (callout, area highlight), basemap style choice (self-hosted styles only: light, dark, muted, satellite-free), map themes following the canvas theme.
- Everything still draws only bundled or uploaded geography; a missing value is grey.

### 48.13 — Themes and typography
- Theme gallery: 60+ curated canvas themes (humanitarian-neutral, donor-report, print-minimal, high-contrast, dark, colour-blind safe…), each with light/dark/print variants, all contrast-checked.
- Theme builder: base colours → generated roles; categorical palettes (up to 12, checked for distinguishability under deuteranopia/protanopia/tritanopia simulation), sequential and diverging scale builders with midpoint, accent and signal roles; spacing, radius, shadow, chart defaults per kind.
- Brand import: pick colours from an uploaded logo in the browser (k-means over pixels), propose a theme; nothing leaves the browser.
- Fonts: 40+ self-hosted OFL/Apache fonts with scripts we serve (Latin, Arabic, Devanagari, Ethiopic, Bengali), bundled for the composer too (files must match screen); font pairing presets; text styles (H1–H4, body, caption, number, label) as tokens.
- Rich text in text blocks: bold/italic/underline, colour from theme, size from scale, lists, links (in-app or https), highlight, alignment, columns, drop cap; RTL per block.
- Licences recorded in `public/fonts/manifest.json` and the sources page.

### 48.14 — Design elements (infographic pro)
- Icon library: 2,000+ icons from permissive sets (e.g. Lucide ISC, Material Symbols Apache-2.0, OCHA humanitarian icons CC BY — credit shown), searchable by word in four languages, recolourable, as a block and inside text/KPI/table cells.
- Isotype/pictogram block: units of an icon representing a recorded figure (scale stated, rounding stated, never invents).
- Shapes (rect, circle, polygon, star, callout), lines and arrows, connectors that stay attached when blocks move, dividers, frames, badges, ribbons; fill (solid, gradient, pattern, image), stroke, corner radius, opacity, shadow, blur.
- Images: crop, mask to shape, focal point, filters (greyscale, duotone from theme, brightness/contrast), captions and credit (required for photos from evidence: confidentiality rules apply; restricted files never placed).
- Backgrounds per page/section: colour, gradient, pattern, image with overlay.
- Small blocks: QR code (to a share link or in-app address), logo strip (donor/partner logos from assets), attribution/source block, date stamp, page number.
- All elements are blocks in the registry with models and painters (screen = file).

### 48.15 — Motion and storytelling
- Entrance and emphasis animations per block (fade, rise, grow, count-up), duration/delay/easing from a small table; transitions between story steps and parameter changes (keyed by series, so marks move rather than redraw).
- Animated counter for KPI/big numbers (ends on the exact recorded figure; screen-only).
- Bar/line race over recorded periods (gaps shown as gaps; period label always visible; pause and step controls).
- Scrollytelling page: a sticky visual with text steps that set parameters/highlights (builds on 48.9 story mode).
- `prefers-reduced-motion` and a viewer toggle switch everything to the final state; files never animate; animated export to WebM (browser `MediaRecorder`) and GIF (server, one at a time, size cap), with the final frame held.

### 48.16 — Dashboard pro, templates and assistance
- Filter pane (collapsible) bound to parameters (48.3); drill hierarchies: logframe (goal → outcome → output → indicator), place (country → admin 4), time (year → quarter → month), with breadcrumb.
- Saved views: a person's parameter and filter state saved by name (per user; shareable as a link that carries only parameters).
- Threshold alerts: a person subscribes to a KPI rule ("below 50 % of target", "no value by period end"); evaluated by the hourly reminder run, delivered through `PersonNotifier` once per crossing, ids and figures only.
- Subscriptions: scheduled PDF/PNG snapshot by email (builds on scheduled snapshots), respecting each recipient's own access (rendered per recipient or refused).
- TV playlists: rotate canvases/pages with interval, auto refresh, kiosk URL (share-link rules).
- Mobile layout editor (from 48.4 breakpoints) with a phone preview.
- Templates: 120+ (sector × purpose: donor one-pager, situation report, results dashboard, finance burn, field ops, 3W, beneficiary reach, annual report spread, social card), search and filters, preview with the project's own data, org template library with versions.
- Assistance (deterministic first): chart recommender (48.11), "tidy layout" (align/distribute/equal gaps), contrast fixer, empty-state fixer ("add the missing role"), alt-text draft from the model (text summary from data, editable). Model-written words stay opt-in and grounded (Phase 45 rules).

### 48.17 — Data catalogue and live data (§2c)
- Domain: `DATA_SOURCES` registry, field metadata, `VisualQuery` validation (table-tested refusals: rate summed, currencies mixed, join not declared), calculated-field rules (reuse `validateFormula`/`evaluateFormula`).
- Application: `VisualDataService` (one read per project per source per request, reusing existing readers), `GetVisualDataVersionHandler`; data-version bump from `withWebhookEmission`-style audit wrapper (`ANNOUNCED` rows extended), no handler edits.
- Routes: `POST /v1/visual-data/query`, `GET /v1/visual-data/catalogue`, `GET /v1/visual-data/version` (all `project.view`, finer checks in the service; not on `EXTERNAL_ALLOWED`); public share-link variant under `/public/canvases/:token/data` with `ShareLinkExtras`.
- Web: Data panel (browse, search, field details, drag to canvas/block/filter), block "View data", freshness stamp, changed-figure highlight, polling hook with backoff and pause when the tab is hidden.
- Every existing block kind's `resolve` gains an optional `VisualQuery` binding; existing bindings keep working (golden docs).
- Tests: catalogue completeness (every source has fields, joins, permission, resolver), access matrix per role and for share links, live refresh harness `test:canvas-live` (save a value in the Entry Sheet stub → open canvas updates within one poll).

### 48.18 — Guided experience (§2d)
- "New" flow (what × project × template with live preview), Basics/More/Advanced inspector with option search, contextual toolbar, page strip, breadcrumbs, global search, "Ready to publish" checklist with fixes, guided publish, preview modes, first-run tour and panel empty states, magic resize (copy a design into another page preset, re-laid by rule, then editable).
- Copy in the typed catalogue (four languages), copy-lint; help links per inspector section; support articles written alongside.
- Task harness `test:studio-tasks` (the four timed tasks in §2d.10) and the 5-person moderated test, with findings recorded in `memorybank/imp/phase48-usability.md`.

### 48.10 — Retirement and cutover (detailed in §12)
- Redirect (then delete) older screens one by one, each after: parity row green, harness green, a signed-in check on the test tenant: `/projects/:id/charts`, `/projects/:id/maps`, `/projects/:id/infographics`, `/portfolio/infographics`, `/dashboards*`, the project "Dashboards" tab, `MovedToVisuals` notices, legacy share path.
- Remove dead code only when `grep` shows no importer and the parity test still passes; keep Data Center, Report Builder, Home/Overview/plan consumers.
- Docs: support articles (how to make a visual, themes, parameters, pages), `memorybank/Features/` note, INDEX, AGENTS.md invariants section "Phase 48".

## 6. Data and API summary

| Batch | Migration (additive, before code) | New routes (all in `RULES`) | `/ready` pairs |
|---|---|---|---|
| 48.17 | `ProjectDataVersion` (projectId, source, version; RLS) | `POST /v1/visual-data/query`, `GET /v1/visual-data/catalogue`, `GET /v1/visual-data/version`, `/public/canvases/:token/data` | `ProjectDataVersion.version` |
| 48.2 | `CanvasComponent` + RLS | `GET/POST/PUT/DELETE /v1/canvas-components` | `CanvasComponent.docJson` |
| 48.5 | maybe `SavedMap` + RLS (decide in 48.0) | `GET/POST /v1/saved-maps`, `POST /v1/visuals/send` | `SavedMap.specJson` |
| 48.6 | `CanvasComment`, `CanvasSuggestion` + RLS | `/v1/canvases/:id/comments`, `/suggestions` | `CanvasComment.blockId` |
| 48.9 | none | `GET /v1/canvases/:id/export?format=PPTX|XLSX` | none |

`Canvas.docJson` additions (optional): `pages[].mode|preset|theme`, `theme`, `params`, `story`, `frames.free`, `frames.breakpoints`. Contracts keep `.passthrough()` only where Phase 47 does; the canvas document is validated by `canvasStructureProblems` (extended, table-tested).
Every route that touches a project goes through the project boundary and `VisibleProjects`; no handler takes a user id; every change audited (counts and ids only).

## 7. Testing and verification

- Pure domain tables for every gesture, theme resolution, parameter binding, auto-layout, merge, story steps.
- `canvas-print-parity` kept; extended for themes and free frames; PRINT_PENDING/SCREEN_PENDING may only shrink.
- Golden documents (48.0) must read, resolve and print identically after every batch.
- Browser harnesses added: `test:canvas-edit` (48.1), `test:canvas-theme` (48.2), `test:canvas-params` (48.3), `test:canvas-pages` (48.4), `test:studio-shell` (48.5), `test:canvas-collab` (48.6), `test:canvas-perf` (48.7). Existing `test:studio`, `test:tiles`, `test:maps-extras`, `test:visuals`, `test:templates` keep passing on the new shell.
- Real-database journey: component and comment repositories, concurrent save merge (`UOW_VERIFY_DATABASE_URL`).
- Build order before tests: contracts → domain → application → infrastructure (tests run against `dist/`).
- Signed-in check on prod with the user's own account after each deploy (never store the password).

## 8. Deploy order

Batches ship independently, smallest `SCOPE` that covers the change (`both` when API and web change). Migration first (fresh backup, `prisma migrate deploy`), per-table RLS check, then `deploy-fast.sh`. No flag needed for 48.1–48.4 (editor-only, additive documents). 48.5 cutover is redirect-first behind `NEXT_PUBLIC_VISUAL_STUDIO=1` until the parity gate and the signed-in check pass; flip, then retire in 48.10. 48.8 is off by default per organisation.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Reports depend on old chart behaviour (table-derived charts rebuilt on save; Data Center charts frozen) | They stay report artifacts; Studio only inserts snapshots; approved reports never change (period lock rules untouched) |
| Free layout breaks "one model for screen and print" | Frame is the only difference; parity test over unrotated blocks; rotation covered by new painter cases |
| Document growth breaks old canvases | Optional fields, golden fixtures, `contentHash` unchanged for unchanged content |
| Editor chunk size and drag performance | Budgets measured in 48.0/48.7; marquee and guides use pure functions over box lists, no DOM measuring per move |
| Merge bugs lose edits | 3-way merge only on non-overlapping block ids; otherwise ask; versions keep the replaced document |
| Library link vs copy confusion | Dropped chart/component says "linked" or "copy" on the block; updating a linked source shows what changes before it applies |
| Translations are drafts | Typed catalogue keeps four languages; native review still owed before claiming support |
| Scope creep | Batches ship alone; 48.8 and 48.9 optional; parity gate is the only mandatory cross-cutting item |

## 10. Order and sizing (rough, one developer + agent)

48.0 (1) → 48.17 data catalogue and live data (6) → 48.1 (4) → 48.2 (3) → 48.13 themes and typography (4) → 48.3 (4) → 48.4 (5) → 48.11 chart pro (8) → 48.12 tables and maps pro (6) → 48.14 design elements (6) → 48.5 shell and merge (6) → 48.18 guided experience (6) → 48.16 dashboard pro and templates (8) → 48.15 motion (4) → 48.6 (4) → 48.7 (3) → 48.9 (3) → usability test and fixes → 48.10 (2); 48.8 later. About 87 working days. Data comes first so every later block is built on the catalogue; the guided experience lands with the shell so the merged Studio opens already easy to use. Sizes are estimates, not commitments. Start 48.1 in parallel with 48.0 once the golden documents exist. Batches are ordered so the editor and themes exist before content grows, and the shell merge comes after the pro blocks so the Studio opens with them.

Budgets that grow with the catalogue (measured in 48.0, enforced in 48.7): icons, fonts and chart kinds load on demand (no first-bundle growth); the composer bundles only the fonts a document uses.

## 11. Points settled (owner agreed 2026-11-09) and still to measure

1. No `SavedMap` table: map specs stay saved charts (`RESULTS_BY_PLACE` and new map kinds); overlays and drawn areas stay project places/overlays.
2. Realtime (48.8, later): SSE from the api, behind a per-organisation switch.
3. PPTX: small in-house writer in `infrastructure/canvas/pptx` (no new licence, size under control).
4. Legacy dashboard/infographic share tokens keep resolving through the adapter; no re-issue.
5. Still to measure in 48.0: bundle and timing budgets; icon/font licence list confirmed file by file before shipping.

## 12. Legacy removal and refactor plan (owner requirement 2026-11-09)

Rule: **nothing is removed until it is moved, linked and proven unused; nothing that moved is kept.** Removal is not one big batch at the end: each batch that moves an element ends with its own removal step (§12.3), and 48.10 only removes what is shared across several of them.

### 12.1 Register of what retires
`memorybank/imp/phase48-retirement.md` holds one row per item: `item | replaced by | batch moved | redirect until | removed in | proof`. Initial rows (complete in 48.0 by grepping routes, imports, server actions and API routes):

| Layer | Items |
|---|---|
| Web routes | `/dashboards`, `/dashboards/[id]`, `/dashboards/templates`, `/dashboards/templates/[id]`, `/projects/[id]/charts`, `/projects/[id]/maps`, `/projects/[id]/infographics`, `/projects/[id]/infographics/[designId]`, `/portfolio/infographics`, `/portfolio/infographics/[designId]`, `/shared/dashboard/[token]`, `/shared/infographic/[token]`, `/embed/dashboard/[token]` |
| Navigation | nav key `DASHBOARDS` ("Older dashboards"), project tabs Dashboards and Infographics, links to Chart Studio/Maps from Data Center and Report Builder pages, `MovedToVisuals`, `OpenAsCanvasButton` and the "older" list on `/visuals`, portfolio "Infographics" button |
| Web features | `features/dashboards/presentation/*` (DashboardView, DashboardCanvas, Add*Panel, EditWidgetPanel, DashboardTabs, TemplateGallery/Editor, PublicDashboard, use-tv-mode), `features/infographics/presentation/*` (InfographicsList, InfographicStudio, studio/*), `features/charts/presentation/ChartStudio` page shell (editor core kept as hosted block editor), `features/maps` page shell (MapExplorer kept as hosted editor), `features/data-center/presentation/DataChartBuilder`, `report-editor/.../DataChartsPanel` and `reporting/ReportChartPanel` (replaced by "insert from library"), legacy server actions in `lib/actions/{dashboards,infographics,data-charts,map-widgets,charts}.ts` and schemas in `lib/server/schemas-*` |
| API routes | `/v1/dashboards*`, `/v1/dashboard-preview`, `/v1/dashboard-templates*`, `/v1/projects/:id/infographics*`, `/v1/projects/:id/infographic-data`, `/v1/report-sections/:id/data-charts*`, `/public/dashboards/:token*`, `/public/infographics/:token`; matching `RULES` and `EXTERNAL_ALLOWED` entries |
| Application/domain | dashboard handlers (`dashboard-handlers.ts`, `PreviewDashboardChartsHandler`, `ApplyDashboardTemplateHandler`, `AddDashboardWidgetHandler.mirrorToCanvas`), infographic handlers, `to-widgets.ts` (canvas → widget bridge, once blocks resolve through the catalogue), `legacy/` converters (kept until §12.5 data step is done), widget layout helpers used only by dashboards |
| Infrastructure | dashboard/infographic repositories, infographic composer paths superseded by canvas painters (`PRINT_PENDING`/`SCREEN_PENDING` reach empty), duplicate share-link resolvers |
| Data | tables `Dashboard`, `DashboardShareLink`, `DashboardTemplate`, `FeaturedDashboard`, `ProjectInfographic`, `InfographicExport`, `InfographicShareLink`, infographic brand/asset/template tables (moved to the Assets library), `SavedChart` stays (it is the Charts library) |
| Tests and harnesses | harnesses for retired screens (`test:tiles`, `test:templates`, `test:maps-extras`, infographic studio) are **ported** to the Studio first, then the old ones deleted; unit tests of deleted code deleted with it |
| Docs | support articles (dashboards, infographics, chart studio, maps, data center charts), `Features/*` notes, AGENTS.md phase sections that describe retired surfaces (marked "superseded by Phase 48", not deleted: they are history), `/platform` and marketing copy, glossary/FAQ |

### 12.2 Gates before an item may be removed (all must hold)
1. Parity rows for everything it did are green (§3 test).
2. Its harness checks pass against the Studio replacement.
3. Signed-in check on the test tenant after deploy.
4. **Zero traffic**: the redirect logs an audit-free counter (`legacy_route_hit`, route name only) for one release cycle (min. 14 days); hits from people are followed up, not ignored.
5. **Zero importers**: dead-code tooling (§12.4) reports no reference outside the item and its own tests.

### 12.3 Steps per element (end of the batch that moves it)
1. Point every in-app link to the Studio (grep for the old path; a test fails on any `href` to a retired route — `legacy-links.test.mts` reads the register).
2. Replace the page with a **relative** redirect carrying the ids (`/projects/:id/charts?chart=x` → `/visuals?project=:id&library=charts&open=x`).
3. Keep the API route answering for one release (old clients, open tabs) with a `Deprecation` header; then remove the route, its `RULES` entry and its coverage-test row.
4. Delete the presentation, actions, schemas, handler and repository once §12.2 holds; delete their tests; update the architecture tests' allow-lists.
5. Remove copy keys from the four catalogues (`i18n` test catches unused keys after we add that check).
6. Update docs in the same commit.

### 12.4 Tooling (added in 48.0)
- `knip` (or `ts-prune`) for unused exports/files/dependencies across the workspace, run in CI as a report and as a **failing** check for paths listed in the register once marked "removed".
- `legacy-links.test.mts`: no source file links to a retired route; no import of a retired module.
- Route test: `authorization-coverage` already fails a route without a rule; extend it to fail a rule whose route no longer exists (no dangling `RULES`).
- Unused i18n keys check; unused CSS class check (extends `css-classes-defined.test.mts`); unused dependency check (echarts stays, html-to-image may go if canvas download replaces it).
- Bundle report before/after each removal (first-load size must not grow).

### 12.5 Data retirement (the only irreversible part)
1. **Convert all**: a one-off job converts every remaining `Dashboard` and `ProjectInfographic` to a canvas (the existing once-only `legacyDashboardToCanvas` / `legacyInfographicToCanvas`), copies share links (token hash kept, so old links keep working through the canvas path), featured/pinned dashboards → canvas pins, templates → Studio templates, brand/assets → Assets library. Dry run first, report per organisation, run after a fresh backup.
2. **Freeze**: old tables become read-only for `donordesk_app` (revoke INSERT/UPDATE/DELETE in `rls.sql`) for one release.
3. **Verify**: counts match, every converted canvas resolves and prints (golden check over a sample per tenant), no read of old tables in logs.
4. **Archive and drop**: export old rows to the encrypted backup, then a migration drops the tables; `/ready` pairs, `ORG_EXPORT_EXCLUDED`, `rls-coverage` and the organisation export updated in the same release. Immutable exports (`InfographicExport` files in storage) are moved to `CanvasExport`, never deleted.
5. Remove `legacy/` converters and the "Open as canvas" bridge last.

### 12.6 Order
Element removals ride with their batches: Chart Studio page (after 48.5), Maps page (48.5), dashboards screens and templates (48.5 + 48.16), infographic screens and assets (48.5 + 48.14), Data Center/report-editor chart panels (48.5), separate share paths (48.9). 48.10 then does: data retirement (§12.5), API route removal after the deprecation release, tooling made failing for the whole register, docs sweep, final bundle and dead-code report. Phase 48 is not "done" until the register has no row without "removed" or a written reason to keep.

## 13. Final-review additions (2026-11-09)
- **Parity rows also cover consumers that stay outside the Studio**: Home panels and portfolio map, project Overview sections, plan Timeline/Gantt/Map, logframe indicator charts, report-section table-derived charts, Data Center "By place", entry-sheet stoplight. They adopt the Studio's chart builder, theme tokens and number formats (48.13) so they never look different; a parity row each.
- **Public endpoints**: `/public/canvases/:token/data` and any animated-export route get nginx rate limits (zones like `dd_public_dashboards`, copies in `infra/nginx/`) and a security review before 48.9 ships.
- **Translations**: every new label goes into the four catalogues; a native review (Arabic first) is owed before anyone is told the Studio is available in those languages.
- **Done means**: §3 parity test, §2b benchmark rows, §12 register and the usability findings all closed.

## 14. Build log (2026-11-09, unattended session)
Built and tested (all in the working tree; 48.0, 48.17 and 48.1 are DEPLOYED, `releaseId=20261109151917`):
- **48.0** registers + `visual-parity.test.mts` + 59 golden canvases.
- **48.17** `visual-data/` (catalogue, query rules, calculated fields, `shapeTable`, sheet/extras row mappers, versions, `table-format`, `alerts`), `VisualDataService` + readers (sheet-backed: indicator values, breakdowns, periods; extras-backed: plan, activities, spending; other sources answer "being connected"), 3 routes, Data panel, live polling hook, freshness stamp.
- **48.1** selection, multi-block gestures, clipboard, command table, palette (⌘K), shortcut sheet, layers panel, marquee, zoom/grid view state, kind conversion; 200-step history; four-language copy.
- **Domain only (tested, not yet drawn by the screen or saved by the API except where noted)**: theme-kit (60 themes x 4 tones — the theme and tone pickers ARE wired; fonts manifest; frame tokens; components), params + actions (contracts and persistence of `params`, block `action`, `paramBindings`, `free`, `component`, frame tokens, page `mode/size/background/themeId` added to the save schema so nothing is stripped), pages/free layout/breakpoints, diff + merge, motion + story steps, table formatting.
Not started: 48.5 shell merge and library panels, 48.7, 48.9 PPTX/XLSX, new chart kinds (48.11), new map kinds (48.12), icons/shapes/images (48.14), motion on screen (48.15), filter pane/templates/TV (48.16), guided flows (48.18), 48.10 removals. Fonts other than Liberation Sans and Noto Sans Arabic are listed in the manifest as `bundled: false`: no font files were added.

### 14.1 Session of 2026-11-10 (signed-in browser pass, shell, alerts)
- **Browser check on production** (education project, tenant mnpiracha@gmail.com, visible Chromium): `/visuals` lists the canvases; the M&E dashboard opens in the editor; the Commands palette lists the arrange commands (disabled with nothing selected, as designed); the Look selector offers 68 looks with Tone light/dark; Layers, the block library and the page tabs show. No console errors. Open findings: choosing a Look changes the frame and text colours but the bar chart keeps its own blue (chart series colours are not yet taken from the theme); the "Places compared" table shows the same figure for every county (demo data split evenly, not a defect of the table).
- **48.5 (part)**: Visual Studio tabs (Designs, Charts, Maps, Templates, Alerts) on `/visuals`, a project filter, and the Charts and Maps tabs listing what exists with a way into the unchanged Chart Studio and project Maps. Not yet merged into one editor: the Chart Studio and map explorer still open on their own pages.
- **48.16 (part)**: threshold alerts. `DataAlert` (RLS forced, migration `20261112090000_data_alerts`), `alertInputFromSheet`/`describeAlert` (domain), `AddAlertHandler` (reads the sheet as the caller, 30 per person), `RunDataAlertsHandler` (reads each alert as its owner, tells once per crossing through `PersonNotifier`, type `DATA_ALERT`), routes `GET/POST/DELETE /v1/visual-data/alerts` and `POST /internal/data-alerts/run` (called by `scripts/run-reminders.sh`; install the updated script on the host by hand), the Alerts tab. `/ready` requires `DataAlert.ruleKind`.
- Still not built: see §14 (not started list) minus 48.5 tabs and alert delivery.
- **48.11 (part, deployed `20261110093625`)**: `PARLIAMENT` (100 dots by largest remainder), `PROPORTION_BAR`, `SMALL_MULTIPLES` (own scale per panel, exempt from the one-axis units rule) in `chart-render-kinds-shares.ts`; names in four languages; seen in the Chart Studio on prod. Still not built: marimekko, sankey variants, alluvial, chord, beeswarm, violin, ridgeline (they need two-dimension or sample data the sheet does not carry).
- **48.18 (part, deployed)**: guided start on `/visuals/new` (`GOALS`, `suggestRoles`: an indicator is offered for a role only when they share a word, never reused). Still not built: first-run tour, empty-state coaching inside the editor.
- **Decided not to start without the owner**: icon/shape/image blocks (a new block kind touches the composer, painters, print registry, golden hashes and four catalogues), map kinds (dot density, flow, hex grid, bivariate need new geography handling), fonts (licence and file bundling), PPTX/XLSX data tables.
- **48.14 (part, deployed `20261110101701`)**: `SHAPE` (rectangle, rounded, ellipse, line, arrow) and `ICON` (the infographic icon set) as canvas blocks: theme colours only (`ToneName`), decorative unless described, a section type each so they print (`paintShape`, `paintIcon`), screens `ShapeScreen`/`IconScreen`, four-language names, entries in the Studio's block table. Seen on prod in the editor (unsaved). `IMAGE` already existed. Still not built: free-colour fills, image backgrounds, an icon picker with search, group/ungroup of shapes into one symbol.

### 14.2 Completion pass (2026-11-10, written before the final test and deploy run)
Built, then verified together at the end (see §14.3 for the result):
- **KPI tiles follow the page's Look** (`CanvasBlockView` sets `--viz-1/--viz-2` from the theme).
- **48.5 merge**: `ChartStudioPanel` and `MapStudioPanel` (server components) are drawn by both the project pages and `/visuals/charts/[projectId]`, `/visuals/maps/[projectId]`; the heavy tools load lazily (`LazyStudios`); tabs Designs, Charts, Maps, Templates, Alerts, TV. The project routes stay (redirect only after 14 days of no traffic, per the retirement rule).
- **48.7**: lazy loading of the chart library and map engine, visible focus on the tabs, role=status on loading and alerts. No numeric budget was measured in this pass.
- **48.9**: Present mode (browser fullscreen, arrows/PageUp/PageDown/space, Esc), `/embed/canvas/[token]` plus embed code in Share and publish (nginx zone added in `infra/nginx/…conf_apiv1`, install by hand), "Download data" as `.xlsx` (`POST /v1/canvases/data-workbook`, `BuildDataWorkbookHandler`, `ExcelTablesWorkbookWriter`: the tables the person already sees, a gap stays empty, text stays text, counts-only audit) and `.csv` (browser, formula characters defused).
- **48.11**: `PARLIAMENT`, `PROPORTION_BAR`, `SMALL_MULTIPLES`. Not built, with the reason: ridgeline (offset series would make the data table show wrong figures), marimekko, alluvial, chord, beeswarm, violin (need two-dimensional or sample data the sheet does not hold).
- **48.12**: `DOT_DENSITY` and `HEX_GRID` (pinned places only, units stated, no addition across levels where they can be told apart). Not built: bivariate (needs two indicators by place in the dataset) and flow maps (no origin-destination records).
- **48.13**: five font families bundled (Lato, PT Sans, PT Serif, Fira Sans, Poppins; regular and bold, OFL, licence files beside them); `bundled: true` in the domain table, files registered for PNG and PDF (`bundled-fonts.ts`); a test pins the two lists together. Italic uses the regular face.
- **48.14**: `SHAPE` and `ICON` blocks (earlier this session).
- **48.15**: no new motion code; the existing style animation and Present mode respect reduced motion. Counter/race animations (`motion.ts`) remain domain-only: they need per-block settings storage that was not added.
- **48.16**: Filters button opens the filter pane on any live page; TV playlist (`/visuals/tv`, up to 8 canvases, 10-300 s each, refresh every 5 min, wake lock where allowed); threshold alerts (earlier); 3 more starter layouts per sector (donor one-pager, flash update, monitoring page: well over 120 starters in all). Not built: drill hierarchies (needs a new filter dimension in the resolve path), email subscriptions to a canvas (needs attachments in the mail port).
- **48.18**: guided start (earlier) and a five-step first-run tour in the editor (`EditorTour`, once per device).
- **Not done on purpose**: 48.10 removals (the 14-day no-traffic rule and the owner's redirect-first decision), realtime presence (deferred by decision).
