# Phase 54 — Nutrition analytics for any programme in any country

> **SUPERSEDED 2026-11-13** by `phase54-datasets-and-nutrition-kit.md`. Kept for its honesty rules and decision history; do not build from it.

**DonorDesk Version 3.007** · plan written 2026-11-13 · branch to create: `0023-nutrition-analytics` · status: PLAN ONLY

## 0. Why

A partner sent a 17-page national nutrition dashboard (Pakistan, SNIS, August 2022: overview, partners, districts,
SAM/MAM screening, CMAM admissions and outcomes, PLW in SFP, IYCF, micronutrients, supplies, a refugee response plan and
two "key influencer" pages). Phase 50 rebuilt page 1 as a template. **This phase is different: it does not reproduce that
dashboard.** It gives DonorDesk the capability to build the equivalent for any nutrition programme in any country, from
configuration, with no country or programme named in code.

### 0.1 What exists (verified in code 2026-11-13) and what it covers

| Need | Already built | Where |
|---|---|---|
| Filter bar: place cascade, donor, funding source, partner, relative month, URL state | Phase 50 | `canvas/filters.ts` (`FILTER_DIMENSION_DEFS`) |
| Count cards: districts reached, donors, partners, facilities by type | Phase 50 | `dashboards/count-metrics.ts` |
| Facility types (OTP, SC, TSFP seeded for nutrition) | Phase 50 | `Place.facilityType`, `SUGGESTED_FACILITY_TYPES` |
| Province panels, categorical maps, figure cards | Phase 50 | `MULTI_CARD`, `MAP colorBy` |
| A value per place (district, site) | Phase 53 | `Indicator.recordByPlace`, `placeLevel`, LOCATION breakdown |
| Calculated rates and totals | Phase 33.3 | `logframe/indicator-formula.ts` (`RATIO`, `SUM`, `DIFFERENCE`) |
| Aggregation rules and denominators | Phase 20 | `logframe/indicator-semantics.ts` (`SUM`, `AVERAGE`, `LATEST`, …) |
| 50+ chart kinds, gauges, small multiples | Phases 34, 47, 48 | `reporting/chart-spec-v2.ts` |
| Nutrition indicators with Sphere thresholds (cure > 75 %, default < 15 %, death < 10 %) | Phase 46 | `sector-library/data/nutrition.ts` |
| Forms, offline field app, Kobo/SurveyCTO pull, verify-then-count | Phases 33.5–33.7 | `contexts/collection`, `contexts/integrations` |
| Boundaries to district level for many countries | Phase 49 | OCHA COD-AB |
| Donor vocabulary as data | Phase 52 | `VOCABULARY_PRESETS` |

### 0.2 What is missing (each is a batch below)

| # | Gap | Why it blocks "any country" | Batch |
|---|---|---|---|
| G1 | **Measures beyond sum / ratio.** No ratio-of-sums roll-up of a calculated rate up the place tree; no weighted average; no distinct count (facilities reporting); no reporting completeness (province × month). | Every national dashboard needs "SAM % by province" without averaging district rates, and "who reported". | 54.1 |
| G2 | **No country profile.** Admin level names, reporting calendar, national programme names, thresholds and language are not configuration. | OTP is ITP or "TFP" elsewhere; level 1 is a province, state, region or county; some countries report by epi-week or Ethiopian month. | 54.2 |
| G3 | **No nutrition programme definition.** The library has indicators, not the programme structure (admissions, exits by outcome, case definition, reconciliation). | Without it every project re-invents 60 indicators and their formulas. | 54.3 |
| G4 | **No data-quality rules for programme data.** Nothing checks that exits add up, that begin + admitted − exited = end, or flags an implausible rate. | National data is dirty; a dashboard must say so rather than draw it. | 54.4 |
| G5 | **No supplies.** RUTF, RUSF, F75, F100, Resomal, MNP: received, distributed, lost, balance, months of stock, stock-out. | Pipeline is half of a nutrition programme. | 54.5 |
| G6 | **Charts cannot show a standard.** `ChartSpecV2` has no reference line or band (the Sector Library notes "chart reference lines" as owed); no partner × place coverage matrix. | Thresholds are the point of CMAM performance charts. | 54.6 |
| G7 | **No driver analysis** (the Power BI "key influencers" pages). | Asked for by the partner; needs an honest, explainable method. | 54.7 |
| G8 | **No national-system ingestion.** No DHIS2 connector; connectors are button-driven, not scheduled; no wide monthly-report import. | National data lives in DHIS2 / SNIS, not in field forms. | 54.8 |
| G9 | **No generated nutrition dashboard.** Phase 50.7 builds one fixed template. | A new country must get its own from its profile. | 54.9 |

