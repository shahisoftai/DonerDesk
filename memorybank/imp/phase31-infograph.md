# Phase 31 — Infographics Studio + location disaggregation

**Superseded for the Studio by `phase32-infographic-studio.md` (2026-10-25). Feature doc: `Features/44-Infographic-Studio.md`.**

**Status (2026-10-25): Batches 31.1 + 31.2 built and deployed (`releaseId=20261025043802`, verified live on the demo tenant). Batch 31.3 hardening partly built (section show/hide/order, authored titles/text, per-section indicator selection, size all work); branding toggle, saved-config regeneration UX polish and perf passes not built.** Branch seed `0015-infographics` (work landed on `0014-maps`), Version 2.006.
One additive migration; no new env; no external service (no geocoder, no tile server, no second
database, no AI).

**Mock-ups:** `memorybank/imp/phase31-mocks.html` (open in a browser) + rendered PNGs in
`memorybank/imp/phase31-mocks/` — screens 1–6 are the six templates as A4-portrait pages (slot
compositions, incomplete-data states, verification marks, provenance footer); **7 is the Studio
editor** (sections list with reorder/visibility, live preview with the selected section
outlined, section settings: indicator multi-select, measure, target marks, location breakdown,
size) and **8 is the saved-designs list** (drafts vs published exports, regeneration contract).

**Goal.** Two things built as one coherent feature:

1. **Location disaggregation as project data capability** — results, targets, beneficiaries and
   activities can be compared across the locations a project works in, using records the officer
   already entered. This is built first and lives in the domain, not inside the infographic
   feature.
2. **Infographic Studio** — a project-level visualization area that composes the *existing* Data
   Center charts, beneficiary counts, plan/activity delivery and finance into six deterministic
   templates, previewed in the browser and exported as PNG (first) and standalone PDF (second,
   visually identical — never converted to markdown).

**Reuse before build (audit result).** Nearly every capability the Studio needs already exists:

| Need | Already in the repo |
|---|---|
| One read of a project's indicator/period/finance data with verification status | `GetProjectDataSheetHandler` → `DataSheet` (`packages/application/src/use-cases/data-center/data-sheet.ts`, `packages/domain/src/contexts/reporting/data-sheet.ts`) |
| Chart engine (target vs actual, over time, progress, budget vs spend, burn rate) with rate/zero-target/lower-is-better/missing-≠-0 rules | `data-charts.ts` (`buildDataChart`, `DATA_CHART_TEMPLATES`), `chart-config.ts` (`optionForType`, `chartAchievement`, `hasShareOfTarget`), `ChartMeasure` |
| Identical charts in browser and exports | ECharts SSR + sharp: `packages/infrastructure/src/exports/chart-png-renderer.ts` (`renderChartPngCached` shares `buildChartOption` with the browser panel) |
| Indicator values by location | **already supported**: `IndicatorUpdate.disaggregationJson` carries `DisaggregationEntry` with `dimension: "LOCATION"` (`packages/domain/src/contexts/logframe/indicator-disaggregation.ts`); the update form (`DisaggregationEditor.tsx`) and grid offer the dimension; summable types must add up to the period value |
| Targets by location/group | **already supported**: `Indicator.targetBreakdownsJson` → `validateTargetBreakdowns`; group-vs-actual roll-up already computed by `breakdownProgress()` and surfaced by `GetBreakdownProgressHandler` |
| Beneficiary records | `Beneficiary` (caseCode, sex, ageGroup, free-text location, enrolledOn) + `BeneficiaryActivityLink` (per-activity dedup) + `beneficiaryCounts()` |
| Activities by location | `PlannedActivity` (location, lat/lng pins, status, original/planned dates), `ActivityUpdate` (location, participants, achievements, lessons), `deliveryHealth`, `summarizePlanDelivery` |
| Map rendering (geographic coverage) | Phase 30: `site-map.ts` + bundled gazetteer + `SiteMapFigure` (client-side resolution; pinned coordinates win) |
| Delivery/progress derived metrics (no new scores) | `deliveryHealth`/`healthBand`, `summarizePlanDelivery`, `outputProgress` |
| Branding | `OrganizationBranding.logoUrl` |
| Auth conventions | `RULES` in `apps/api/src/middleware/authorization.ts` (403 when no rule), RLS coverage test, `/ready` field allowlist, audited mutations, `Idempotency-Key` creates |

