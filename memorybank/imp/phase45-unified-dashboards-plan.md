# Phase 45 — One Canvas: unifying Dashboards and Infographics (audit + plan, 2026-11-06)

Status: PLAN ONLY — owner decisions recorded in §8 (2026-11-06). Nothing built. Sources read: AGENTS.md (Phases 31, 32, 33.8, 34.0–34.3, 35, 39, 40), `phase32-infographic-studio.md`, `phase39-enh-dashboards.md`, and the code listed in §1.

## 1. Audit — what exists today

### 1.1 Two products that are the same thing
| Aspect | Dashboards (Phase 33.8 → 39) | Infographics (Phase 31 → 32) |
|---|---|---|
| Stored as | `Dashboard.widgetsJson` — `DashboardWidget[]` on a 12-col grid with x/y/w/h, tabs | `ProjectInfographic.configJson` — `InfographicConfig.sections[]`, ordered flow with `span`, rows packed by `packRows` |
| Block model | `kind` = CHART, TEXT, REPORT, KPI, METRIC, MAP, PROJECT_LIST + one optional field per kind (`kpi?`, `map?`, `metric?`…) on one fat interface | `InfographicSectionKind` = 30 string kinds (KPIS, HERO, FUNNEL, THREE_W, PORTFOLIO_*…) + one fat `InfographicSectionConfig` bag |
| Data binding | `DatasetQuery` / `resolveDataset` / `buildChart` (one sheet read per project) | `BigNumberSource` enum, `StoryFacts`, `ProjectInfographicDataDto`, own `facts.ts`; charts via legacy `buildDataChart` |
| Renderer | Browser: ECharts + React tiles (`WIDGET_RENDERERS` registry — good) | Server: SVG composer (`composer.ts` switch, 30 `case`s) → resvg PNG / svg-to-pdfkit PDF |
| Templates | `DashboardTemplate` with *roles* mapped to indicators; 6 sector built-ins + org copies (`DashboardTemplate` table) | 17 built-in `InfographicTemplate`s in code + `InfographicUserTemplate` |
| Theme / brand | `--viz-*` tokens, light/dark only. No brand kit, no per-dashboard theme | `theme.ts` (≥7 themes), `InfographicBrandKit`, fonts, icons, assets library |
| Languages | 4-language UI, but dashboard *content* is not per-language | en/fr/es/ar designs, RTL, UN map disclaimers |
| Governance | Scope ORG/PROJECT/MINE, featured, pinned; no review workflow | DRAFT → IN_REVIEW → APPROVED, Design check (lint), publish gate, immutable `InfographicExport` with snapshot + provenance |
| Sharing | `DashboardShareLink` (live data, expires) + embed | `InfographicShareLink` (one immutable export) |
| AI | Narrative sentence under KPI (rule-based, no model) | `ai-text.ts` headline/messages from `StoryFacts`, grounded, opt-in; presence-row suggestion |
| Interactivity | Hover, cross-filter by period, drill, maps (MapLibre, 41), low-data mode | None (static picture); preview only |
| Export | Browser `html-to-image` PNG + print | PNG@1×–3×, SVG, vector PDF, per-section PNG, report insertion snapshot |
| Layout editing | drag/resize on grid, keyboard | reorder/span only; page formats (A4/A3/slide/social) |

### 1.2 Duplicated concepts (each is a future bug)
Two block unions, two templates registries, two data-binding vocabularies (`DatasetQuery` vs `BigNumberSource`/`StoryFacts`), two chart paths (v2 `buildChart` vs legacy `buildDataChart` used by infographics), two share-link tables, two editors (`EditWidgetPanel` vs `BlockEditor`), two permission/visibility rule sets, two preview pipelines (React vs SVG; the infographic invariant "if preview and export diverge, the composer is wrong" shows the cost), two "KPI tile" implementations (`kpi.ts` vs `bigNumbersBlock`), two map implementations (MapLibre/ECharts vs `blocks-map.ts`), two text blocks, two "table" blocks (`REPORT` widget vs `TABLE` section).