### 0.3 A correction to the first estimate
The first assessment listed "no donor / partner / month dimension" as the biggest gap. Phase 50 closed it at project level: the
filter bar narrows **projects** by donor and partner. That is sufficient if one project is one partner's award (decision D1).
This plan therefore does **not** add a multi-dimensional fact table.

## 1. Principles for this phase

### 1.1 SOLID, made checkable
"100 % SOLID" cannot be proved by a tool. It can be made **un-ignorable**: each principle becomes a rule with a test that fails the
build, and what no test can see goes on a reviewer checklist (§7.3). Every batch lists its tests under these headings.

| Principle | Rule for this phase | Enforced by |
|---|---|---|
| **S** single responsibility | One file does one job (a rule table, a validator, a reader, a generator). ≤ 300 lines, ≤ 1 class or component. A registry row lives in a data file; the function that reads the registry lives in another. | `architecture-boundaries.test.mjs` extended to the new directories |
| **O** open / closed | Every new capability is **a row in a registry**, never a branch: programmes, measures, quality rules, supply items, case definitions, country presets, connectors, dashboard recipes. Adding a country, a programme or a connector edits no existing function. | New test `no-named-nutrition-outside-registries.test.mjs`: fails when `"OTP"`, `"RUTF"`, `"MUAC"`, an ISO code or a country name appears as a literal outside `*/data/*` rows and fixtures |
| **L** Liskov | Every row of a registry satisfies the registry's one contract. A contract test runs **every row** through the same checks; a row that needs special handling fails it. | `programme-def.contract.test.mjs`, `measure-def.contract.test.mjs`, `quality-rule.contract.test.mjs`, `connector.contract.test.mjs` |
| **I** interface segregation | Readers are narrow ports: `MeasureReader`, `CompletenessReader`, `SupplyItemReader`, `CountryProfileReader`. A measure that needs only a sheet is not handed the place tree. No port has more than 5 methods; no implementation has a no-op method. | Port-size test; lint rule against empty method bodies in adapters |
| **D** dependency inversion | `domain` imports nothing outside `packages/domain`. `application` defines ports and handlers. `infrastructure` implements them and is wired only in `container.ts`. Web features depend on ports, never on adapters, ECharts or MapLibre. | The existing Phase 28 guard, extended; each new context is added to its list |

### 1.2 Honesty rules (carried over, not relaxed)
- A missing value is "Not reported", never 0. A completeness figure is a count of reports received, never a guess.
- **A rate is never summed or averaged across places.** A province rate is `sum(numerator) / sum(denominator)` over its districts (G1). When a denominator is missing for any child, the parent says "partly reported".
- A threshold is shown beside a figure and never replaces the target's stoplight.
- Driver analysis states what it measured and never claims cause.
- Money and partner/funder names never reach a share link (Phase 50 rule); supply quantities may, supply finance may not.
- Nothing leaves the tenant: no external call except the opt-in connector the organisation configures, over public https only, with the existing limits.
- Clinical content (case definitions, thresholds, consumption norms) ships **UNREVIEWED**, like the rest of the Sector Library, until a named reviewer signs it off; the UI shows that state.