## §0 The data-model question, answered

The proposal's §9 gate — *"are targets/actuals project-level only, or can records be linked to
locations?"* — resolves as: **location-linked results already exist, optionally and as free
text.** An indicator's per-period value is project-level, but each `IndicatorUpdate` may carry
LOCATION-dimension breakdown entries, and an indicator may carry group targets. Nothing new is
needed on the indicator schema. The genuine gaps are elsewhere:

- **G1 — no canonical location key.** "Gulu", "Gulu District" and "gulu" are three distinct
  breakdown categories; roll-ups across periods, indicators and records cannot trust raw text.
  The web's `normalizePlace` (`site-map.ts`) already defines the folding rules but is
  web-feature code.
- **G2 — no aggregation layer.** Nothing computes per-location views across the four record
  kinds (indicator updates, beneficiaries, activities, plan), distinguishes unique reach from
  attendances, or refuses to sum non-additive indicator types.
- **G3 — nothing composes visuals.** No saved composition, no template registry, no
  fixed-canvas renderer, no standalone PNG/PDF export.
- **G4 — beneficiary and activity data are absent from the Data Sheet read** (indicators +
  finance only), so any location view needs one enriched read handler.

## §1 Domain additions (pure TypeScript, zero infrastructure deps)

### §1.1 Canonical location key (G1)

`packages/domain/src/contexts/workplan/location-key.ts`:

- `normalizeLocationKey(value)` — fold diacritics, lowercase, strip admin suffixes
  ("district", "sub-county", "province", "state", "region", "municipal", "city", "town"),
  collapse whitespace. The **one** normalizer; `apps/web`'s `site-map.ts` `normalizePlace`
  delegates to it (subpath export — no root import in client bundles) so the map, the analytics
  and the exported image always agree.
- `locationGroup(entries)` — groups already-normalized keys, keeping the most frequent original
  spelling as the display name (display never mutates stored data).

### §1.2 Location analytics (G2)

`packages/domain/src/contexts/reporting/location-analytics.ts` — pure, table-tested, no clock
(today/period boundaries passed in):

- `indicatorLocationRows(indicator, updates)` — per-location actuals for one indicator.
  Additive types (`NUMBER`, `CURRENCY`) may be summed; `PERCENTAGE`/`RATIO` rows are shown as
  recorded and never summed or averaged (rates recompute only from a numerator/denominator pair,
  which we do not have — so we don't); qualitative indicators surface their recorded status text,
  never an invented number. A location breakdown is emitted **only** when updates actually carry
  LOCATION entries; otherwise the row says `projectWide`.
- `locationTargetActual(indicator, targets, updates)` — joins `targetBreakdowns` LOCATION
  entries to recorded actuals per location. **A missing location target is never fabricated** by
  dividing the project target: the gap column exists only where a target was planned at that
  level. `% of target` per location follows `hasShareOfTarget` (not a rate, not lower-is-better,
  target > 0).
- `locationComparison(indicators, updates)` — the comparison matrix: locations × indicators,
  each cell `value | verified?`, gaps rendered as "Not reported", never 0.
- `locationTrends(indicator, updates, periods)` — per-location series across periods, emitted
  only when ≥ 2 periods have entries and the indicator's semantics are comparable
  (reuses `effectiveIndicatorSemantics`/`periodComparability`).
- `uniqueReach(beneficiaries, links)` — the dedup rule, stated once: **registered unique
  reach** = distinct `beneficiaryId` grouped by the beneficiary's own registered location;
  **attendances** = `BeneficiaryActivityLink` rows grouped by the *activity's* location (the
  link table already dedupes per activity); **overall unique** = distinct beneficiary ids.
  These are three differently-named metrics that may never be shown interchangeably; the
  location-level unique figures need not add to the overall unique total (cross-location reach
  is legitimate), and the copy says so.
- `activitiesByLocation(rows)` — planned / done / late / cancelled counts per location from the
  existing `deliverySignal` derivation (no new status math).

### §1.3 Infographic composition (G3, domain half)

New context `packages/domain/src/contexts/infographics/`:

- `composition.ts` — the saved-design shape: `InfographicConfig { templateId, templateVersion,
  periodFromId?, periodToId?, indicatorIds, adminLevel?, locationKeys?, sections: [{ kind,
  title?, text?, chartSpec?, indicatorIds?, locationKeys?, size? }] }` + `validateConfig`
  (unknown template → error; chart specs validated by the existing `DataChartSpec` rules;
  authored text length caps). Store config, never data.
- `templates.ts` — the **template registry**: six templates (`OVERVIEW`, `PROGRESS`, `RESULTS`,
  `BUDGET`, `THEMATIC`, `CLOSURE`), each a data-driven list of *slots* (KPI row, chart spec,
  table, map, text block) with default selections derived from what the project has. A template
  works with incomplete data by rule: a slot whose data is absent renders its "Not yet reported"
  state (planning-stage overview shows planned sites/activities; results as not yet reported) —
  a template never requires completeness and never invents a placeholder figure.
- `provenance.ts` — `InfographicProvenance { periodLabels, indicatorCodes, generatedAt,
  unverifiedCount, unreportedCount, source: "project-records" }`; the footer stamp is built
  here so preview and export cannot disagree.

## §2 Enriched read model (G4)

`GetProjectInfographicDataHandler` (`packages/application/src/use-cases/infographics/`) — **one
read** composing existing repositories (no new data duplication):

- the `DataSheet` (via the existing handler's pieces: periods, logframe, indicators, updates,
  finance) — verification status rides along on every cell;
- beneficiaries + links → `beneficiaryCounts` + `uniqueReach` inputs;
- plan rows + completed activities → `activitiesByLocation` + `summarizePlanDelivery` inputs;
- finance only when `financeDataMode` is on and the period type allows it (existing
  `financeAppliesTo`), verified-gated as everywhere else.

Returns plain data (ids, strings, numbers, ISO dates) — the same discipline as the Data Sheet.
Location **coordinates are not resolved server-side**: the read returns raw location strings and
normalized keys; the browser resolves pins through the existing gazetteer path in `site-map.ts`.
The domain never gains geo assets, and nothing location-related leaves the tenant.

Optional per-period scope: `GetProjectInfographicDataHandler.handle(ctx, projectId, { fromId?,
toId? })` — filtering reuses `periodsInRange`; the unfiltered read stays the default.

## §3 Persistence (the only new tables)

Additive migration `20261026090000_project_infographics`, applied by hand before the code, then
re-run `infra/postgres/rls.sql` (both tables join the RLS list — the coverage test enforces it):

```prisma
model ProjectInfographic {
  id              String   @id
  tenantId        String
  projectId       String
  title           String
  templateId      String
  templateVersion Int
  configJson      String
  createdById     String
  updatedById     String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  @@index([tenantId, projectId])
}

model InfographicExport {
  id             String   @id
  tenantId       String
  infographicId  String
  projectId      String
  format         String   // PNG | PDF
  storageKey     String
  /// The exact inputs used: period ids, indicator ids, cell/finance digests — enough to re-render
  /// byte-identically. A later project update never silently changes a published export.
  snapshotJson   String
  provenanceJson String
  generatedById  String
  createdAt      DateTime @default(now())
  @@index([tenantId, projectId, infographicId])
}
```

- `ProjectInfographic` stores the **composition** (config), not a second copy of project data.
- `InfographicExport` mirrors the `ExportPackage` precedent: rendered file in `IStorage`
  (`infographics/<tenantId>/<id>/<exportId>.<ext>`), snapshot + provenance in the row — published
  versions stay reproducible; regeneration refreshes only the live composition.
- `PrismaInfographicRepository` (one repository per aggregate), audited mutations, create takes
  `Idempotency-Key` via `CreateOptions` (Phase 25 rule), `/ready` requires
  `ProjectInfographic.configJson` and `InfographicExport.snapshotJson`.
- Authorization `RULES` rows: `GET …/infographics*` and the data read → `project.view`;
  `POST/PUT/DELETE …/infographics*` → `report.edit`; `POST …/exports` → `report.export`. A route
  without a rule is refused by construction (coverage test). External partners stay closed until
  explicitly listed in `EXTERNAL_ALLOWED`.

Routes (thin, Zod-validated):

- `GET /v1/projects/:id/infographics` · `POST /v1/projects/:id/infographics`
- `GET/PUT/DELETE /v1/infographics/:id`
- `POST /v1/infographics/:id/exports` · `GET /v1/infographics/:id/exports` ·
  `GET /v1/infographics/:id/exports/:exportId/file`