### 1.3 SOLID findings
- **S (single responsibility)** — `application/use-cases/infographics/studio.ts` is 735 lines with 22 exports (AGENTS.md's own architecture test says ≤300 lines, one class per file; the test covers maps/Record/wizard, not these). `blocks-new.ts` 566, `BlockEditor.tsx` 508 (19 kind branches), `composition.ts` 520 (types + validation + defaults in one file). `InfographicStudio.tsx` 433.
- **O (open/closed)** — Dashboards: the widget registry is right (a new kind = a row in `WIDGET_RENDERERS`), but `widgetProblems` in `dashboard.ts` has 12 kind branches, `drawCharts` in `dashboard-handlers.ts` branches on kind, `EditWidgetPanel` has 7, `AddTilePanel/AddMapPanel/AddNotePanel/AddProjectListPanel` are four near-copies. Infographics: `composer.ts` `switch` (30 cases), `lint.ts` 7 branches, `BlockEditor` 19 branches. A new block touches 5–7 files in each product.
- **L (Liskov)** — `DashboardWidget` and `InfographicSectionConfig` are "one interface with N optional fields": any kind can be constructed with the wrong fields and only validation catches it; consumers cannot rely on a kind's contract. A discriminated union or per-kind `BlockSpec<K>` is needed.
- **I (interface segregation)** — Renderers receive the whole `ChartDrawing`/`RenderCtx` (everything the dashboard or page knows) instead of the slice they need. `IDatasetExtras` is one wide port (plan, activity days, budget, places, finance, visible projects, bookmarks).
- **D (dependency inversion)** — Mostly good (ports in `application/ports`, adapters in infrastructure, `composition.ts` for maps). Violations: the web studio imports domain subpaths directly for preview twin logic (`studio-view.ts` re-implements the composer's slots — documented "twin" risk); `composer.ts` imports concrete block functions rather than a `BlockRenderer` registry.
- **Honesty rules are already shared** (missing ≠ 0, rates never summed, units never share an axis, drafts counted, no finance on a link). These are the asset to preserve: the unified model must route *every* figure through `resolveDataset`.

### 1.4 Gaps against "state of the art"
Dashboards lack: brand themes, page formats/print/PDF/PPTX export, scheduled snapshots, immutable publish, review workflow, Design check, AI-written blocks, image/quote/timeline/funnel/pyramid/3W/funding/results-chain/hero blocks, per-widget conditional formatting, filters bar (global + per-widget), parameters, drill-through, annotations, comments on a widget, version history, translation of authored text, widget-level edit for charts (rebuild in Studio only), a container/section layout (rows, columns, tabs-within), responsive breakpoints authored by the user, undo/redo, duplicate, lock, template "save as" from a live dashboard, snapshot email/subscription.
Infographics lack: interactivity, live data mode, drag-and-drop grid, global filters, cross-filtering, drill, MapLibre maps, the Chart Studio kinds (they use legacy `buildDataChart` → only six chart types), KPI change/status/narrative from Phase 39, tiles for plan/finance, saved-chart reuse, inline edit of a data-bound figure, org default templates.

## 2. Reference products and what to borrow
| Product | Borrow |
|---|---|
| **Datawrapper / Flourish** | Opinionated chart defaults that refuse misleading charts (we already do); annotation layer; "River" of templates with live preview; one-click responsive previews at 3 widths |
| **Infogram / Canva / Piktochart** | Page canvas with formats, drag-drop blocks, brand kit, icon/photo library, social variants from one design, template gallery with search/filter by family |
| **Power BI / Tableau** | Report pages (tabs), filter pane (page/report/visual level), drill-through, bookmarks, tooltips pages, conditional formatting, "Q&A" natural-language |
| **Looker Studio / Metabase / Superset** | Simple grid editor, dashboard-level filters + parameters, scheduled email of PDF, embed with signed params, SQL-less question builder (our `ReportQuery`) |
| **Grafana** | Repeating panels (one chart per project/place), kiosk/TV mode (we have `use-tv-mode`), panel JSON for diff/version, annotations on time series |
| **Observable / Evidence.dev** | Text-with-inline-live-numbers ("**12,430** people reached, up 8%"), data-driven narrative |
| **Notion / Mode** | Block-based document that can host charts, text and tables in one flow (the "story" mode) |
| **OCHA / UNICEF / IOM DTM snapshots** | Humanitarian conventions already encoded in the Design check |

## 3. Target design — one Canvas

### 3.1 Vocabulary
**Canvas** (a saved page set) → **Pages** → **Layout** (grid cells, or a flow of Rows/Columns) → **Blocks**. A *dashboard* is a Canvas with `mode: LIVE` (interactive, data read at open). An *infographic* is the same Canvas with `mode: PUBLISHED` (frozen export). Same document; "Publish" freezes it. "Dashboards" and "Infographics" remain as two *entry points / filters* in navigation so nobody loses their place; one engine underneath.

### 3.2 Core model (domain, pure)
```
Canvas { id, scope, title, mode(LIVE|PUBLISHED_ONLY), pages[], theme: ThemeRef, format: FormatRef,
         language, filters: FilterDef[], parameters: ParamDef[], status, revision }
Page   { id, title, format, layout: GridLayout | FlowLayout, blocks: BlockInstance[] }
BlockInstance<K> { id, kind: K, bounds{x,y,w,h,breakpoints?}, props: PropsOf<K>, bindings: Binding[], style: BlockStyle, a11y{alt,desc} }
```
- `BlockInstance` is a **discriminated union generated from a registry**, never optional-field bags.
- **Bindings** replace `BigNumberSource`, `StoryFacts`, `kpi.indicatorId`, etc.: every block declares data as `Binding = DatasetQuery | ReportQuery | ManualValue(with sourceNote) | AiDraft`. One resolver (`resolveDataset`) and the existing honesty rules apply to all.
- **Theme** = existing infographic `theme.ts` + brand kit + viz tokens merged into one `Theme` table (palette, fonts, radii, card style, banner style, dark variant). Dashboards get brand themes; infographics get dark mode.
- **Format** = existing `formats.ts` (A4/A3/Letter/slide/social/web-fluid). `web-fluid` is the dashboard default.

### 3.3 The Block registry (the heart of SOLID)
One file per block under `contexts/canvas/blocks/<kind>/`, each exporting a single `BlockDefinition<K>`:
```
BlockDefinition<K> {
  kind: K; family; label(copy key); icon;
  schema: PropsSchema<K>; defaults(): PropsOf<K>;
  validate(props, ctx): Problem[];            // domain, pure
  lint?: LintRule[];                           // Design-check rules owned by the block
  bindingSlots: SlotDef[];                     // what data it accepts (shapes, min/max, additive-only…)
  resolve(bindings, dataset, ctx): BlockModel<K>;   // pure: data → view-model (null = gap)
  sizes: { min, max, default, aspect? };
}
```
Per-surface adapters register against the same `kind` (Interface Segregation — each adapter sees only `BlockModel<K>` + theme + size):
- `ScreenRenderer<K>` (React, interactive) → `registerScreen(kind, Component)`
- `PrintRenderer<K>` (SVG string, deterministic) → `registerPrint(kind, fn)`
- `Inspector<K>` (edit form) → `registerInspector(kind, Component)` built from `schema` by default; custom only when needed
- `AiAssist<K>?` (optional proposal provider)

A block with no `PrintRenderer` is *refused for publish with a plain sentence* (not silently dropped). A test walks the registry: every block has schema, defaults, validate, ≥1 renderer, one lint-table row, one copy key per language, one fixture. **Adding a block = one folder + three registry lines; no edits to the canvas, composer, editor, handler or linter.**

### 3.4 Renderer strategy (kill the twin)
Single **view-model** (`BlockModel`) feeds both targets. Print path stays server-side SVG (deterministic, no browser). To remove the preview/export divergence: the Studio preview of a PUBLISHED-mode page *is* the composer's SVG (as Phase 32 intended), while LIVE mode uses React. Both consume the same `BlockModel`, so figures, gaps, rounding and notes cannot differ; only paint differs. Charts: `buildChart` (v2) for both; the legacy `buildDataChart` path is retired from infographics via `migrateChartSpec`.

### 3.5 Block catalogue (every block fully functional, all editable)
Group → block → key edit options. "Live" = interactive on screen; every block also prints.
- **Text & story**: Heading, Rich text (markdown subset, inline **live numbers** `{{ind:CODE.latest}}`), Key messages, Quote/story card (consent flag), Callout/annotation, Divider/spacer, Banner, Hero/cover (image, logos, period). Options: font role, size scale, alignment, colour role, icon, bullet style, language variants.
- **Numbers**: KPI tile (existing: change, status, narrative, sparkline, target ring, colour), Big-number row, Metric tile (money/activities), Progress rings/bullet, Gauge, Comparison (this vs previous / vs target), Stat with sparkline. Options: indicator/binding picker, rounding rule (nearest 100/1,000, "over"/"about"), unit/prefix, trend arrow, thresholds → colour (conditional formatting), caption, source note.
- **Charts** (all `CHART_KINDS`): bar/column/stacked/grouped, line/area/step, combo (dual axis w/ titled y2), pie/donut/waffle, scatter/bubble, heatmap, funnel, waterfall, bullet, radar, treemap/sunburst, Sankey (flows), pyramid (sex × age), distribution/box, small multiples, timeline/Gantt. Options: the Chart Studio's full inspector embedded as the block inspector (data, series colours, highlight series, direct labels, annotations, reference/target lines, axis rules, number format, sort, top-N, alt text). **One inspector component for Studio, dashboard and infographic.**
- **Maps**: Results choropleth (drill admin 1–4), proportional symbols, activity pins by delivery state, photo map, 3W by area, inset/region focus, overlays, drawn shapes. Options: indicator, level, classes (quantile/equal/manual), legend, disclaimer (auto by country), basemap on/off, period slider.
- **Tables & lists**: Data table (saved report; conditional formatting, sparklines in cells, totals, CSV), Project list, Plan/Gantt list, Risks list, Evidence/Photo gallery, Checklist/needs-you, 3W matrix, Results chain, Sector grid, Funnel (people in need → targeted → reached), Funding (requirements/received/coverage), Logframe tree.
- **AI blocks** (all opt-in, `AiAssist`, grounded, labelled "AI-drafted until accepted", never saved by themselves; redacted in, figures verified out, per Phase 33.9/32.8b rules):
  - *Summary* (what changed this period), *Key messages*, *Chart caption*, *Alt text*, *Anomaly callouts* (deterministic detector decides, model only phrases), *"Ask this dashboard"* box (Phase 33.9 grounded Q&A bound to the page's datasets), *Suggested next block* (layout suggestion from data actually present), *Translate authored text* (EN/FR/ES/AR; numbers verified unchanged), *Auto-list* (e.g. "top 5 districts behind target" — computed deterministically, the model only words it). Dropped-sentence counts are shown.
- **Media**: Image (crop/focal, credit, consent), Logo strip, Icon, Embed (read-only HTML snapshot URL, allow-listed).
- **Containers**: Row/Column group, Tab group, Collapsible, Repeater (one block per project / place / sector from a list — Grafana repeating panels).
- **Controls** (LIVE only; print shows current selection as text): Filter bar (period, project, place, sector, status), Parameter select, Toggle drafts, Compare-to selector.

### 3.6 Editing model (one editor for everything)
Three-pane editor: **Outline/Pages** (left), **Canvas** (centre), **Inspector** (right, tabs: Data · Style · Rules · Accessibility · Source).
- Direct manipulation: drag/resize on 12-col grid with snap, align/distribute, keyboard parity (arrows/shift-arrows), multi-select, group, lock, duplicate, copy/paste between canvases, undo/redo (50 steps, one edit = one step), autosave drafts, conflict via `expectedUpdatedAt`.
- Breakpoints: desktop / tablet / phone layouts authored (default = auto-reflow by reading order; override per block). Print formats re-flow with a "does it fit" check.
- Inline edit: click text/number to edit; data-bound figure click → binding popover.
- Conditional formatting & thresholds as a rule table per block (`value op threshold → colour role + label`), never colour-only (icon/word included).
- Version history (last N, diff by block, restore) — generalises `SavedChart.versionsJson`.
- Comments per block (`COMMENTABLE_ENTITIES` row) and review workflow (DRAFT → IN_REVIEW → APPROVED → PUBLISHED, `checkApprover` reuse).
- Template tools: gallery with family/sector/format filters + search, preview with sample data, apply with role→indicator mapping (existing `suggestRoleMapping`), "Save as template" from any canvas (org, versioned; basedOn), "Update from template" diff.

### 3.7 Templates unified
One `CanvasTemplate` = roles + pages + blocks + theme + format + profile. Migrate:
- 6 sector dashboard templates → CanvasTemplates (mode LIVE, format web-fluid).
- 17 infographic templates → CanvasTemplates (format A4/slide/social; PUBLISHED-capable).
- **New** to reach "all templates fully functional as dashboards": every infographic template also runs LIVE (its blocks are interactive); every sector dashboard template can also publish to PDF/PNG. Families: Snapshot, At-a-glance, Funding, Sector results, 3W, Beneficiary profile, Flash update, Donor one-pager, Annual poster, Factsheet, Social set (1:1/4:5/9:16 variants of one canvas), Slide pages, Results chain, Portfolio overview, Management, Field-ops (phone-first), Donor-portal (read-only), Data-quality, Finance burn, M&E review.

### 3.8 Data, filters, interaction
- **Global filter bar** → `FilterDef` bound to dataset dimensions (period, project, place level/area, sector, status, drafts toggle). Each block declares which filters it honours (`bindingSlots`); the inspector shows "responds to: period, place".
- **Cross-filter** generalises today's period-only click: place, group, status (the AGENTS.md "not built" item). Rule: only dimensions the block's binding actually carries.
- **Drill-through**: click a block → opens its data table / the Data Center / the source record (links only; the canvas never writes — preserves the Overview invariant).
- **Live vs frozen**: LIVE reads on open under the viewer's access. Publish = snapshot of resolved `BlockModel`s + provenance (existing `InfographicExport` generalised to `CanvasExport`); share links: LIVE link (current `DashboardShareLink`, `ShareLinkExtras` rules) or FROZEN link (current `InfographicShareLink`). One `ShareLink` table with `kind`.
- **Scheduled snapshots / subscriptions**: weekly/monthly PDF to named people through the existing hourly reminder runner; each run creates a new immutable export (never edits one).

### 3.9 Governance (keep, then widen)
Design check (lint) becomes block-owned rules + canvas rules; profile (`SNAPSHOT`, `DONOR_REPORT`, `SOCIAL`, `INTERNAL`, + `LIVE_INTERNAL`) selects which apply. Publish gate unchanged. Safeguarding rules (photo consent, small cells) apply to LIVE share links too. Writers never receive canvas fields (existing invariant); `ReportSection` insertion stays a snapshot artifact.

## 4. Architecture (SOLID, enforced by tests not trust)
```
domain/contexts/canvas/
  canvas.ts            Canvas/Page types only (<150 lines)
  layout/              grid.ts, flow.ts, breakpoints.ts, settle.ts (pure; reuse settleLayout)
  blocks/<kind>/       definition.ts (one export), schema.ts, lint.ts, resolve.ts, fixtures.ts
  blocks/registry.ts   Record<BlockKind, BlockDefinition>  (compile-time exhaustive)
  bindings/            binding.ts, resolve.ts (wraps resolveDataset), honesty.ts
  filters/ theme/ format/ template/ workflow/ lint/ ai-assist/
application/use-cases/canvas/   one handler per file: Create, Save(patch ops), Duplicate, Publish, Export, Share, Template*, Suggest*
application/ports/canvas.ts     ICanvasRepository, ICanvasRenderer(print), IExportStore, IShareLinks, IAiAssist, IDatasetExtras (split into narrow ports: IPlanData, IFinanceData, IPlaceData, IProjectDirectory)
infrastructure/canvas/          print-renderers/<kind>.ts, composer.ts (iterates registry), raster.ts, pdf.ts, pptx.ts
web/features/canvas/            domain (pure view logic), ports, adapters, presentation/{editor,viewer,inspectors/<kind>,screens/<kind>}, composition.ts
```
Rules added to `test/architecture-boundaries.test.mjs`:
1. No `switch`/`if` on a block `kind` outside `blocks/registry.ts` (grep-pinned like `SETUP_AREAS`).
2. Files ≤300 lines, one exported class/handler per file (extend the existing test to `contexts/canvas`, `use-cases/canvas`, `infrastructure/canvas`, `features/canvas`).
3. Registry completeness test (§3.3).
4. Preview/export parity: for every block fixture, the screen and print renderers' **BlockModel** is deep-equal (paint differs, figures never).
5. Presentation never imports adapters; domain never imports node/React (existing).
6. Honesty table test: gap ≠ 0, rate never summed, units never share an axis, draft counted — run over every block's `resolve`.
- **S**: one file/handler/block each. **O**: new block/template/theme/format = new row + folder. **L**: discriminated union `BlockInstance<K>`; every definition is substitutable behind `BlockDefinition`. **I**: narrow ports and per-surface renderer interfaces; blocks see only their `BlockModel`. **D**: handlers depend on ports; composition roots wire adapters; renderers registered, not imported by the composer.

## 5. Migration (no data loss, no rewrite of what exists)
- **Read-adapters first**: `legacyDashboardToCanvas(widgets)` and `legacyInfographicToCanvas(config)` pure functions with golden tests (v1 `DataChartSpec` lifts via `migrateChartSpec`, as done for Chart v2). Old rows keep working; the new engine reads both.
- Expand/contract: add `Canvas` + `CanvasExport` + `CanvasShareLink` tables (additive); new saves write `Canvas`; a background converter copies old rows (idempotent, keyed by old id); old routes become thin aliases for one release; then remove. Published `InfographicExport` rows are immutable and are *linked*, not rewritten.
- **Navigation is one merged entry** (working name "Visuals"; one list with Mode (Live/Published), Format and Family filters, one "New" button that starts from a template). Old URLs (`/dashboards/*`, `/projects/:id/infographics/*`, `/portfolio/infographics/*`, `/shared/*`, `/embed/*`) redirect by id mapping; bookmarks, pins, featured dashboards and Home arrangement keep resolving.

## 6. Batches (each: tests green, browser harness, deployable alone)
| # | Batch | Output | Risk control |
|---|---|---|---|
| 45.0 | **Contracts & registry skeleton** | `Canvas`, `BlockDefinition`, registry, architecture tests; no UI | Tests first; zero behaviour change |
| 45.1 | **Bindings & view-models** | `Binding`, `BlockModel`, honesty test over existing KPI/metric/chart/table blocks; legacy adapters + golden tests | Parity with current outputs |
| 45.2 | **Port the existing 7 dashboard kinds + 30 infographic kinds into definitions** (one folder each, screen+print renderer) — de-duplicate KPI/big-number, table/report, map, text | Registry complete; composer iterates registry; `drawCharts` iterates registry | Parity snapshots (`test:visuals` baseline + composer determinism tests) |
| 45.3 | **Unified editor** (pages, grid, inspector from schema, undo/redo, duplicate, multi-select, breakpoints) embedding Chart Studio inspector | One editor replaces `EditWidgetPanel`, `Add*Panel`s, `BlockEditor` | New harness `test:canvas`; keep old screens behind flag |
| 45.4 | **Themes, brand, formats, languages on dashboards**; dark variant for print | One `Theme` table | Contrast tests (existing pairs) |
| 45.5 | **Filters, cross-filter (place/group/status), parameters, drill-through, repeater** | Filter bar + `bindingSlots` | Only declared dimensions filter |
| 45.6 | **Publish/export pipeline — every format**: PDF (vector, tagged), PNG 1×/2×/3×, SVG, per-block PNG, PPTX (native shapes/text + chart images, editable), XLSX/CSV of block data, standalone HTML snapshot, social-size variants, alt-text/caption pack (zip); immutable `CanvasExport`; FROZEN **and** LIVE share links for any profile; scheduled snapshots by email **and** in-app | Existing composer + resvg + pdfkit; PPTX writer new (`IExportFormat` port, one adapter per format) | Determinism regression tests; one fixture canvas exported in every format and re-opened/validated |
| 45.7 | **Templates unified**: migrate 6 + 17, add ≥8 new, gallery with search/filter, save-as, update-from-template | Every template runs LIVE and publishes | Template walk test: apply with sample data, lint clean |
| 45.8 | **Governance**: block-owned lint, review workflow, comments, version history/diff | Reuse `checkApprover`, `COMMENTABLE_ENTITIES` | Existing rules table-tested |
| 45.9 | **AI blocks**: summary, messages, captions, alt text, anomaly callouts, Ask-this-dashboard, translate, auto-list | `AiAssist` interface; all grounded; **enabled per organisation by the SuperAdmin** (see §8.5) | Golden-question eval on the model SuperAdmin selects, recorded before any public claim (outstanding since 33.9) |
| 45.10 | **Cutover**: data converter, redirect old routes, remove old code, docs, four-language copy pass (§8.6) | Delete `composer` switch, `BlockEditor`, old widget panels | Backup, expand/contract, rollback = old tables kept one release |

Suggested order of value: 45.0–45.3 (foundation + one editor) → 45.6 (publish from dashboards, the most-asked gap) → 45.4/45.7 → 45.5 → 45.8 → 45.9 → 45.10.

## 7. Invariants to carry (do not weaken)
A missing value is never 0; rates never summed or "% of target"; units never share a raw axis; drafts plotted only when asked and counted; finance/budget/plan never on a share link except as `ShareLinkExtras` allows; exports immutable with exact inputs + provenance; every authored string escaped before SVG; logo/image URIs validated; writers never receive canvas fields; AI text is opt-in, redacted in, figure-verified out, labelled until accepted; a canvas reads and links, it does not write (inline value entry stays the one exception); `"use server"` files export only async functions; no `@donordesk/domain` root import in `"use client"` files; no ECharts/MapLibre in first bundles.

## 8. Owner decisions (2026-11-06) and what they change
1. **Merged entry.** One navigation item and one list (Mode / Format / Family filters). §5 redirects old routes; no separate "Dashboards" or "Infographics" menus remain after cutover (45.10). Copy and the tour use one noun; help articles are rewritten once.
2. **All exports.** 45.6 ships PDF, PNG, SVG, PPTX, XLSX/CSV, HTML snapshot, per-block PNG and the alt-text pack. Each format is an adapter behind `IExportFormat`; a block with no representation in a format (e.g. an interactive filter in PPTX) prints its current selection as text and the export says so. PPTX: native text, shapes and tables; charts and maps as images with the chart's text description attached.
3. **Both share-link kinds for every profile.** A LIVE link reads current data under the link's guest rules (`ShareLinkExtras`: no budget/finance/project lists); a FROZEN link serves one immutable export. The creator chooses and the dialog states plainly what each exposes (planned-activity titles, places, results by place on LIVE). The Design check still runs on a LIVE link for safeguarding rules (photo consent, small cells), and a donor-submission design must have an APPROVED export to attach to a FROZEN link. One `ShareLink` table with `kind`, hash-only token, expiry, revoke.
4. **Scheduled snapshots: email and in-app.** A subscription = canvas + cadence + recipients + formats + (filter set). Runs from the existing hourly reminder runner in the organisation's morning (idempotent via a ledger like `ReminderLedgerEntry`); each run creates a new immutable export, sends one email (Exim/SMTP, link plus attachment under a size cap) and writes the in-app note (`PersonNotifier`, respects each person's `notificationEmailMode`). Recipients are people in the organisation; outside addresses only if an administrator allows it (not in the first release).
5. **AI is enabled through SuperAdmin.** A per-organisation switch managed in the SuperAdmin portal (extending the existing `aiEnabled`/provider settings; exact flag name confirmed in 45.0) gates every AI block, the Ask box, translation and AI-drafted alt text. SuperAdmin also chooses the provider/model and daily caps (LLM ledger, `RATE_LIMITED` when over). Off = AI blocks are hidden, not disabled, and nothing is read, redacted or sent. Every AI use is audited with lengths and counts, never the text. The golden-question eval is run on whatever model SuperAdmin selects and the result is stored with the setting; the UI does not describe AI as accurate beyond that record.
6. **No native reviewers — best-effort translations with guards.** (a) Terminology table: one glossary per language (logframe, indicator, output/outcome, evidence, donor, cluster, 3W, beneficiary…) taken from UN/OCHA/UNICEF/WFP published terminology (UNTERM, OCHA multilingual glossaries); every catalogue string and every template is checked against it by a test. (b) Translation is done in context (screen, length limit, placeholders), not word-by-word, and Arabic avoids number-agreement grammar (existing rule). (c) Tests: key completeness, identical `{placeholders}`, no raw tokens, length-fit per block (no overflow), RTL render check, numbers/dates via `Intl` with Latin digits for Arabic. (d) Back-translation check: each new string is translated back to English by a second pass and flagged when the meaning drifts; flagged strings are fixed before merge. (e) Authored text translation (AI block) never changes a figure (verified out). (f) The UI never claims the languages are professionally reviewed; the existing "drafts" note stays in the docs until a human reviewer signs off, and a "Report a translation problem" link on every canvas screen feeds a list the owner can hand to a reviewer later.

## 9. Risks
Largest: parity during 45.2 (two renderers must keep matching existing pictures) — mitigated by baselines and determinism tests; scope creep in blocks — mitigated by registry rule (a block ships with schema, defaults, validate, renderers, lint, copy, fixture or it does not ship); AI honesty — mitigated by deterministic detection + verified output; migration — additive tables, idempotent converter, old tables retained one release.

## 10. Implementation notes (2026-11-06)

Status: **domain layer built and tested; nothing committed or deployed.** Everything below is in `packages/domain/src/contexts/canvas/`; exported from the domain root and as subpath `./contexts/canvas/index.js`. Tests: `packages/domain/test/canvas.test.mjs`, `canvas-editing.test.mjs`; architecture guards appended to `test/architecture-boundaries.test.mjs` (files ≤300 lines, only `blocks/registry.ts` branches on a block kind, one `defineBlock<` per block file). The two older project-setup architecture tests were already failing before this work.

### 10.1 What exists, by batch
| Batch | State | Where |
|---|---|---|
| 45.0 model + registry | Done | `canvas.ts`, `binding.ts`, `block-definition.ts`, `validate-canvas.ts`, `blocks/registry.ts` |
| 45.1 bindings, legacy readers | Done | `legacy/dashboard.ts`, `legacy/infographic.ts` (pure, with golden tests; losses and unreadable items are returned, never dropped silently) |
| 45.2 port blocks | Done for the registry: all 40 kinds have a definition | `blocks/{text,divider,kpi,metric,map,chart,table,project-list}.ts`, `infographic-blocks.ts` (24 kinds from one spec table, validating through the exported `sectionProblem` in `infographics/composition.ts`), `structure-blocks.ts` (callout, AI×3, group, tabs, repeater, filter bar) |
| 45.3 editing | Pure operations only | `edit/edit.ts` (add/move/resize/duplicate/lock/hide/remove, pages, move between pages), `edit/history.ts` (50 steps) |
| 45.4 themes | Pure only | `theme.ts` (infographic themes are the canvas themes; `contrastProblems`) |
| 45.5 filters | Pure only | `filters.ts` (`honoursOf`, `filtersOnPage`, `applyFilters`, `nextCrossFilter`) |
| 45.6 export | Contract + text formats only | `export-formats.ts` (10 formats, `supportOf`/`exportPlan`, `csvOf` with formula defusing, `canvasJson`, `altPack`) |
| 45.7 templates | Pure only | `template.ts` (`{{role:KEY}}` fill, `applyCanvasTemplate`, `copyCanvasTemplate`) |
| 45.8 governance | Pure only | `governance.ts` (`CANVAS_RULES`, `checkCanvas`, `canPublish`; review workflow reuses the infographic transition table) |
| 45.9 AI | Rules only | `ai.ts` (`aiGate`, `groundText`, `sameFigures`, `auditShape`) |
| 45.10 cutover | Not started | — |

### 10.2 Design decisions made while building
- **Props keep the old shapes.** KPI/METRIC/MAP/PROJECT_LIST props are the existing query types; the 24 infographic blocks keep `Omit<InfographicSectionConfig,"kind">`. This makes conversion lossless and avoids a second copy of validation. Splitting a block into its own props type later is a local change (move its row out of the spec table into its own file).
- **`requiresSetup`** on a definition means a new block cannot be valid until the person chooses something (KPI, CHART, TABLE); its defaults then fail `validate` with a sentence. The contract test checks that.
- **Resolve is honest about what it does not yet do.** KPI, METRIC, CHART and TABLE resolve through the existing builders. MAP, PROJECT_LIST and the 24 infographic blocks return their settings as the model (`ready`), because their figures are still read by the screen under the viewer's access (maps, lists) or by the print composer (infographic blocks). Their own `BlockModel`s, and with them the screen/print figure-parity test of §4, are **not built**.
- **Legacy bindings:** converted blocks carry `bindings: []` and keep their project in the old place (`legacyProjectIds` returns it). Moving the project and indicator choice into `Binding`s is part of the wiring work below.
- **Lossy conversions** (named in `losses`): an infographic MAP becomes a RESULTS map without its shading metric and place filter; a key-figures row over 6 indicators is cut to 6.
- **Name clashes:** the canvas exports are prefixed (`CANVAS_GRID_COLUMNS`, `CanvasBounds`, `canvasTemplateProblems`…) because the domain root re-exports dashboards and infographics with unprefixed names.
- **Import cycle:** `filters.ts` ⇄ `blocks/registry.ts` (through `structure-blocks.ts`) is safe because each side only uses the other inside functions. Keep it that way: no top-level use of the other module's values.
- **Filters:** legacy blocks without slots get their honoured dimensions from a table in `filters.ts` (`LEGACY_HONOURS`) until their bindings carry slots.
- **CSV safety:** a leading `= + - @` (except plain numbers) is prefixed with `'`. Reuse `csvCell`/`csvOf` for every spreadsheet-like export.

### 10.3 Not built (in order of dependency)
1. **Persistence:** `Canvas`, `CanvasExport`, `CanvasShareLink` (kind LIVE/FROZEN), subscription and ledger tables; RLS entries; `/ready` pairs; `ORG_EXPORT_EXCLUDED` for share-link hashes. Migration additive, before the code.
2. **Application layer:** one handler per file (create, save with expected revision, duplicate, publish, export, share, template, subscribe), narrow ports (`ICanvasRepository`, `IExportFormat`, `IDatasetExtras` split), authorisation rules in `RULES` (the coverage test fails without them).
3. **Idempotent converter** from `Dashboard.widgetsJson` and `ProjectInfographic.configJson` using the two readers; old routes kept as aliases for one release.
4. **Export adapters** behind `IExportFormat`: PDF/PNG/SVG reuse the composer + resvg + pdfkit (the composer must iterate the registry instead of its 30-case switch); PPTX, XLSX, HTML snapshot, per-block PNG zip are new.
5. **Block models and print renderers** for the ported blocks, plus the screen/print parity test.
6. **Web:** the single editor (pages panel, canvas, inspector generated from each block's schema, Chart Studio inspector embedded, undo/redo bound to `edit/history`), merged navigation entry and redirects, template gallery, filter bar, cross-filter, repeater, comments, version history. Copy for the new keys in four languages with the §8.6 guards (glossary, placeholder/length tests, back-translation pass).
7. **Sharing and subscriptions:** LIVE and FROZEN links for any profile, scheduled snapshots by email and in-app through the hourly reminder runner with a ledger.
8. **AI wiring:** the SuperAdmin per-organisation switch (flag confirmed in 45.0, see §10.5: `Organization.canvasAiEnabled`, set in the SuperAdmin tenant form; provider/model/caps still come from the existing LLM settings), model calls through the LLM ledger, the golden-question eval on the chosen model, audit rows via `auditShape`.
9. **Template migration:** convert the 6 sector dashboard and 17 infographic templates to `CanvasTemplate`; add the new families listed in §3.7; test that each applies with sample data and passes `checkCanvas`.
10. **Cutover (45.10):** needs a fresh backup, owner go-ahead, expand/contract, then removal of the composer switch, `BlockEditor`, the old widget panels and old routes. Do not start without explicit approval.

### 10.4 How to continue
Build in this order: persistence + converter (1–3) → composer iterating the registry and block models (4–5) → editor (6) → sharing/subscriptions (7) → templates (9) → AI (8) → cutover (10). Each step: build contracts → domain → application → infrastructure before testing, run the canvas tests and the architecture test, and add the browser harness (`test:canvas`) when the editor lands. Verify with the domain suite (`node --test test/*.test.mjs` in `packages/domain`; last full run before 45.3 was 1397 passing).

### 10.5 Batch 45.0 completed (2026-11-06)

Status: **45.0 done in every layer; nothing committed or deployed.** Verified: domain canvas tests 32 pass; `canvas-catalogue` and `i18n` web tests 11 pass; architecture test passes for every canvas rule (its two project-setup failures predate this work); domain, application, infrastructure build clean.

What was added:
- **Contract completeness** (`packages/domain/test/canvas-contract.test.mjs`): every kind has a definition and a fixture (`fixtures.ts`, `Record<BlockKind, BlockFixture>`, so a new kind without one does not compile); a definition has family, label key, validate, defaults, slots, sizes, a lint table and resolve; every fixture validates; lint ids are unique and **no rule may be a stub** (each must be able to fail).
- **Block traits** (`needsAlt`, `headline` on `BlockDefinition`). Governance read kind lists (`["CHART","MAP","IMAGE","SMALL_MULTIPLES"].includes(b.kind)`) which the old architecture test could not see; it now reads the trait, and the test also catches `.includes(x.kind)`. The MAP block's `MAP_NEEDS_ALT` lint was a no-op (`check: () => null`); removed, the trait covers it.
- **Honesty and parity preconditions**: `model-safety.ts` (`modelProblems`, `functionPaths`, `modelFingerprint`). Every model is plain data; the only function allowed is a chart `formatter` (ECharts requires it), so a chart model is compared by fingerprint and **rebuilt from inputs, never stored**. Tests pin: a month nobody recorded is `null` in a chart, a table and a sparkline; the KPI change skips the empty month; a rate has no percent of target; a tile with no data shows no figure; an AI block is empty until it has text and says when it is not accepted. `resolve` is pure (same fingerprint twice).
- **Renderer contract** (`renderer.ts`): `RenderSurface` (SCREEN, PRINT), `PaintFrame`, `BlockPainter<M, Out>`. Renderers see a model, a theme and a size, nothing else.
- **Application ports** (`ports/canvas.ts`): `ICanvasRepository` (update quotes the revision), `ICanvasExportRepository` (no update: exports are immutable), `ICanvasShareLinkRepository` (kind LIVE or FROZEN, hash only), `IExportFormat`, `ICanvasAiAssist`, and the narrow readers `IPlanData`, `IFinanceData`, `IPlaceData`, `IProjectDirectory`. A type-level check (`DATASET_EXTRAS_COVERS_NARROW_PORTS`) keeps the wide `IDatasetExtras` satisfying all four.
- **Print and screen registries**: `infrastructure/src/canvas/print-registry.ts` (`PRINT_PAINTERS`, `PRINT_PENDING`, `unpaintable`) and `apps/web/src/features/canvas/presentation/screen-registry.ts` (`SCREEN_RENDERERS`, `SCREEN_PENDING`). Both empty; painters and components land in 45.2. A canvas holding an unpainted kind must be refused for publish with a sentence, never exported with the block missing. The web test pins `SCREEN_PENDING_MAX` (40, lower it as renderers land).
- **Copy in four languages** (`canvas-en/fr/es/ar.ts`, spread into the main catalogues; typed, so a missing key does not compile): 40 block names, 9 group names, 2 modes, "Report a translation problem" (plan §8.6f), the unpaintable sentence. **Glossary** (`messages/glossary.ts`): 10 sector terms in four languages with accepted spellings; `GLOSSARY_USE` holds named labels to it (the test caught the Arabic plurals). Label length is capped at 44 characters and names must be unique per language. Still owed from §8.6: the back-translation pass (needs a model run) and RTL render and length-fit checks in a browser. The translations are drafts without a native reviewer.
- **Architecture rules** now span all four layers (domain, `use-cases/canvas`, `infrastructure/src/canvas`, `features/canvas`): files at most 300 lines, only a registry names a kind, one definition per block file, one exported class per use-case/adapter file, no React/Next in server layers, web presentation never imports an adapter.

**Decision: the AI switch (plan 8.5).** The existing platform flag is `Organization.aiEnabled` (default **true**, set in the SuperAdmin tenant form "Enable AI features for this tenant", `control-plane.updateTenant`). Used alone it would turn canvas AI on in every organisation, which is not what was decided. Canvas AI therefore needs **both** `aiEnabled` and a new `Organization.canvasAiEnabled` (default **false**), set only by SuperAdmin beside the existing checkbox; the rule is `canvasAiEnabledFor` (domain, tested). The column, its `/ready` pair, the SuperAdmin form field and the API schema field arrive with the persistence migration (45.3), because the migration is shared with the `Canvas` tables.

Left for later batches, unchanged: screen/print renderers and their parity test (45.2), converter and tables (45.3), the rest of §10.3.

### 10.6 Batch 45.1 completed (2026-11-06)

Status: **45.1 done for the domain; nothing committed or deployed.** Domain canvas tests 57 pass (was 32); architecture test passes for every canvas rule (project-setup's two failures predate this work).

- **Bindings carry the project.** New `PROJECT` binding (`{ type, slot: "project", projectId }`) and `projectSlot(honours)`. KPI, METRIC, CHART, TABLE and MAP declare it (min 1), so a block that reads a project is not valid without one. The question (indicator, dataset, report query) stays in the block's settings, written once, not duplicated into a binding. A converted dashboard widget now carries its project as a binding (`legacyProjectIds` stays for callers that only have widgets). `applyCanvasTemplate` takes `projectId` and adds the binding, because a template stores none. PROJECT_LIST has no project slot (it reads the viewer's whole list) and keeps its filter dimensions in `LEGACY_HONOURS`; every other block's filters now come from its slots, so the table lost five rows. Infographic blocks read the canvas's own project (`StoredCanvas.projectId`) and carry no binding.
- **The two lossy conversions are lossless.** The infographic map keeps its shading and chosen places (`MapWidgetQuery.shading`, `placeKeys`, validated); a key-figures row over 6 indicators becomes several `BIG_NUMBERS` blocks (ids `s2`, `s2-2`, ...) that stack, none cut. `losses` is now empty for both.
- **Real models** (`canvas/models/`, pure, one function per kind, looked up by a table): BIG_NUMBERS (one `PICK` per source, exhaustive by type), PROGRESS_RINGS, FUNNEL, REACH, ACTIVITIES_BY_LOCATION, LOCATION_RESULTS, LOCATION_COMPARISON, DEMOGRAPHICS, FUNDING, KEY_MESSAGES, QUOTE, LEGEND_NOTES, BANNER, IMAGE, TIMELINE, THREE_W, SECTOR_GRID, MAP and PROJECT_LIST. They read `CanvasFacts` (`facts.ts`: the figures `ProjectInfographicDataDto` holds; the DTO satisfies it structurally). Rules kept: nothing recorded is `null`/empty with a reason, never 0 or a placeholder; a rate has no percent of target; a place nobody reported or planned is `null`; unverified figures are noted; people and activities with no place are counted apart; a map place with no pin is listed, never placed; a later funnel stage larger than the one before is noted; unconsented quotes and undescribed images are noted. Without facts a data block is "unavailable" with a reason, except typed (MANUAL) figures, which need none. Rows over a cap say so (first 18 results, first 6 places, first 8 age groups).
- **Still drawn from settings** (`PENDING_MODEL_KINDS`, pinned to at most 7, so it can only shrink): HERO, SMALL_MULTIPLES, RESULTS_CHAIN and the four PORTFOLIO blocks. They are ported with their renderers in 45.2 (HERO and the portfolio blocks need the project/portfolio facts the composer holds).
- **Not done here, by design:** the idempotent converter that copies stored rows into `Canvas` tables is persistence work (45.3); the screen/print figure-parity test needs the renderers (45.2). `ProjectInfographicDataDto` -> `CanvasFacts` is structural; the application mapper is written with the handlers.
- **Architecture test fix:** the "only a registry names a kind" rule now reads the kinds from the registry, so a union tag like `targetActual.kind === "WITH_TARGETS"` is not mistaken for a block kind (a real violation is still caught; checked with a throwaway file).

### 10.7 Batch 45.2, first slice (2026-11-06)

Status: **9 of the 40 blocks are painted from their model on both surfaces; 31 are not.** Nothing committed or deployed. Domain 1447 pass, web typecheck clean, web canvas/i18n tests 18 pass, architecture test passes for every canvas rule (project-setup's two failures predate this work).

- **Print painters** (`infrastructure/src/canvas/`): `PrintInput`/`PrintPainter`, `factsOf(ctx)` (page context -> `CanvasFacts`), `paintSection(c, section, width)` (resolve the model from the facts, then paint it; `null` = no painter yet, the caller falls back) and nine painters: BIG_NUMBERS, PROGRESS_RINGS, FUNNEL (`painters/numbers.ts`), REACH, ACTIVITIES_BY_LOCATION, LOCATION_RESULTS, LOCATION_COMPARISON (`painters/places.ts`), DEMOGRAPHICS, FUNDING (`painters/people-money.ts`). The composer asks `paintSection` first and keeps its older switch only for the kinds still pending. The painters' input types are derived from the domain model functions (`ModelOf<typeof reachModel>`), so a model change that a painter does not follow fails to compile.
- **Oracle test** (`canvas-print-parity.test.mjs`): the Studio's own block functions are the oracle. 378 drawings (9 kinds, 3 data sets: rich, nothing recorded, zeros; 6 contexts: plain, preview, French, Arabic right-to-left with preview, a second theme, a period range with default places) are compared **byte for byte**. One deliberate difference, pinned in the test: places chosen that hold nothing used to draw a header row over an empty table; it now says "Not yet reported". The existing renderer and Studio render tests (46 in all) pass through the registry. The painters also escape what a person typed (checked with markup in a label, a value and a source note).
- **Screen renderers** (`apps/web/src/features/canvas/presentation/screens/`): nine React components for the same kinds, registered in `screen-registry.ts`. They use the print side's own words (`labelsFor`) and number format (`formatNumber`), so a block reads the same on screen and in a file; they handle empty/unavailable/notes once (`readyOrNothing`) and show the model's notes (unverified figures, rows cut). Logical (`text-start`/`text-end`) classes only, tested for Arabic. Tested by bundling with esbuild and rendering to static markup (`canvas-screens.test.mjs`): figures, gaps worded not drawn as 0, a rate with no percent of target, nothing-to-show states, notes, all four languages. This checks content, not looks: no browser check of these components has been done.
- **Model change forced by the oracle:** a funnel whose stages are all unrecorded now returns the stages with `recorded: false` instead of "empty" (the Studio preview draws the labelled stages).
- **Not done:** the other 31 kinds (the pending lists are pinned at 31 for print and screen so they can only shrink). Of those, 22 already have a model but no painter or screen component yet: KEY_MESSAGES, QUOTE, LEGEND_NOTES, BANNER, IMAGE, TIMELINE, THREE_W, SECTOR_GRID, MAP and PROJECT_LIST (infographic-style), plus KPI, METRIC, CHART, TABLE, TEXT, DIVIDER (drawn today by the dashboard widget registry) and the structure blocks CALLOUT, AI x3, GROUP, TABS, REPEATER, FILTER_BAR; HERO, SMALL_MULTIPLES, RESULTS_CHAIN and the four PORTFOLIO blocks still need models first. `drawCharts` still branches on the widget kind. Screen and print notes: the print side does not draw the model's notes yet (that would change the oracle's output), so a printed file does not carry "Some figures are not verified yet" except where the old block already did.

### 10.8 Batch 45.2, second slice (2026-11-06)

Status: **19 of the 40 blocks are painted from their model on both surfaces; 21 are not.** Nothing committed or deployed.

- **Ported (10 more, print and screen):** TEXT, DIVIDER, BANNER, KEY_MESSAGES, LEGEND_NOTES, QUOTE, IMAGE, TIMELINE, SECTOR_GRID, THREE_W (`painters/text.ts`, `painters/stories.ts`; `screens/text.tsx`, `screens/stories.tsx`). The oracle now compares **936 drawings** (19 kinds x 3 data sets x 7 contexts incl. an acknowledgement line in Spanish, uploaded images and a quote portrait) byte for byte; all equal.
- **The oracle found models that were too thin, so the models were completed, not the painters bent:** the quote carries its portrait asset; a banner with no words falls back to the design's acknowledgement (`CanvasFacts.acknowledgement`); the notes block works out its source line (periods and indicator codes the design covers) in the model; the 3W model owns the place columns (grouped by the location normalizer, in order first named, most-typed spelling, counts, partners counted once however it is typed). The canvas TEXT block no longer throws when an infographic section has no `text`.
- **Screen:** `ScreenRendererProps` gained an optional `assetUrl(assetId)`; a picture shows when it can be loaded and its words (description, caption, credit) when it cannot. No asset-serving route was assumed: the screen that hosts a canvas passes the resolver.
- **Tests:** domain 57 canvas tests; infra parity 4 (936 drawings); web screens/catalogue/i18n 20. Both pending lists are pinned at 21.
- **Deliberately not ported yet, and why:** MAP (the older block draws from map points and shapes the composer is handed, not from the facts; its model needs those inputs first), PROJECT_LIST (screen-only, no print twin to compare with), the dashboard-widget kinds KPI, METRIC, CHART, TABLE (they have rendering today in the widget registry; moving them behind this registry is the `drawCharts` work), the structure blocks (CALLOUT, AI x3, GROUP, TABS, REPEATER, FILTER_BAR) and the seven that still need models (HERO, SMALL_MULTIPLES, RESULTS_CHAIN, PORTFOLIO x4).

### 10.9 Batch 45.3 persistence, access, editor, templates, deploy and live testing (2026-11-06/07)

Status: **built, tested, deployed to Contabo (releases 20261106184255, 20261106193355, 20261106195739 and the last, web only, 20261106202304) and driven in a visible browser as the test tenant.** Not built: see "Not built" below. Commits `5c58ac93`, `42ccc22b`, `3e4f3455`, `e43f8f9d`.

- **Persistence**: `Canvas` table (migration `20261109090000_canvas`, additive, applied by hand as the migrator after a fresh backup `20261106T184120Z`; RLS forced with the `tenant_isolation` policy and checked; `/ready` pair `Canvas.docJson`; the organisation export includes it automatically). `PrismaCanvasRepository` (create returns false on the unique `[tenantId, sourceKind, sourceId]`; update is guarded by revision; a damaged document is skipped, not an error). Proven on a scratch Postgres (`canvas-repository.test.mjs`, opt-in with `CANVAS_VERIFY_DATABASE_URL`).
- **Handlers (one per file)**: list, get, create, save, delete, duplicate, convert dashboard, convert infographic, resolve. Routes `GET/POST /v1/canvases`, `GET/PUT/DELETE /v1/canvases/:id`, `POST …/duplicate`, `GET …/resolve`, `POST /v1/canvases/from-dashboard|from-infographic/:id`, each with an authorization rule (the coverage test enforces it). Access = `canSeeCanvas`/`canEditCanvas`/`canCreateCanvas`. A save is refused only for a broken **shape**; what is not yet set up is stored and returned (`problems`). A block that reads facts may carry its own `PROJECT` binding (optional slot) and otherwise uses its canvas's project; facts are read once per project and only for projects the viewer can see.
- **Domain additions**: `canvasStructureProblems`/`canvasContentProblems`, `document.ts`, `access.ts`, `to-widgets.ts`, `settleBoxes` (canvas layout limits), traits `reads`, `bare`, `needsAlt`, `headline`, `BlockModel.authoring`, 8 `BUILT_IN_CANVAS_TEMPLATES`, HERO model/painter/screen (print byte-equal to the Studio's cover). Models never throw on malformed settings (fuzz test).
- **Web**: `/visuals` (list: canvases plus older dashboards and designs with an "Open here" button), `/visuals/new` (8 templates or blank; roles chosen from the project's indicators), `/visuals/[id]` (view and edit: pages, palette of all 40 kinds, inspector driven by `PROP_FIELDS` plus an Advanced JSON editor, undo and redo, save with revision, design check, copy, download canvas file and descriptions, download as a picture, print). Menu entry "Visuals". A per-block error boundary stops one bad block blanking the page.
- **Found by using it (and fixed)**: infographic-style blocks said "figures were not read" on a personal canvas (no project); adding a KPI crashed the page (resolve assumed data); the server redirect page raised React error 310 (now a client action); a key-figures row with no indicators lost its four summary cards on conversion; an empty authored block said "Not yet reported" (now a prompt); a divider added from the palette was inflated by the dashboards' two-cell layout minimum (the canvas has its own `settleBoxes`); one-row blocks sat in cramped cards (`bare`); a chart collapsed on a phone; the app header printed with every page (`role="banner"`); the More menu stayed open.
- **Verified live**: sign-in; older dashboards and infographics open as canvases (idempotent) with real figures and maps; all 8 templates create on two real projects; blank canvas with 9 block kinds edited through the inspector, saved, reloaded and drawn (KPI figure, line chart, table, key messages, 3W, metric, cover, reach); a stale second tab is refused and overwrites nothing; copy, download and delete; phone width has no sideways overflow; print hides the editing chrome; dark mode follows the tokens.
- **Gate**: domain 1459+, application 1025, infrastructure 696 (600 run, the rest need a database), api 68, web unit 928, web and all packages typecheck clean. Two project-setup architecture tests fail and failed before Phase 45; the Creem webhook api test is time-sensitive under parallel load and passes alone.
- **Not built (Phase 45 remainder)**: renderers for SMALL_MULTIPLES, RESULTS_CHAIN, the four PORTFOLIO blocks and the structure blocks (they show "A preview of this block is not available yet"); the canvas registry replacing `WIDGET_RENDERERS`/`drawCharts`; publish and export beyond picture/print/JSON/descriptions (server PDF, PNG, SVG, PPTX, XLSX, immutable `CanvasExport`); live and frozen share links and scheduled snapshots; AI blocks and the `canvasAiEnabled` switch; cross-filters, version history and review workflow; drag-and-drop (position is set by number); editor text is English only; the cutover (the older screens and routes stay and keep working).