### 1.3 Domain boundaries (new bounded contexts)
```
packages/domain/src/contexts/
  measures/        MEASURE_DEFS, rollUp(), completeness(), distinctCount()      (G1)
  country-profile/ CountryProfile, PROFILE_PRESETS, calendar.ts                 (G2)
  nutrition/       PROGRAMME_DEFS, CASE_DEFINITIONS, expandProgramme()          (G3)
  data-quality/    QUALITY_RULES, runRules()                                    (G4)
  supplies/        SUPPLY_ITEMS, stock rules, expandSupplyItem()                (G5)
  analysis/        rankDrivers()                                                (G7)
packages/application/src/use-cases/{measures,nutrition,supplies,analysis,connectors}/
packages/infrastructure/src/{dhis2,measures-sql}/
```
Each context has `index.ts` as its only public surface. Contexts depend on `logframe`, `places` and `core`; none depends on another new
context except through its port (`nutrition` → `measures` and `supplies` via their ports only).

## 2. Decisions the owner must make (recommendation first)

| # | Decision | Recommended | Alternative and why not now |
|---|---|---|---|
| D1 | How is a split recorded? | **Keep the indicator-per-split model.** A partner's award is a project; sex and programme splits are separate indicators (the Pakistan source holds boys and girls as separate columns) generated by `expandProgramme`; place is the LOCATION breakdown. | A multi-dimensional fact table: a new write path, a migration of every report and verified value, and a double-count risk. Revisit only if a cell needs three or more dimensions at once. |
| D2 | Supplies storage | **Generated indicators** (received, distributed, lost, balance) per item, recorded by place, plus a small `SupplyItem` catalogue. Reuses forms, verification, maps and reports. | A stock ledger table: exact, but a second write path and a second set of reports. |
| D3 | Reporting calendars | **Gregorian months and epi-weeks in this phase;** Ethiopian and other calendars as a later preset row (the registry makes it additive). | Build all calendars now: large, and no pilot country asked. |
| D4 | Driver analysis | **Explainable group-difference ranking** with sample size, effect size and a plain sentence. | A regression or ML model: opaque and easy to over-claim; out of scope. |
| D5 | First national connector | **DHIS2** (the dominant source). | Kobo only: already built, but does not reach national data. |
| D6 | Who reviews clinical content | A named nutrition reviewer, using the Sector Library review sheet. Until then everything reads UNREVIEWED. | Ship as reviewed: not acceptable. |

## 3. Batches

Order is fixed by dependency. Each batch is shippable alone, additive, and behind the registries.

### 54.0 Baseline and spike (1 day)
- Verify, by test, the three claims this plan rests on, and **stop and re-plan if any fails**:
  1. Place roll-up of a **formula indicator** (`RATIO`) currently shows the child value and never combines (expected: it does, which is G1).
  2. A `recordByPlace` indicator with 106 districts × 19 projects × 7 periods loads and rolls up inside the dashboard budget.
  3. A project filtered by donor and partner returns the right projects for a 19-partner programme (D1).
- Build a **synthetic national fixture generator** (`test/fixtures/nutrition/generate.mjs`): parameters = number of countries, admin tree, partners, months, programme set. Three fixtures are committed: a South-Asia-like (province → district), an East-Africa-like (county, month, different programme names) and a small camp setting (site-only). They contain **no real data** and no country name in code paths.
- Record timings in `memorybank/imp/phase54-baseline.json`; later batches compare against it.
- No code outside tests. Ship: none.