- `GET /v1/projects/:id/infographic-data` (the §2 read)

Browser fetches go through the web app's `/api/**` proxy (Phase 30 §11 lesson — the browser
cannot hit `/v1` directly).

## §4 Rendering and export

- **Charts** come only from the existing path: `buildDataChart` / `optionForType` produce the
  option; the browser renders it via the `EChartFigure` pattern; the export renders the **same
  option** through `renderChartPngCached` (ECharts SSR + sharp, already cached by content hash).
  One chart engine, byte-shared between preview and export.
- **New: page composer** (`packages/infrastructure/src/infographics/composer.ts`, behind port
  `IInfographicRenderer`): lays the validated slots onto a fixed canvas as one SVG
  (A4-portrait 1240×1754 @150 dpi; v1 ships this size only), embedding the chart SVG strings
  before rasterization, plus KPI cards, tables, map **image** (client export posts the resolved
  points; the server draws pins with `SITE_SIGNAL_COLOR` — no server-side gazetteer), branding
  logo, title block and the provenance footer. `sharp` rasterizes SVG → PNG (already a
  dependency; run off the event loop as the OCR fallback does, one render at a time).
- **PDF**: pdfkit (already used by the export builder) embeds the section PNGs on A4 pages;
  oversized compositions paginate at section boundaries. The infographic keeps its visual
  composition — it is never converted to markdown.
- **Determinism**: fixed dimensions, bundled fonts, no `Date.now()` inside the composer
  (generatedAt is injected), chart options content-hashed — a re-export with unchanged inputs is
  byte-identical, which is also the regression test.
- HTML-escape every officer-typed string before it enters SVG (Phase 30 tooltip rule).

## §5 The Studio (web, `apps/web/src/features/infographics/`)

- `domain/` (pure, pinned by the architecture-boundary tests — no React/Next/server):
  `page-layout.ts` (slot sizing/flow onto the fixed canvas — pure math, table-tested),
  `studio-state.ts` (config editor state ↔ `InfographicConfig`), view-model mappers from the §2
  read to template slots.
- `presentation/` (`"use client"`): `InfographicStudio` (template picker, period range,
  indicator multi-select, admin-level/location filter applied consistently to KPIs, charts,
  tables and the map), `InfographicCanvas` (preview: charts via the existing ECharts figure
  pattern, map via `SiteMapFigure`, KPI cards, tables), export dialog, saved-designs list page
  under the project area.
- **The location filter is one control** in the read model's consumers: selecting a district
  filters KPI cards, charts, the matrix and the map through the same §1.2 functions — the Data
  Center can adopt the same filter later from the same source.
- Copy lives in a new `infographics-copy.ts` scanned by `findRawTokens` (no codes, no
  snake_case in labels). The five standard location views (results, target-vs-actual, coverage
  map, comparison matrix, trends) are template sections built on the §1.2 functions — the same
  functions also feed a future "By location" Data Center tab, so the Studio does not own them.
- Nothing chart/map-related enters the first bundle: ECharts, the gazetteer and the geo assets
  load lazily inside the canvas/effect (Phase 30 measured pattern).
- Report integration: standalone saved compositions in v1; a chart that belongs in a donor
  report keeps using the existing Data-Center-chart-to-report artifact pathway. No second chart
  system. (Inserting a whole infographic image into a section is deliberately **not built** —
  §10.)

## §6 SOLID, concretely

- **S** — one job per module: `location-key.ts` only normalizes; `location-analytics.ts` only
  aggregates (it never renders); `composition.ts`/`templates.ts` only define and validate what a
  design *is*; the §2 handler only reads; `composer.ts` only lays out and rasterizes;
  `PrismaInfographicRepository` only persists; routes only parse and delegate.
- **O** — a seventh template is a new registry row; a new location view is a new pure function +
  a slot kind; a new export size is a constant — none of these edit the Studio, the handlers or
  the repository. `SITE_SIGNAL_COLOR`-style exhaustive tables are reused, not forked.
- **L** — the composer consumes `ChartSource` exactly as `chart-png-renderer.ts` does, so any
  renderer that honors the port produces the same visuals as the browser panel; every template
  honors the same incomplete-data contract (absent slot data → "Not yet reported"), so templates
  are substitutable without caller changes.