### 54.1 Measures (G1) — `contexts/measures/`
**Design.** A measure is a row in `MEASURE_DEFS`:
```ts
interface MeasureDef {
  key: MeasureKey;                         // "RATIO_OF_SUMS" | "WEIGHTED_MEAN" | "DISTINCT_COUNT" | "COMPLETENESS" | …
  inputs: readonly MeasureInputSlot[];     // what it needs: numerator, denominator, weight, set of reporters…
  combine(children: readonly MeasureCell[]): MeasureCell;   // pure; null-safe; partly-reported aware
  shareLinkPolicy: "ALLOWED" | "COUNT_ONLY" | "NEVER";
}
```
- `rollUp(def, tree)` walks the place tree once and calls `def.combine`; it never branches on `def.key`.
- `MeasureCell = { value: number | null; coverage: { reported: number; expected: number }; reason?: "NO_DENOMINATOR" | "PARTLY_REPORTED" | … }`.
- **Rate roll-up:** `RATIO_OF_SUMS` combines numerator and denominator cells and recomputes the rate; it is the only legal way a calculated rate reaches a parent place.
- **Completeness:** `reported / expected` where *expected* is the places of a type (facility type from Phase 50) in scope, *reported* those with a verified value in the period. A province × month matrix is a table of these cells.
- **Distinct count:** facilities reporting, partners reporting (feeds `COUNT_METRICS` through its existing `CountReader` port).
- Wiring: `PlaceResultsHandler` asks `MeasureReader` (new port, 3 methods: `cellsFor`, `expectedPlaces`, `coverage`) and renders; the existing "rate is shown for the place that recorded it" rule stays for non-calculated rates.
- **Not built:** user-written formulas (stays at `RATIO | SUM | DIFFERENCE` plus these measures).

**Files (each ≤ 300 lines):** `measures/measure-def.ts`, `measures/data/measure-defs.ts` (rows), `measures/roll-up.ts`, `measures/cell.ts`,
`application/use-cases/measures/measure-reader.port.ts`, `application/.../place-measures.ts`, `infrastructure/measures-sql/*` (read-only SQL adapter, tenant-scoped).
**Migration:** none. **Ships:** api, web (the By-place view and the table block read the new cells).

### 54.2 Country profile (G2) — `contexts/country-profile/`
**Design.** One validated document per organisation (and optionally per project):
```ts
interface CountryProfile {
  countryIso: string;                              // data, never branched on
  adminLevelNames: readonly string[];              // ["Country","Province","District",…] up to level 4
  calendar: "GREGORIAN_MONTH" | "EPI_WEEK";        // registry key (D3)
  programmeAliases: Record<ProgrammeKey, string>;  // "TSFP" → "BSFP"
  thresholds: Partial<Record<ThresholdKey, Threshold>>; // overrides the library defaults
  languages: readonly string[];
}
```
- `PROFILE_PRESETS` (data rows): a generic WHO/Sphere preset plus any country a reviewer adds. A preset is data; a country is never a code path.
- `resolveProfile(org, project)` is the only reader; `levelLabel(profile, n)` replaces literal "province/district" in nutrition screens, the way Phase 52 replaced level names (`useLevelName`).
- `calendar.ts`: a registry `CALENDARS` with `periodsBetween`, `labelOf`, `contains(date)`; the dashboard's relative period (Phase 50) calls it, never `new Date()` arithmetic of its own.
- Stored in `Organization.countryProfileJson` (same pattern as `facilityTypesJson`, validated on write, audited).

**Migration:** `20261118090000_country_profile` (additive column; `/ready` pair). **Ships:** api, web (Settings → Country profile; wizard slide reads it).

### 54.3 Nutrition programme definitions (G3) — `contexts/nutrition/`
**Design.** A programme is a row; the generator is one function.
```ts
interface ProgrammeDef {
  key: ProgrammeKey;                    // "SAM_OUTPATIENT" | "SAM_INPATIENT" | "MAM_SUPPLEMENTARY" | "PLW_SUPPLEMENTARY" | "IYCF" | "MMN_CHILD" | "MMN_PLW" …
  facilityType: string;                 // key into the organisation's facility types
  population: PopulationDef;            // age band, sex rule, PLW
  caseDefinition: CaseDefinitionKey;    // "MUAC_115" | "WHZ_NEG3" | "MUAC_115_125" … (rows in CASE_DEFINITIONS)
  stages: readonly StageDef[];          // admissions, exits {cured, died, defaulted, nonResponder, movedOut}, beginning, end
  splits: readonly SplitKey[];          // "SEX", "AGE_BAND"
  thresholds: readonly ThresholdKey[];
  reconciliation: readonly QualityRuleKey[];   // rows of 54.4
}
```
- `expandProgramme(def, profile, options)` is **pure** and returns `{ indicators, formulas, facilityTypes, formDefinition, dashboardRoles }`: the indicators (one per stage × split, each `recordByPlace` at the facility level), the `SUM` and `RATIO` formulas (cure rate = cured / exits), and a collection form whose questions map to those indicators.
- No programme knows how to draw itself; `dashboardRoles` names headline roles that 54.9 reads (the Sector Library already does this with `headline.ts`).
- The existing `NUTRITION` library pack stays the source of indicator wording; `expandProgramme` links entries by `libraryId`, so the Phase 46 diff and review flow keep working.
- **Case definitions are data** (`CASE_DEFINITIONS`): MUAC cut-offs, z-score cut-offs, oedema rule, age band, citation and review state. The Pakistan "b115 / 115–125" columns are two rows here, not two code branches.
- Wizard: Start slide offers "Nutrition programmes" (choose rows) → Results and Indicators slides fill from `expandProgramme` (the Phase 46 path: "choose from the library").

**Files:** `nutrition/programme-def.ts`, `nutrition/data/programmes.ts`, `nutrition/data/case-definitions.ts`, `nutrition/expand-programme.ts`, `nutrition/stage-def.ts`.
**Migration:** none (output is ordinary indicators and a form). **Ships:** api, web.

### 54.4 Data-quality rules (G4) — `contexts/data-quality/`
**Design.** `QUALITY_RULES` is a table; `runRules(rules, sheet)` returns findings and never throws.
```ts
interface QualityRule { key; severity: "BLOCK" | "WARN" | "NOTE"; applies(def): boolean; check(cells): Finding | null; }
```
Rows: `EXITS_SUM_TO_TOTAL` (cured + died + defaulted + non-responder + moved out = total exits), `STOCK_BALANCE`/`CASE_BALANCE` (beginning + admitted − exited = end), `RATE_IN_RANGE` (0–100), `SUM_OF_SPLITS_EQUALS_TOTAL` (existing rule, reused), `OUTLIER_VS_PEERS` (note only, on a robust z-score against peer places; says "check", not "wrong"), `ADMISSIONS_EXCEED_SCREENED` (block).
- Findings feed the existing verification flow and the evidence-review "verified findings" (`reporting/verified-finding.ts`); a BLOCK stops **verify**, never **draft**.
- A chart or map says how many values it drew with an open WARN ("12 districts have a data-quality note").

**Migration:** none. **Ships:** api, web (a "Data check" column in the Sheet and the verify screen).

### 54.5 Supplies (G5) — `contexts/supplies/`
**Design (D2).** `SUPPLY_ITEMS` rows: key, unit, pack size, linked programme(s), optional consumption norm (units per admission), review state. `expandSupplyItem` returns the indicators (received, distributed, lost/expired, closing balance) as `recordByPlace`, a derived `months of stock` (balance ÷ trailing-3-period distributed, null when none was distributed) and a stock-out flag.
- `STOCK_BALANCE` (54.4) checks opening + received − distributed − lost = closing.
- Pipeline view: a table block of items × place with colour by `months of stock` bands (conditional format from Phase 50; bands are thresholds from the profile).
- **Catalogue per organisation** (`SupplyItem` table) so a country can add its own product names; the library supplies RUTF, RUSF, F75, F100, ReSoMal, micronutrient powders and tablets as unreviewed defaults.
- Share links carry quantities, never cost.

**Migration:** `20261118100000_supply_item` (new table + RLS, `relrowsecurity` checked; `/ready` pair). **Ships:** api, web.

### 54.6 Charts and maps that show a standard (G6)
- **`ChartSpecV2.references[]`** (additive, optional): `{ kind: "LINE" | "BAND", value | from/to, label, role }`. One renderer branch is added by **a new row** in the chart-kind capability table (the Phase 47 pattern), not by editing each kind; `validateChartSpec` refuses a reference on a kind that does not declare `references` in its capabilities (ISP).
- Thresholds come from `profile.thresholds` over library defaults; a chart shows "Reference: Sphere (unreviewed)" when the source is unreviewed.
- **Map bands** from the same thresholds (the `RULES` colour mode exists; this batch only supplies the rows).
- **Coverage matrix** (partner × place, cell = reported / expected from 54.1): one table-block configuration, no new block kind.
- **Verify, do not assume:** split-by-group inside the Studio and small multiples by place; if absent in the Studio, reuse the Visual Studio small-multiples kind and record the gap in `## Not built`.
- Print parity test extended; a reference line is drawn in the file as well as on screen.