- **I** — ports stay narrow: `IInfographicRepository`, `IInfographicRenderer`, plus the existing
  ports the §2 handler composes; inputs are purpose-built shapes (like `SitePointInput`), never
  Prisma rows or API schemas; the domain never learns about HTTP or storage.
- **D** — handlers depend on ports; the Studio depends on pure view-models and the option
  builders, never on ECharts internals; both preview and export depend on the same
  `buildChartOption` abstraction — high-level policy (templates, rules) never imports low-level
  detail (sharp, pdfkit, Prisma).

## §7 Rules the implementation must not break

- **Missing data is never 0 and never invented.** A location without a recorded value is "Not
  reported"; a location target not planned at that level is absent — the project target is never
  divided across locations.
- **Rates and percentages are never summed.** Only `NUMBER`/`CURRENCY` aggregates; a rate's
  location view shows recorded values side by side; `% of target` obeys `hasShareOfTarget`.
- **Unique reach, attendances, services and registered people are distinct metrics** with
  distinct labels; per-location uniques may legitimately not add to the overall unique total.
- **Unverified data is visible, not hidden**: plotted unverified values carry the existing
  badge/count discipline (`DataChartProvenance`); the provenance footer states the periods,
  indicator codes and unverified count.
- **Existing chart rules stay authoritative** — the Studio never recomputes an achievement,
  a variance or a burn rate; it composes what `data-charts.ts`/`chart-config.ts` produce.
- **The map reads; it never writes**, and the Studio's maps inherit Phase 30's rules (bundled
  assets, unplaced listed honestly, pinned coordinates win, nothing geo eager-loaded).
- **Finance appears only when the mode is on and the period type allows it**, verified only —
  the Budget template degrades to "Not recorded" otherwise.
- **Writers never receive any of this**; no infographic field reaches a report prompt.
- **Every mutation is audited; every create is idempotent; every route has a RULES row; every
  tenant table is RLS-forced.**