**Migration:** none (spec is stored JSON; absent `references` draws as before). **Ships:** web, api (validator).

### 54.7 Driver analysis (G7) — `contexts/analysis/`
**Design (D4).** `rankDrivers(rows, outcomeKey, candidates, options)` is pure and deterministic.
- For each candidate attribute (partner, funder, facility type, province, calendar month, a threshold band) compute the difference in mean outcome between the group and the rest, a standardised effect size (Cohen's d or Cliff's delta, row-registered), group size and a bootstrap interval with a fixed seed.
- **Refuses**, in a plain sentence, when n < 8 per group, when the candidate is constant, or when two candidates are the same grouping (collinear).
- Output model: ranked list + one sentence per row: "Places supported by X had a higher cure rate by 4.1 points (n = 23 vs 61); this shows a difference, not a cause." Rendered as a bar block and a text block; no new chart kind.
- Candidate attributes come from a `DriverCandidateDef` registry (OCP); the outcome is any rate measure.
- Never run on child-level data; only on place × period aggregates.

**Migration:** none. **Ships:** api, web.

### 54.8 National-system ingestion (G8)
**Design.** A connector is an adapter behind the existing collection-connector port; adding DHIS2 must **not** edit Kobo or SurveyCTO code.
- `CONNECTOR_DEFS` registry (key, auth kind, field-map shape, adapter factory) — Kobo and SurveyCTO become rows first, in a pure refactor with the existing tests unchanged (proof of OCP/LSP before DHIS2 is written).
- **DHIS2 adapter** (`infrastructure/dhis2/`): reads `analytics` / `dataValueSets` for chosen data elements and organisation units for a period range; maps `dataElement → indicator` and `orgUnit → Place` by **place code** (P-code or the DHIS2 uid stored as an alias; never by guess; ambiguous = listed, not imported).
- Records land as **pending** collection records and follow the normal verify-then-count path.
- **Scheduled pulls** through the existing `JobOutbox` (idempotent by data-value hash; backoff via the Phase 34.0 job rules; a failed pull is shown, not silent).
- **Wide monthly-report import:** a column map (header → indicator, row key → place) saved per organisation, so a national spreadsheet like the SNIS monthly report loads without per-country code. Same rules as the existing sheet import: one bad row blocks and returns the sheet with a Problems column.
- Security: https to public addresses only, no redirects, size and time limits, key encrypted with `CONNECTOR_SECRET_KEY` (existing rules); nothing is stored from DHIS2 beyond the mapped values.

**Migration:** none expected (`DataConnector` has a kind column; verify in 54.0 and add an additive migration only if not). **Ships:** api, web (Settings → Integrations).

### 54.9 Generated nutrition dashboard (G9)
**Design.** `DASHBOARD_RECIPES` registry. A recipe is a function `(profile, programmes, items) → CanvasDocument` composed from **headline roles** the programme definitions declare, using the existing block kinds only (FILTER_BAR, KPI, MULTI_CARD, MAP, CHART, TABLE, REPEATER). It extends `sector-library/generated-templates.ts`; it does not replace it.
- Recipes (rows): *National overview*, *Screening*, *CMAM admissions and outcomes*, *Programme performance by place* (with thresholds), *PLW and SFP*, *IYCF*, *Micronutrients*, *Supplies and pipeline*, *Reporting completeness*, *Drivers*, *Response-plan view* (a filtered view by funding source).
- Labels use `levelLabel(profile, n)` and programme aliases; blocks a project cannot fill (no supplies recorded) are **omitted with a note**, never drawn empty.
- Phase 50.7's fixed Pakistan template is regenerated from the South-Asia-like fixture and compared with its golden canvas: the generator must reproduce it, which is the regression proof that nothing was lost.
- A "Create nutrition dashboards" action on a project with a nutrition programme (wizard launch step, and Dashboards → New from template).

**Migration:** none. **Ships:** web, api.

### 54.10 Acceptance, documentation, translation
- **Three-country acceptance:** the three fixtures each produce the full recipe set with no code change between them; screenshots compared with goldens; every figure on the generated pages recomputed independently in the test (§6).
- Docs: `memorybank/Features/64-Nutrition-Analytics.md`, a support article, an `AGENTS.md` "Phase 54 invariants" section, `features.md` entry.
- Copy in four languages (en, fr, es, ar) as drafts, like every phase.
- Final full suite **once** (`pnpm -r test`, web unit, relevant harnesses), as the fast-loop rule allows before a release or a migration.

## 4. Data model summary (all additive)

| Change | Kind | Batch | RLS | `/ready` |
|---|---|---|---|---|
| `Organization.countryProfileJson` | column | 54.2 | existing table policy | yes |
| `SupplyItem` | table | 54.5 | new policy; check `relrowsecurity` | yes |
| `DataConnector` kind value `DHIS2` | none or additive | 54.8 | n/a | verify |

No change to `IndicatorUpdate`, `Indicator`, `LogframeItem` or `Place`. Reports, versions and approved exports are untouched.

## 5. Order, dependencies and deploy

```
54.0 ─► 54.1 ─► 54.3 ─► 54.4 ─► 54.9 ─► 54.10
          │       ▲       ▲       ▲
          └─► 54.2┘       │       │
54.1 ─► 54.5 ─────────────┘       │
54.1 ─► 54.6 ─────────────────────┤
54.1 ─► 54.7 ─────────────────────┘
54.2 ─► 54.8 (needs places and profile)
```
- 54.2 and 54.1 can run in parallel; 54.5, 54.6, 54.7, 54.8 are independent after 54.1/54.2.
- Deploy per `AGENTS.md`: migrations before code, RLS checked, `/ready` pairs, `deploy-fast.sh` with the smallest scope (`SCOPE=both` for 54.1, 54.2, 54.5 and 54.8; `web` for 54.6 UI-only parts); `BUILD_ON=local` for web builds (host cap).
- Fast verification loop applies: test and build only what changed per batch; the full suite once at 54.10.

## 6. Tests per batch

| Batch | Domain (`node --test`) | Contract / architecture | Application / API | Harness |
|---|---|---|---|---|
| 54.0 | fixture generator is deterministic | — | the three spike assertions | — |
| 54.1 | `RATIO_OF_SUMS` (parent ≠ mean of children), partly reported, null never 0, completeness, distinct count | `measure-def.contract` runs every row; port ≤ 5 methods | place-results returns cells; authorization coverage | `test:filters` still green |
| 54.2 | profile validation, level labels, calendar contains / periodsBetween (month, epi-week, year boundary) | no ISO or country literal in code | read/write audited | wizard slide |
| 54.3 | `expandProgramme` yields valid indicators and formulas for **every** row; aliases applied; cure rate = cured / exits | `programme-def.contract`; `no-named-nutrition-outside-registries` | wizard "choose programmes" end to end | wizard harness |
| 54.4 | each rule on clean, dirty, empty fixtures; BLOCK blocks verify not draft | `quality-rule.contract` (never throws) | verify screen shows findings | — |
| 54.5 | stock balance, months-of-stock null when no distribution, share-link policy (no cost) | catalogue contract | supply item CRUD under RLS | pipeline table |
| 54.6 | reference line/band validation; refused on a kind without the capability | print-parity includes references | — | `test:studio` subset |
| 54.7 | known-difference fixture ranks correctly; refuses n < 8, constant, collinear; deterministic seed; sentence never says "causes" | `driver-candidate` contract | — | — |
| 54.8 | mapping by code; ambiguous listed; idempotent pull | **`connector.contract` runs Kobo, SurveyCTO, DHIS2 identically**; Kobo/SurveyCTO tests unchanged after the registry refactor | scheduled pull, failure visible, SSRF limits | — |
| 54.9 | each recipe validates (`canvasStructureProblems`); omitted-block notes; golden reproduction of the Pakistan template | recipes use only registered block kinds | create-from-recipe | `test:nutrition-dashboards` (new, signed-in **and** share-link signed-out context) |
| 54.10 | every number on the generated pages recomputed from the fixture | all architecture tests | — | three-country run |