- **Published exports are immutable**: regeneration creates a new `InfographicExport`; deleting
  a composition that has exports requires the same confirm discipline as other destructive
  actions (and the export rows' retention follows the organization-export rules).

## §8 Batches

### Batch 31.1 — Location disaggregation foundation

**Status (2026-10-24): built.** Domain: `workplan/location-key.ts` (the one normalizer;
`locationGroup` keeps the most frequent typed spelling) and
`reporting/location-analytics.ts` (`indicatorLocationRows` PROJECT_WIDE/ADDITIVE/RECORDED,
`locationTargetActual`, `locationComparison`, `locationTrends`, `uniqueReach`,
`activitiesByLocation`) — 20 new domain tests, suite at 826 green. Web: `site-map.ts`
`normalizePlace` is now the domain normalizer (Phase 30 tests unchanged, 29 green; web unit suite
443 green). Application: `GetProjectInfographicDataHandler`
(`use-cases/infographics/infographic-data.ts`) — one read composing periods, indicators (each
with its location view, target-vs-actual, trends and its project-wide figures), beneficiary
reach (`uniqueReach` + `beneficiaryCounts`), plan activities by location (via `toWorkPlanRow`,
the one row builder) and verified finance. `IBeneficiaryLinkRepository.findByProject` added
(port + Prisma). API: `GET /v1/projects/:projectId/infographic-data`
(`routes/infographics.ts`, RULES row `project.view`; authorization-coverage green; architecture
boundaries green; api suite at parity with the pre-change baseline — the 2 known failures need a
live Postgres and fail on the clean tree too).

1. ~~`location-key.ts` + `site-map.ts` delegation~~ ✅
2. ~~`location-analytics.ts` functions + tests~~ ✅
3. ~~`GetProjectInfographicDataHandler` + route~~ ✅
4. UI: a read-only "By location" panel inside the Studio's later home — for this batch, surface
   the five views as sections of the template preview only if trivially available; otherwise
   ship the read API + domain tests and move on. **Deploy: no migration.** API-only + domain.

### Batch 31.2 — Templates, Studio, export (the visible phase)

1. Migration `20261026090000_project_infographics` + `rls.sql` + `/ready` fields + repository +
   RULES rows + idempotent create. (`npx prisma generate` before `tsc` — Phase 30 §11 lesson.)
2. `infographics/` domain context (composition, templates, provenance) + tests.
3. `IInfographicRenderer` + composer + PNG; then PDF. Determinism test: same inputs → identical
   bytes.
4. Web feature: list page, Studio, canvas preview, export dialog, `/api/**` proxy routes.
   Five location views + six templates, each with the incomplete-data states.
5. ~~Browser verification on the demo tenant~~ ✅ (2026-10-25, live on prod with `[DEMO-9]` Nepal CMAM: template → Studio → save → PNG + PDF export → list with export counts → regenerate keeps earlier exports byte-identical → delete-confirm; two prod fixes found and shipped: the brand reader must resolve the Organization by its `tenantId` column (`dc0c1f0`), and the export's results-by-location table must draw recorded rows when no location targets were planned (`abf4fa5`, regression-tested). **Deploy: SCOPE=both** ✅ — migration `20261026090000_project_infographics` piped as `donordesk_migrator` before the code, bookkeeping row inserted with the sha256, `rls.sql` applied to the two new tables (`ConnectorRun` is owned by `postgres` and aborts the DO block under `ON_ERROR_STOP` — apply per-table).

### Batch 31.3 — Customization and hardening

Section show/hide/order, authored titles/text, branding toggle, per-section indicator selection;
saved-config regeneration; authorization review (including external-partner closure), export
consistency re-test, performance with large projects (chart PNG cache hit rates); corpus tests
for the copy lint. Drag-and-drop positioning stays out until users ask (the §5 layout math keeps
fixed slots so it can be added without a rewrite).

## §9 Tests

- Domain: `location-key.test.mjs`, `location-analytics.test.mjs` (additive-only sums; rates
  never summed; zero/lower-is-better targets → no %; unreported ≠ 0; dedup cases incl.
  cross-location reach; trends refusal on incomparable series), `composition.test.mjs`,
  `templates.test.mjs` (every template renders every empty-data state; no slot invents a
  figure), `provenance.test.mjs`.
- Application: infographic-data read (verified-gated finance, cancelled periods excluded,
  archived indicators hidden), CRUD + idempotency + audit, export snapshot immutability.
- Infrastructure: composer determinism (byte-hash), composer escaping, PDF pagination cap,
  repository persistence tests (opt-in DB per convention).
- API: authorization-coverage picks up the new RULES rows; journey: create → customize → export
  → regenerate → old export unchanged.
- Web: `page-layout.test.mts`, `studio-state.test.mts`, copy lint, architecture boundaries,
  server-client boundary; `site-map` parity after the `normalizePlace` delegation.
- Existing suites that must stay green: rls-coverage (two new tables listed), `/ready`
  allowlist, golden reporting corpus (untouched — writers see nothing new).

## §10 Not built (later)

- Inserting an infographic image into a report section (reports keep table-derived and
  Data-Center charts only).
- A "By location" tab in the Data Center UI (the §2 read and §1.2 functions already serve it).
- Drag-and-drop layout editing; custom saved user templates (registry rows only in v1).
- Cross-project / portfolio infographics (`portfolio-rollup.ts` exists when asked).
- Server-side gazetteer matching (coordinates stay a browser concern) and any geocoding API.

## §11 Acceptance-criteria mapping

| Criterion (proposal §8) | Where it is satisfied |
|---|---|
| Generate at any lifecycle stage | Template empty-data contract (§1.3); planning-stage overview |
| Reuse existing records, no duplicate sources | §0 table; §2 one read; §3 stores config + export snapshots only |
| Location comparison when supported | §1.2 `locationComparison`, `locationTargetActual` |
| No fabricated location targets | §1.2 + §7 rule 1; test-pinned |
| Consistent dedup rules | §1.2 `uniqueReach` (one rule, three named metrics) |
| Missing/unverified ≠ zero/verified | §7 rules 1, 4; existing DataSheet/`findingStatus` semantics |
| Existing validation stays authoritative | §7 rule 5; charts only via `buildDataChart`/`optionForType` |
| Save/reopen/customize/regenerate | §3 `ProjectInfographic` + Batch 31.3 |
| PNG/PDF preserve layout | §4 fixed-canvas composer + determinism tests |
| Published versions reproducible | §3 `InfographicExport.snapshotJson` + immutability rule |
| Authorization everywhere | §3 RULES rows, RLS, audit, idempotency |
| Donor-report functionality unaffected | No writer-path changes; existing artifact pathway intact (§5) |