### 6.1 Independent recomputation
The acceptance test does not trust the code under test: it computes each figure of the generated dashboards directly from the fixture's raw rows (a deliberately naive loop in the test) and compares. A rate must equal `Σ numerator / Σ denominator`; a completeness cell must equal reports received ÷ places expected.

## 7. Risks, acceptance and checklist

### 7.1 Risks
| Risk | Mitigation |
|---|---|
| The spike (54.0) shows formula roll-up or scale already works differently | re-plan before 54.1; no later batch starts |
| Clinical definitions or thresholds wrong for a country | all rows UNREVIEWED and labelled; the profile overrides; reviewer sign-off (D6) |
| Indicator-per-split makes a large indicator count (a full CMAM set is ~60 per project) | generation, grouping in the Sheet (existing logframe grouping), and a "family" label; measured in 54.0 |
| DHIS2 variations across countries (custom data sets) | mapping is per organisation and data, not code; ambiguous mapping imports nothing |
| Driver analysis over-read as causal | fixed wording, refusals, "n" always shown, a note on the block |
| Calendars beyond Gregorian/epi-week | additive registry row later (D3); nothing assumes 12 months |
| Share link leaks funder or partner identity | `shareLinkPolicy` on every measure and recipe block; signed-out test |

### 7.2 Element-by-element acceptance (the 17 pages, country-neutral)

| Source page | Capability that provides it | Status |
|---|---|---|
| 1 Overview (totals, districts, donors, partners, facilities, map, province panels, meetings) | filter bar, count metrics, facility types, MULTI_CARD, categorical map | Exists (Phase 50) |
| 2 Partners and where they work | categorical map by partner; coverage matrix | 54.6 (matrix) |
| 3 Districts, screening, new admissions | by-place indicators, top-N bars | Exists (Phase 53) |
| 4–5 SAM / MAM identified, admission, % by month and province | ratio-of-sums roll-up, gauges | 54.1 |
| 6 Admissions by province, gender pies | per-split indicators (D1), `expandProgramme` | 54.3 |
| 7 Outcome pies and exit counts | exits stages, reconciliation | 54.3, 54.4 |
| 8–9 OTP / SFP performance (rates by district, province panels) | rates against thresholds | 54.1, 54.6 |
| 10 Admissions, cured, default by month | trend charts | Exists |
| 11 PLW in SFP | PLW programme row | 54.3 |
| 12 IYCF | IYCF programme row (sessions, caretakers) | 54.3 |
| 13 Micronutrients | MMN rows | 54.3 |
| 14 Supplies | supply items, balances, months of stock | 54.5 |
| 15–16 Response-plan view | funding-source filter + recipe | 54.9 |
| 17 Key influencers | driver analysis | 54.7 |
| "(Blank)" cells | "Not reported" | Exists |
| Data-sharing by province and month | completeness matrix | 54.1 |

### 7.3 SOLID reviewer checklist (what no test can see)
- [ ] Does each new file have one reason to change? Can its name be said without "and"?
- [ ] Is every new variation a row, with the reading function untouched?
- [ ] Can a new row be removed without editing another file?
- [ ] Does any caller need to know which row it got (type test, `instanceof`, `key ===`)? If so, the contract is wrong.
- [ ] Does any adapter implement a method it cannot honour?
- [ ] Is every dependency pointing inward and wired in `container.ts` only?
- [ ] Does any domain test need a database, a clock or the network?

## 8. Not in this phase
A multi-dimensional fact table (D1); Ethiopian and other calendars (D3); regression or machine-learning drivers (D4); a stock ledger (D2); child-level or beneficiary-level nutrition records; forecasting; paginated reports; a custom formula language; native-reviewed translations; clinical sign-off of the library content (D6, owed to a named reviewer).
