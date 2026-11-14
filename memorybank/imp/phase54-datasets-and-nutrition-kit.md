# Phase 54 — Datasets: bring your own table, build Power BI-simple dashboards (first kit: nutrition)

**DonorDesk Version 3.007** · plan written 2026-11-13 · branch to create: `0023-datasets` · status: **BUILT 2026-11-14 (54.0–54.13, deviations in §16.3); deploy and browser check follow**
Supersedes `phase54-nutrition-analytics-v1-superseded.md` (kept for history; §15 lists what was kept and dropped).

## 0. Why

A partner sent a 17-page national nutrition dashboard made in Power BI (Pakistan, SNIS, Jan–Jul 2022): overview with province
panels, partners and where they work, screening and admissions by district, SAM and MAM rates, CMAM admissions and outcomes,
PLWs in supplementary feeding, IYCF, micronutrients, supplies, a refugee-response view and two "key influencer" pages.

The goal is **not** to rebuild that dashboard. It is to let any organisation, for any programme in any country, produce visuals
like it **as simply as Power BI does**. The first content pack is nutrition. Nothing in the code is about nutrition or a country.

### 0.1 Why Power BI feels simple
A Power BI author does four things:

1. **Get data.** One flat table: a row per district × month × partner × donor, a column per figure (`TotalChildScreen`, `NewAdminOTP`, `DisCuredOTP`, `RUTFr`, `Childu2MMNb`, …).
2. **Measures.** Sum, average, count distinct, or a ratio such as cured ÷ exits.
3. **Drag fields** into a visual's wells (axis, values, legend).
4. **Slicers** filter every visual on the page.

### 0.2 What DonorDesk already has (verified in code 2026-11-13)

| Power BI piece | DonorDesk | Where | State |
|---|---|---|---|
| Semantic model (fields with role, type, additivity, joins) | Visual Studio data catalogue | `packages/domain/src/contexts/visual-data/types.ts` (`DataSourceDef`, `FieldDef`) and `catalogue.ts` (`DATA_SOURCES`) | **Built**, but the list is fixed in code: results, work, money |
| Query with honesty checks | `VisualQuery`, `validateVisualQuery` (rate never summed, not-additive never summed, joins declared), `MAX_QUERY_ROWS = 5000` | `visual-data/query.ts` | **Built** |
| Aggregates | `SUM`, `VALUE`, `LATEST` | `visual-data/query.ts` | **Partial**: no count, count distinct, average, min, max |
| Calculated measures | `RATIO`, `SUM`, `DIFFERENCE`, `SHARE` | `visual-data/calculated.ts` | **Built** |
| Readers behind a port | `SourceReader { source, fields, read(scope) }` | `application/use-cases/visual-data/source-readers.ts` | **Built** |
| Visuals, themes, publishing | 60+ chart kinds, 60 themes, canvases, share links, embeds, PDF/PNG/SVG/PPTX, TV mode | Phases 34, 47, 48 | **Built** |
| Slicers and cross-filter | Filter bar v2 (`FILTER_DIMENSION_DEFS`: place cascade, donor, funding source, partner, relative periods, `?f=` URL state), interactions | Phase 50, `canvas/filters.ts`, `canvas/interactions.ts` | **Built** for project data |
| Cards, maps, province panels | `MULTI_CARD`, count metrics, `MAP colorBy` CATEGORY/RULES, callouts, facility types | Phase 50 | **Built** |
| Places and boundaries | Place tree with aliases and P-codes; OCHA boundaries to district level | Phases 33, 49, 53 | **Built** |
| Spreadsheet reading | `exceljs` 4.4.0 | `packages/infrastructure/src/parsers/structured/readers.ts`, exports | **Built** (used for imports and exports) |
| Get data: **your own table** | — | — | **Missing**: no user-supplied source |
| Power Query (rename, retype, unpivot) | — | — | **Missing** |
| Drag into wells | Data panel is click-to-pick (`DataPanel.tsx`, 69 lines) | `apps/web/src/features/visual-data/presentation/` | **Missing** |
| Scheduled refresh | Kobo and SurveyCTO pulls are button-driven; `DataConnector.formId` is required | schema `DataConnector` | **Missing** |
| Reference lines | — (owed since Phase 46) | `reporting/chart-spec-v2.ts` | **Missing** |
| Key influencers | — | — | **Missing** |

**Conclusion.** Three of the four Power BI steps exist. The missing step is bringing your own table. With it, supplies, gender,
partners and donors are just columns, and the 17 pages become an afternoon's work for a user, in any country.

### 0.3 What DonorDesk must do better than Power BI (and keep)
- A gap is "Not reported", never `(Blank)` or 0.
- A rate is never summed or averaged across rows. A province rate is Σ numerator ÷ Σ denominator.
- Problems are named on the row at upload, in a sentence.
- Data stays in the tenant: no external geocoding, tiles or AI calls on dataset rows.
- Figures can feed a donor report, through verification (§3.9), so there is one source of truth.
- It works for field teams too: collection form records can be a dataset (54.9).

## 1. Product principles

### 1.1 Simplicity, made measurable
- **Three nouns in the interface: Dataset, Figure, Visual.** Not "dimension", "measure", "source", "semantic model" or "aggregate". Use "Group by", "Figures", "Filter".
- **Smart defaults, then confirm.** Every guess (column type, place, period, chart) is shown with its reason and changed in one click. Nothing is applied silently.
- **Never a dead end.** Every refusal is a sentence with a one-click fix where one exists (the Phase 34 Chart Studio rule).
- **Progressive disclosure.** The first screen of each step shows what 80 % of people need; "More options" holds the rest.
- **Undo everywhere.** Tidy steps, column choices and visual edits are undoable; a dataset version can be restored.
- **Time targets (acceptance, §10):**
  - upload to first chart: < 3 minutes;
  - upload to a filtered multi-page dashboard from a kit: < 15 minutes;
  - monthly refresh: < 2 minutes.

### 1.2 Honesty (carried from Phases 33–53)
- **Gaps.** A missing cell stays null and shows as "Not reported". An empty group is listed, never drawn as 0.
- **Rates.**
  - A column typed as a rate is never summed or averaged across rows.
  - It may be shown as recorded (one row) or recomputed as a ratio of sums from its parts.
- **Places and periods.**
  - Each is matched by code, then alias, then a unique name. It is never guessed.
  - An unmatched or ambiguous value is listed apart, never dropped and never spread across places.
- **Duplicates.** A duplicate key row (same place, period and grouping) is a problem at upload, never silently summed.

### 1.3 Safety
- **Visibility.**
  - A dataset belongs to a project or to the organisation, and is seen only by people who can see that scope.
  - Outside partners reach a dataset only through an allow-listed route (Phase 28 rule).
- **Share links.**
  - Columns marked `PARTNER`, `DONOR` or money are never shown on a link (the Phase 50 rule).
  - Each column also has a "Hide on shared links" switch.
- **Personal data.** Direct identifiers are removed by default. Only `ADMIN` can keep them, by making the dataset Restricted with a lawful basis and a retention date (§8.2).
- **Files.**
  - The type is taken from the file's bytes (xlsx and csv only).
  - Size and row limits apply (§7).
  - Formula cells are read as values.
  - Exported CSVs neutralise formula injection (existing rule).

### 1.4 For every sector, not only nutrition (owner requirement, 2026-11-13)
Everything in this phase is a **platform capability**. Datasets, tidy steps, figures, wells, slicers, checks, references,
refresh, connectors, completeness, drivers and the indicator bridge contain no sector logic, and the architecture test
(`no-kind-branches`) together with a new `no-sector-in-platform.test.mjs` keep it that way: no sector key or programme word may
appear outside `contexts/datasets/kits/data/*`.
- **A sector differs only by its kit** (§3.8): a data file of columns, aliases, figures, checks and pages. Nutrition is the first kit because a partner asked; it is also the acceptance test.
- **Any dataset works without a kit**: upload, confirm, build by hand. A kit only adds the one-click pages.
- **Follow-on kits** (each a data file plus a reviewer, no code): WASH (water points, litres per person, latrines), health (consultations, vaccinations, referrals), education (enrolment, attendance by sex, learning spaces), food security and cash (households reached, transfer value, market prices), protection (case counts, never case details), shelter/NFI (kits distributed) and the MEAL theme (completeness, feedback and complaints). The Sector Library's 18 headline-role templates (`sector-library/generated-templates.ts`) seed each kit's pages.
- **Acceptance proves it**: 54.13 adds a second, non-nutrition kit fixture (WASH, three pages) built with **no code change**, only a new data file.

### 1.5 SOLID, proportionate and checkable
"100 % SOLID" cannot be proved by a tool, so each principle is a failing test where a test can see it, and a reviewer checklist item where it cannot (§9.4).

| Principle | Rule | Enforced by |
|---|---|---|
| **S** | One file has one job (a registry, a pure function, a reader, a component). ≤ 300 lines and ≤ 1 class or component. A registry's rows and the function that reads them live in separate files. | `test/architecture-boundaries.test.mjs` extended to the new folders |
| **O** | Every variation is a **row in a registry**, never a branch: column kinds, guessers, tidy steps, figure kinds, checks, wells, connectors, kits, filter dimensions. A new step, check or kit edits no existing function. | `no-kind-branches.test.mjs`: no `kind ===`, `switch (…kind)` or `step.type ===` outside the registry readers (the Phase 50 test widened) |
| **L** | Every row satisfies its registry's single contract, tested by running **every row** through one suite. A dataset source passes the same `SourceReader` suite as the built-in sources. | `step.contract`, `figure-kind.contract`, `check.contract`, `well.contract`, `connector.contract`, `source-reader.contract` |
| **I** | Narrow ports: `DatasetStore` (rows), `DatasetCatalog` (definitions), `FileStore` (raw files), `SourceProvider` (catalogue rows). Each consumer gets only the port it uses; no adapter has a no-op method. | Port-use test (a handler imports only the ports its constructor lists); lint rule against empty adapter methods |
| **D** | `domain` imports nothing outside itself. `application` owns ports and handlers. `infrastructure` implements them, wired only in `container.ts`. Web presentation depends on ports and pure `features/*/domain` only. | The Phase 28 dependency guard, with the new contexts added to its lists |

## 2. User journeys (the plan is built backwards from these)

| # | Who | Journey | Target |
|---|---|---|---|
| J1 | Nutrition cluster officer | Uploads the national monthly export (xlsx), confirms columns, picks the **Nutrition kit**, gets 10 pages with slicers and maps | < 15 min, no training |
| J2 | Same | Next month: "Add new months", sees "+106 rows for August, 3 rows changed, 0 problems", dashboards update | < 2 min |
| J3 | Kenya county nutrition coordinator | Same kit with different column names ("Admissions SAM", "Recovered") and counties instead of districts; maps columns once, saved for next time | < 20 min |
| J4 | Programme manager | Shares a link with a donor: figures and maps, no partner names, no money | 3 clicks |
| J5 | M&E officer | "Use this figure for indicator 1.2" so the donor report gets it, through verification | 1 dialog |
| J6 | Field supervisor | Collection form records (Phase 33.5) appear as a dataset, without an upload | automatic |
| J7 | Analyst | Builds a custom chart by dragging "District" to Axis, "Cure rate" to Values, "Partner" to Legend | < 1 min |
| J8 | Data manager | Weekly DHIS2 pull into the dataset, with a visible last-refresh time and failure notice | set once |

## 3. Design

### 3.1 New bounded context `contexts/datasets/` (domain, pure)
```
packages/domain/src/contexts/datasets/
  model.ts             Dataset, DatasetVersion, ColumnDef, ColumnKind, Semantic (types only)
  column-kinds.ts      COLUMN_KINDS registry rows: TEXT, NUMBER, COUNT, AMOUNT, RATE, DATE, MONTH, YES_NO
  semantics.ts         SEMANTICS registry: PLACE, PERIOD, PARTNER, DONOR, FACILITY, SEX, AGE_GROUP, PROGRAMME, NONE
  guess/               GUESSERS registry + guessColumns() (one file per guesser)
  steps/               STEP_DEFS registry + applySteps() (one file per step)
  checks/              CHECK_DEFS registry + runChecks() (one file per check)
  to-source.ts         datasetToSource(dataset): DataSourceDef      (the bridge into the existing catalogue)
  keys.ts              row key = semantic PLACE + PERIOD + chosen grouping columns; duplicate detection
  limits.ts            MAX_ROWS, MAX_COLUMNS, MAX_FILE_BYTES
  index.ts             the only public surface
```

**Column definition.** One shape for every column:
```ts
interface ColumnDef {
  key: string;                 // stable, generated once; survives renames
  label: string;               // what the person sees
  sourceHeader: string;        // header in the uploaded file (for re-upload mapping)
  kind: ColumnKindKey;         // row in COLUMN_KINDS
  semantic: SemanticKey;       // row in SEMANTICS; NONE for an ordinary figure or text
  unit?: string;
  hideOnShareLinks: boolean;
  rateParts?: { numerator: string; denominator: string; percent: boolean };  // lets a RATE be recomputed
}
```
- **Column kind.** Each `COLUMN_KINDS` row declares its role (group or figure), whether it is additive and how it is parsed. A rate is a figure that is not additive; an amount is additive within one currency.
- **Semantic.** Each `SEMANTICS` row declares:
  - the join key it gives the catalogue (`PLACE`, `PERIOD`, `DONOR`, …), from the existing `JOIN_KEYS`;
  - its share-link policy;
  - its resolver (places, periods, partner list, or free text).
- **No branching on kinds.** Nothing branches on a kind or semantic name; behaviour is read from the row.

### 3.2 The catalogue becomes open (the one structural change)
- **Today.** `DATA_SOURCES` is a constant.
- **The change.** A `SourceProvider` port is added, with two providers:
  1. `BuiltInSources`: today's constant.
  2. `DatasetSources`: one `DataSourceDef` per dataset the viewer may see, made by `datasetToSource`.
- **Lookup.** `catalogueFor(scope)` concatenates the providers. `sourceOf`, `fieldOf`, `resolveFieldRef` and `searchFields` take the resolved catalogue instead of reading the constant. This is a mechanical change, covered by the existing visual-data tests.
- **Reader.** `DatasetSourceReader` implements the existing `SourceReader` and passes the same contract suite as the built-in readers (LSP).
- **What works unchanged.** The Studio, canvases, filter bar, share links, alerts, exports and Ask then work on datasets without per-feature code. That is the payoff of the existing design.

### 3.3 Figures (measures) — extend, do not fork
- **Aggregates.** `AGGREGATES` grows by rows: `COUNT`, `COUNT_DISTINCT`, `AVERAGE`, `MIN`, `MAX`. Each row declares:
  - which column kinds it accepts;
  - whether its result is additive;
  - how it combines groups.

  `validateVisualQuery` reads these rows. No new `if` per aggregate.
- **New refusal codes.**
  - `AVERAGE_OF_RATE`: an average of a rate column across rows is refused, with the one-click fix "Recompute from its parts" when `rateParts` exist.
  - `COUNT_DISTINCT_SUMMED`: a distinct count is not additive across groups.
- **Calculated figures.** `CALCULATED_OPS` keeps `RATIO`, `SUM`, `DIFFERENCE` and `SHARE`. `RATIO` over two additive figures is computed as Σ a ÷ Σ b per group (ratio of sums); the documentation and the test pin this. A saved calculated figure belongs to the dataset, so it is reusable across visuals.
- **Plain-words builder.**
  - The builder reads: "Show **[Cured]** as a share of **[Exits]**, as a percentage."
  - It writes the `CalculatedField`.
  - It reads back the definition in a sentence under the figure's name.

### 3.4 Tidy steps (a small Power Query)
`STEP_DEFS` rows. Each step is pure, `apply(table) → table | problem`, with `validate(params, columns)` and `describe(params) → sentence`:

| Step | Example sentence | Why it matters |
|---|---|---|
| `USE_SHEET` / `HEADER_ROW` | "Use sheet 'Data', headers on row 3" | Ministry exports have title rows |
| `RENAME` | "Call 'TotalWomeScreen' 'Women screened'" | Readable labels |
| `RETYPE` | "Treat 'Month' as a month" | Wrong guesses |
| `DROP_COLUMNS` / `KEEP_ROWS_WHERE` | "Leave out rows where Province is 'Total'" | Total rows in exports |
| `FILL_DOWN` | "Fill 'Province' down" | Merged cells |
| `UNPIVOT` | "Turn the January…July columns into rows of Month and Value" | Months as columns |
| `SPLIT` | "Split 'District, Province' at the comma" | Combined fields |
| `MAP_VALUES` | "Read 'Sind' as 'Sindh'" (also saved as a place alias when the column is PLACE) | Spelling differences |
| `APPEND` | "Add rows from 'Supplies.xlsx'" (same columns, checked) | One dataset from many files |

- Steps are stored on the dataset version and **replayed on every refresh**, so a monthly upload needs no rework.
- The step list is shown as sentences, with before and after previews of 20 rows. Each step can be undone, disabled or reordered (reordering is checked).

### 3.5 Checks (named on the row)
`CHECK_DEFS` rows, each declaring its parameters, `run(rows, columns) → Finding[]` and a severity (`BLOCK` stops the save, `WARN` saves with a note, `NOTE` informs):

| Check | Default severity | Example message |
|---|---|---|
| `KEY_UNIQUE` | BLOCK | "Rows 14 and 88 are both Khairpur, May 2022, partner TRDP" |
| `PLACE_KNOWN` | WARN | "3 districts are not in your places: Sind, Q-Shahdadkot, T. T Singh — fix or add" |
| `PERIOD_READABLE` | BLOCK | "Row 9: 'Mya' is not a month" |
| `NOT_NEGATIVE` | BLOCK | "Row 31: RUTF received is −20" |
| `RANGE` | WARN | "Row 40: cure rate 112 % is above 100 %" |
| `SUM_EQUALS` | WARN | "Row 14: exits 812, but cured + default + death + moved + non-response = 790" |
| `BALANCE` | WARN | "Row 22: opening 100 + received 50 − used 30 ≠ closing 140" |
| `NOT_MORE_THAN` | WARN | "Row 7: admitted (420) is more than identified (390)" |

- **Parameters.** Checks are data; a kit ships its own with labelled parameters.
- **Problems sheet.** The person can download their own sheet back with a Problems column (the existing import rule).
- **On visuals.** A visual drawn from rows with an open WARN says so: "Drawn from 1,204 rows; 12 have a data note".

### 3.6 Field wells (drag and drop) — `contexts/visual-data/wells/`
- **Wells.** `WELL_DEFS` declares, per chart family, its wells and what each accepts:

  | Family | Wells |
  |---|---|
  | Bar or line | `AXIS` (group), `VALUES` (figures, 1–n), `LEGEND` (group), `TOOLTIP` (figures), `SMALL_MULTIPLES` (group) |
  | Map | `LOCATION` (PLACE), `COLOUR` (figure or group), `SIZE` (figure) |
  | Card | `VALUES` |
  | Table | `ROWS`, `COLUMNS`, `VALUES` |

- **Query.** `wellsToQuery(kind, wells): VisualQuery` is pure, and its result goes through `validateVisualQuery`. Wells add no new query path.
- **Interaction.**
  - Fields drag from the Data panel, or are clicked then "Add to…".
  - Keyboard: Enter to pick, then the arrow keys to choose a well.
  - On a touch screen, tap then choose.
  - A field that a well cannot take is refused with a reason, e.g. "Cure rate is a rate; it cannot be stacked".
- **Suggest a visual.** The recommender proposes the kind from what is in the wells. Switching kinds keeps whatever fields fit.

### 3.7 Slicers, cross-filter and maps on datasets
- **Filter bar.** `FILTER_DIMENSION_DEFS` gains one generic row, `DATASET_COLUMN`, parameterised by the column. Its options come from the column's distinct values through the existing `filter-options` endpoint, so no per-dataset code is needed.
  - A `PLACE` column uses the existing hierarchical place cascade.
  - A `PERIOD` column uses relative periods.
- **Cross-filter.** Clicking a bar, slice or area sets the filter. This uses the existing interactions, because dataset fields are ordinary catalogue fields.
- **Maps.** A `PLACE` column joins to places, so by-place maps, `colorBy` CATEGORY/RULES and callouts work.
- **Share links.** A link applies the dataset's share policy. Hidden columns are neither offered nor drawn.

### 3.8 Kits (content, not code) — first kit: Nutrition
A kit is a data file validated by `validateKit`:
```ts
interface Kit {
  key: string; title: string; reviewState: "UNREVIEWED" | "REVIEWED"; source: string;
  columns: KitColumn[];        // role, label, kind, semantic, aliases (header synonyms in any language), unit, rateParts
  figures: CalculatedField[];  // cure rate, default rate, death rate, SAM %, MAM %, months of stock …
  checks: KitCheck[];          // exits add up, stock balance, admitted ≤ identified …
  pages: KitPage[];            // canvas templates whose blocks name kit column roles, never column keys
  sampleFile: string;          // downloadable template sheet with headers and one example row
}
```
- **Matching.**
  - `matchKit(dataset, kit)` maps the dataset's columns to the kit's roles: aliases first, then the person confirms. The mapping is saved, so the next upload maps itself.
  - A page block whose role is not mapped is **left out with a note** ("No supply columns: Supplies page skipped"). It is never drawn empty.
  - `buildPages(kit, mapping) → CanvasDocument[]` is pure, and uses only existing block kinds.
- **Nutrition kit content (unreviewed until D6):**

  | Group | Content |
  |---|---|
  | Screening | children and women screened |
  | Identified | SAM and MAM identified (MUAC or z-score), with the case definition as a column note, not code |
  | Admissions and exits | admissions per programme (OTP, SC, TSFP, PLW-SFP); exits by outcome (cured, default, death, moved out, non-response) |
  | Other services | IYCF sessions and caretakers (community and facility); MMN children (boys and girls) and women; IFA women |
  | Supplies | RUTF, RUSF, F75, F100, ReSoMal, MNP, MMN tablets, IFA, MUAC tapes: received, used and balance |
  | Thresholds | Sphere references: cure > 75 %, death < 10 %, default < 15 % |

- **Pages:** overview, partners and coverage, screening, SAM and MAM identification, admissions, outcomes and performance by place, PLW, IYCF, micronutrients, supplies and pipeline, data completeness.
- **Other kits later.** Kits for WASH, health, education and cash use the same mechanism, and the Sector Library's headline roles can seed them.

### 3.9 Bridge to the logframe (one source of truth for donor reports)
- **The link.** "Use this figure for indicator X" creates a `DatasetIndicatorLink`:
  - indicator;
  - figure (a column or calculated figure);
  - filter, e.g. partner = us;
  - period mapping;
  - whether the value is recorded by place (Phase 53).
- **Effect.** On save or refresh, linked figures are written as **draft** indicator values through the normal indicator save. Entry windows, locks and verification therefore still apply.
- **Safeguards.**
  - A verified value is never overwritten. A difference becomes a "changed since verified" note for the reviewer.
  - A rate figure links only to a rate indicator, and only with its parts (ratio of sums).

### 3.10 Refresh and connectors
- **Re-upload.** The person chooses:
  - **Replace** creates a new version.
  - **Add new periods** adds rows whose period is not yet in the dataset.

  Before saving, a diff summary shows the rows added, changed and removed and the problems. Versions are immutable: the last 10 are kept, and one can be restored.
- **Connectors.** A `CONNECTOR_DEFS` registry is added:
  1. Kobo and SurveyCTO become rows first, in a refactor with their tests unchanged.
  2. A **DHIS2** row is then added: analytics or `dataValueSets` for chosen data elements and organisation units. Units map to places by code or alias. An ambiguous unit is listed and not imported.
  3. `DataConnector` gains a nullable `datasetId`, and `formId` becomes nullable, so a connector can target a dataset.
- **Scheduled pulls.** Pulls run through `JobOutbox` (daily, weekly or monthly), are idempotent by row hash and back off on failure. A failure shows on the dataset and notifies its owner.
- **Collection forms as datasets (J6).** A `FormRecordsSource` provider exposes accepted records of a form as a dataset source, read-only and with no copy stored.

### 3.11 Coverage, completeness and drivers
- **Completeness.** A `COMPLETENESS` figure kind: places or facilities that reported ÷ places expected, per period. "Expected" means places of a level or facility type in scope (Phase 50 facility types). This draws the "data sharing by province × month" table.
- **Coverage matrix.** Partner × place presence, as a table block configuration. No new block kind.
- **Driver analysis (last batch, optional):**
  - `rankDrivers(rows, figure, candidates)` is pure and deterministic. It ranks group-mean differences with an effect size, group sizes (n) and a seeded bootstrap interval.
  - It refuses when a group has fewer than 8 rows, when a candidate is constant, or when two candidates are duplicates.
  - The wording is fixed: "Places supported by X had a cure rate 4.1 points higher (n = 23 vs 61). This shows a difference, not a cause."

### 3.12 Standards on charts
- **Reference lines and bands.** `ChartSpecV2.references[]` is added, optional: `{ kind: LINE | BAND, value | from/to, label, role }`.
  - A chart kind accepts references only when its capability row declares `references` (the Phase 47/50 capability pattern).
  - Kit thresholds become references automatically, labelled with their source and review state.
- **Map bands.** `RULES` colouring takes its bands from kit thresholds. No new map code.
- **Print parity.** References are drawn in files as on screen.

## 4. Interface specification

### 4.1 Where it lives
- **Data → Datasets** in the navigation, and a **Datasets** tab on each project.
- In the Visual Studio, the Data panel lists datasets above built-in sources, and offers "+ New dataset".

### 4.2 Screens (each ≤ one decision at a time)
1. **Add data.**
   - Upload: drag a file or browse; xlsx or csv.
   - Or connect: Kobo, SurveyCTO, DHIS2.
   - Or use form records.
   - Or start from a kit's template ("Download the Nutrition template").
2. **Choose the table.** Sheet picker with thumbnails, and automatic header-row detection: "Headers look like row 3 — change".
3. **Confirm columns.** One row per column:
   - the header;
   - 5 sample values;
   - "We think this is **District** (a place) — 103 of 106 match your places";
   - a kind chip and a "Hide on shared links" switch.

   Low-confidence guesses are highlighted. The kit match is offered here: "This looks like the Nutrition kit (24 of 31 columns matched) — use it?"
4. **Fix places and periods.** Unmatched values with suggested matches; "Remember 'Sind' as Sindh" saves a place alias.
5. **Tidy** (optional, behind "Tidy the table"). Step list as sentences, and a before/after preview.
6. **Check.** Problems grouped by check, each naming the row. Choices: "Download my sheet with problems", or "Save anyway" when there are only warnings.
7. **Done.** Three buttons:
   - **Make dashboards from the kit**;
   - **Build a chart**;
   - **Use for indicators**.

**Refresh** is a single dialog on the dataset page: "Replace" or "Add new months", then the diff summary, then save.

### 4.3 Wording rules
- **Plain words.**

  | Instead of | Say |
  |---|---|
  | dimension | Group by |
  | measure | Figure |
  | aggregate | How to combine |
  | null | Not reported |

- **Example problem sentence.** "Row 14: exits 812, but the outcomes add to 790."
- **Languages.** en, fr, es and ar, with RTL checked; all copy is drafts until a native review.
- **No developer terms.** No UUID, JSON or SQL ever reaches the screen.

### 4.4 States
- Every screen designs its empty, loading, partial and error states, plus offline where it applies.
- A long upload shows progress and can be left. It finishes on the server, and the person is notified.

### 4.5 Access
- Full keyboard path, including the wells (§3.6).
- Screen-reader labels and announcements.
- Colour never carries meaning alone.
- Phone: upload, confirm and view work. Building with wells needs a tablet or larger, and the screen says so.

## 5. Data model (Prisma; all new tables have RLS, `relrowsecurity` checked, `/ready` pairs)

| Model | Fields (essential) | Batch |
|---|---|---|
| `Dataset` | id, tenantId, projectId?, name, description, kitKey?, kitMappingJson, currentVersionId, sharePolicyJson, **restricted** (bool), **restrictionJson** (lawful basis, purpose, retainUntil, named viewer ids; required when restricted), createdById, timestamps | 54.1 |
| `DatasetVersion` | id, tenantId, datasetId, number, columnsJson, stepsJson, figuresJson, checksJson, rowCount, fileKey, fileHash, findingsJson, **status** (`PENDING` \| `ACCEPTED` \| `REJECTED`; a contributor's upload starts `PENDING`), **decidedById**, **decisionNote**, createdById, createdAt (content immutable) | 54.1 |
| `DatasetRow` | tenantId, versionId, rowNo, placeId?, periodKey?, valuesJson (jsonb) — PK (versionId, rowNo); index (versionId, placeId, periodKey) | 54.1 |
| `DatasetIndicatorLink` | id, tenantId, datasetId, indicatorId, figureRef, filterJson, periodMapJson, byPlace, createdById | 54.10 |
| `DataConnector` | + `datasetId` (nullable); `formId` becomes nullable; check: exactly one target | 54.9 |

- **Resolved keys.** Place and period are resolved at save time and stored next to the raw value (`placeId`, `periodKey`), so filters and maps never re-resolve.
- **Raw values.** The values stay as typed in `valuesJson`.
- **Raw file.** The original file goes to `IStorage` (encrypted at rest like evidence) so the steps can be replayed. It is deleted with the version.
- **Current version.** `Dataset.currentVersionId` always points to an `ACCEPTED` version. A `PENDING` upload is visible only to its uploader and the managers until accepted.
- **Kit copies and reviews (D6) need no new table.** An organisation's or project's copy of a kit (its own aliases, thresholds and pages) and its review record (`reviewedById`, role, date, note) are stored as `OrganisationLibraryEntry` rows with `kind = "KIT"`, the same mechanism the Sector Library uses for organisation entries.
- **Permissions (D3).** `dataset.manage` goes to `ADMIN` (organisation and project datasets) and `PROJECT_MANAGER` (their projects). `dataset.contribute` goes to `FIELD_OFFICER` and to outside partners on their projects (added to `EXTERNAL_ALLOWED`). Viewing follows `project.view`. Making a dataset Restricted needs `org.manage`.

## 6. Batches

Each batch is shippable alone, additive, test-gated and deployed with `deploy-fast.sh` at the smallest scope. Exit criteria are what must be true before the next batch starts.

### 54.0 Spike: storage, speed and guesses (1–2 days) — no product code
- **Storage benchmark.** `DatasetRow` with jsonb on a synthetic national table (200,000 rows × 60 columns). Measure group-by-2 sum, ratio of sums and count distinct, with filters, on the production-sized Postgres.
  - Budget: p95 < 800 ms per query, < 150 MB API memory.
  - Fallback if missed: typed numeric columns in a side table (`DatasetCell`). A columnar engine (DuckDB) is **rejected** for this phase because the host's 3 GB build and memory cap is already tight (AGENTS.md).
- **Guess prototype.** Run the column guessers on three real-format synthetic files: SNIS-like wide, Kenya-like (counties, different headers) and months-as-columns. Target ≥ 90 % of columns correct before confirmation.
- **Catalogue seam.** Prove the `SourceProvider` change compiles with the existing visual-data tests unchanged.
- **Fixtures.** `test/fixtures/datasets/generate.mjs` makes deterministic synthetic files with no real data and no real names.
- **Exit:** budgets met or the fallback chosen; results recorded in `memorybank/imp/phase54-baseline.json`.

### 54.1 Datasets: upload, confirm, save (J1 first half, J7 partially)
- **Domain.**
  - `datasets/` model, `COLUMN_KINDS`, `SEMANTICS`, `GUESSERS`, `keys.ts`, `limits.ts`, `to-source.ts`.
  - Checks `KEY_UNIQUE`, `PLACE_KNOWN`, `PERIOD_READABLE`.
  - `PII_DETECTORS` with default removal, and the Restricted tier (§8.2). No dataset upload ships without them.
  - `dataset.manage` / `dataset.contribute` permissions (D3); contributor uploads wait for acceptance.
- **Application.**
  - Handlers: `CreateDatasetHandler`, `ConfirmColumnsHandler`, `SaveVersionHandler`, `ListDatasetsHandler`, `DeleteDatasetHandler`.
  - Ports: `DatasetStore`, `DatasetCatalog`, `FileStore`.
- **Infrastructure.**
  - Prisma adapters.
  - An `exceljs`/csv reader that streams rows and stops at the limits.
  - `DatasetSourceReader`.
  - `DatasetSources` provider.
- **API.** `POST /v1/datasets` (upload), `PUT /v1/datasets/:id/columns`, `POST /v1/datasets/:id/versions`, `GET /v1/datasets[/:id]`, `DELETE`. All are in `RULES`. Outside partners get only `project` datasets of their projects, listed in `EXTERNAL_ALLOWED`.
- **Web.**
  - Screens 1–4 and 6 of §4.2.
  - Datasets list.
  - Datasets appear in the existing Data panel (click-to-pick works at once).
- **Migration:** `20261118090000_datasets` (three tables + RLS).
- **Exit:** a SNIS-like file uploads, confirms and shows up as a source; a chart drawn with click-to-pick matches an independently computed total.

### 54.2 Figures: aggregates, rates and the plain-words builder
- **Aggregates.** `COUNT`, `COUNT_DISTINCT`, `AVERAGE`, `MIN` and `MAX` added to `AGGREGATES` as rows.
- **Refusals.** The `AVERAGE_OF_RATE` and `COUNT_DISTINCT_SUMMED` refusal codes, with one-click fixes.
- **Ratio of sums.** Recomputing from `rateParts` and `RATIO` over additive inputs, pinned by tests.
- **Builder.** Plain-words builder, with the figure stored on the dataset version.
- **Migration:** none (stored in `figuresJson`).
- **Exit:** "cure rate by province" equals Σ cured ÷ Σ exits over its districts; the average of district rates is refused.

### 54.3 Drag and drop: wells and suggestions (J7)
- **Wells.** `WELL_DEFS` and `wellsToQuery` in the domain.
- **Studio.** Wells in the Chart Studio's right column. Drag uses the HTML5 drag-and-drop API through a small adapter, with keyboard and touch paths.
- **Kind switching.** Switching the chart kind keeps the fields that fit and names the ones dropped.
- **Recommender.** "Suggest a visual" reads the wells.
- **Exit:** J7 done in under 1 minute by a test user (§10). The harness `test:wells` covers mouse, keyboard and touch.

### 54.4 Slicers, cross-filter and maps on datasets (J1 second half)
- **Filter bar.** A `DATASET_COLUMN` filter dimension row. Place cascade and relative periods for `PLACE` and `PERIOD` columns.
- **Cross-filter.** Clicking a bar, slice or area filters through the existing interactions.
- **Maps.** Maps and callouts on dataset `PLACE` columns.
- **Share links.** The share policy is applied to options and to drawing.
- **Exit:** a three-page canvas on a dataset filters by province → district, partner and month; a signed-out share-link check hides partner and donor columns.

### 54.5 Tidy steps
- **Steps.** `STEP_DEFS`: `USE_SHEET`, `HEADER_ROW`, `RENAME`, `RETYPE`, `DROP_COLUMNS`, `KEEP_ROWS_WHERE`, `FILL_DOWN`, `UNPIVOT`, `SPLIT`, `MAP_VALUES`, `APPEND`.
- **Replay.** Steps replay on refresh. Each has a preview and undo.
- **Place aliases.** `MAP_VALUES` on a `PLACE` column offers to save a place alias. The place list stays the single source of names.
- **Exit:** a months-as-columns file becomes Month/Value rows; a re-upload of next month's file replays without questions.

### 54.6 Checks with row-level messages
- **Checks.** `NOT_NEGATIVE`, `RANGE`, `SUM_EQUALS`, `BALANCE` and `NOT_MORE_THAN` added.
- **Problems sheet.** The person's own file comes back with a Problems column.
- **On visuals.** Visual notes give the count of rows with open warnings.
- **Exit:** each check is shown on a dirty fixture with the exact row and sentence; clean fixtures give no findings.

### 54.7 Kits: the Nutrition kit and "make dashboards" (J1 complete, J3)
- **Mechanism.** `Kit` model, `validateKit`, `matchKit`, `buildPages`, and the kit registry with one row.
- **Nutrition kit content (§3.8).** Columns, aliases in en/fr/es/ar plus common ministry header variants, figures, checks, 11 pages and a template sheet. Every item is marked **UNREVIEWED** (D6).
- **Saved mapping.** The column mapping is saved on the dataset for future uploads.
- **Regression.** The Phase 50.7 Pakistan template is regenerated from the kit on the SNIS-like fixture and compared with its golden canvas. Every element must be present.
- **Exit:** J1 < 15 min and J3 < 20 min with test users; pages without data are left out with a note.

### 54.8 Standards on charts
- **References.** `references[]` on `ChartSpecV2`, a capability row, and a renderer through the capability table.
- **Kit thresholds.** Thresholds become references and map bands.
- **Conditional colours.** Reuse the Phase 50 conditional formatting, with thresholds as rules.
- **Print parity.** The parity test is extended.
- **Exit:** the cure-rate-by-district chart shows the 75 % line, labelled "Sphere (unreviewed)", on screen and in PDF.

### 54.9 Refresh, versions and connectors (J2, J6, J8)
- **Re-upload.** Replace or add new periods, with a diff summary, 10 immutable versions and restore.
- **Connectors.**
  - `CONNECTOR_DEFS` refactor (Kobo and SurveyCTO as rows, tests unchanged).
  - DHIS2 adapter.
  - `DataConnector.datasetId`.
  - Scheduled pulls via `JobOutbox`, with failure shown and notified.
- **Form records.** `FormRecordsSource` provider.
- **Migration:** `20261118100000_connector_dataset_target`.
- **Exit:** J2 < 2 min; a DHIS2 pull against a recorded fixture server is idempotent; the connector contract passes for all three connectors.

### 54.10 Bridge to indicators (J5)
- **Links.** `DatasetIndicatorLink`, with draft values written through the indicator save and never over a verified value.
- **Dialog.** A one-dialog "Use for indicator" flow, and a list of links on the indicator page.
- **Suggested links (§8.1).** The confirm screen proposes links when a column's name, unit or kit role matches an indicator. The dataset page lists the indicators it feeds; the indicator page names its dataset, column and filter.
- **Migration:** `20261118110000_dataset_indicator_link`.
- **Exit:** a refresh updates draft values; a verified value shows "changed since verified" instead of being replaced.

### 54.11 Completeness and coverage
- **Completeness.** `COMPLETENESS` figure kind, and the province × month completeness table.
- **Coverage.** Partner × place coverage matrix configuration.
- **Kit pages.** The kit's "Data completeness" page uses both.
- **Exit:** the completeness cells equal an independently computed reported ÷ expected.

### 54.12 Driver analysis (optional; owner decision D4)
- **Analysis.** `rankDrivers` and a `DRIVER_CANDIDATES` registry, drawn as a bar block plus a sentence block. It refuses below n = 8.
- **Exit:** a known-difference fixture ranks correctly; no output sentence contains "cause" except "not a cause".

### 54.13 Acceptance, usability, documentation
- **Usability test** (§10), with fixes from it shipped in this batch.
- **Sector-neutral proof (§1.4).** A WASH kit fixture (three pages) is added as a data file only, with no code change, and its pages build and pass the recomputation test.
- **Personal data (§8.2).** `PII_DETECTORS`, default removal, and the Restricted tier with its guest, AI and partner refusals. This must ship by 54.1's release at the latest; this bullet is the final check.
- **Documentation.**
  - `memorybank/Features/64-Datasets.md` and `65-Nutrition-Kit.md`.
  - Support articles: "Bring your own table" and "Make nutrition dashboards in 15 minutes".
  - `AGENTS.md` "Phase 54 invariants", and the `features.md` entry.
- **Full suites once** (`pnpm -r test`, web unit, harnesses), as the fast-loop rule allows before a release with migrations.

### 6.1 Order
```
54.0 ─► 54.1 ─► 54.2 ─► 54.3 ─► 54.4 ─► 54.7 ─► 54.13
                  │               ▲       ▲
                  ├─► 54.5 ───────┘       │
                  ├─► 54.6 ───────────────┤
                  ├─► 54.8 ───────────────┤
                  └─► 54.11 ──────────────┘
54.1 ─► 54.9 ─► 54.10           54.12 any time after 54.2
```
**Early value:**
- After 54.1, people can upload and chart.
- After 54.4, people can build Power BI-style dashboards by hand.
- After 54.7, one click gives the full nutrition set.

## 7. Limits and performance budgets

| Item | Limit | Reason |
|---|---|---|
| File | 20 MB, xlsx or csv | Upload and parse within a request budget |
| Rows per version | 200,000 (confirmed or changed in 54.0) | A national monthly table for years is < 100,000 |
| Columns | 200 | Wide ministry exports reach ~120 |
| Query result | existing `MAX_QUERY_ROWS` 5,000 groups | Visuals draw aggregates, not rows |
| Upload to confirm screen | p95 < 5 s for 50,000 rows | J1 time target |
| A visual on a 200,000-row dataset | p95 < 800 ms | Same as Phase 50 tiles |
| Datasets per organisation | 200 by default (plan entitlement) | Billing rows (`EntitlementGrant`) |

## 8. Decisions (owner answers recorded 2026-11-13)

| # | Decision | Status | Outcome |
|---|---|---|---|
| D1 | Analytics data model | **Decided: separate storage, one experience** (§8.1) | Datasets are their own read-only layer; indicators stay the verified donor figures; suggested links and mixed canvases make it feel like one thing |
| D2 | Storage | **Decided: Postgres jsonb rows**, resolved place and period keys; typed-cell fallback if 54.0 misses the budget | — |
| D3 | Who may create and change datasets | **Decided: Owner (`ADMIN`) or Project Manager (`PROJECT_MANAGER`)** | Organisation datasets: `ADMIN`. Project datasets: `ADMIN` or that project's `PROJECT_MANAGER`. Everyone who can see the scope can view and build visuals. Field officers and outside partners may **add data to** an existing dataset (upload a new month, connector-free) but not create, delete or change its columns; their uploads wait for a manager's acceptance, like collection records. New permissions `dataset.manage` and `dataset.contribute`, added to `ROLE_PERMISSIONS` (`packages/domain/src/policies/permissions.ts`). |
| D4 | Driver analysis | **Adopted on recommendation**: ship last (54.12), explainable only | Owner may drop it without affecting other batches |
| D5 | First connector | **Adopted on recommendation**: DHIS2 | Kobo and SurveyCTO move into the same registry first |
| D6 | Who reviews a kit | **Decided: Owner (`ADMIN`) or Project Manager** | Organisation-wide kit: `ADMIN` marks it reviewed; a project's copy (its own thresholds or aliases): that project's PM. The review records **name, role, date and a note**, and the kit shows "Reviewed by J. Doe (Project Manager), 14 Nov 2026"; built-in defaults keep their source label (Sphere, WHO). Advice shown to the reviewer: clinical items (case definitions, thresholds) should be checked with a nutrition specialist; the app records who reviewed, not whether they were qualified. |
| D7 | Personal-data columns | **Decided on recommendation (§8.2)** | — |
| D8 | Plan entitlement | **Adopted on recommendation**: datasets in all paid plans, row and dataset limits by plan | Limits are `EntitlementGrant` rows; the trial gets 3 datasets × 20,000 rows |

### 8.1 D1 — why a dataset is not stored as indicator values
"Separate" means **separate storage and trust, not a separate place in the product**. A person sees one Data panel, one set of
dashboards, one filter bar and one map whether a figure came from an indicator or a dataset.

The two kinds of data behave differently, which is why they are not merged:

| | Indicator value | Dataset row |
|---|---|---|
| What it is | The figure a donor is told, for one indicator and period | Any figure in an operational table (60 columns, 100,000 rows) |
| Lifecycle | Draft → verified → locked in an approved report; changing it later needs a reason (Phase 52) | Replaced every month by a re-upload or a pull |
| Volume | Tens per project per period | Up to 200,000 rows per version |
| Who trusts it | Donor, auditor | Programme team |

Merging them would force a choice between two bad outcomes: every upload creating thousands of draft values that someone must
verify, or uploads bypassing verification and quietly changing figures in approved donor reports.

**What keeps it simple anyway (added to 54.10):**
- **Suggested links.** When a dataset column's name, unit or kit role matches an indicator, the confirm screen offers "Use for indicator 1.2 — Children with SAM admitted?" One tick creates the link.
- **One click from either side.** An indicator page shows "Fed by: National nutrition dataset, column NewAdminOTP, filter partner = us", and the dataset shows which indicators it feeds.
- **Same dashboards.** A canvas may mix indicator figures and dataset figures on one page, joined by place and period.

If after this you still prefer one store, the alternative is v1's generated-indicator model (§15). It works, but it is slower and
heavier for users.

### 8.2 D7 — personal data in datasets (recommendation, adopted)
Datasets are for **figures**, not people. The rule has three tiers:

1. **Blocked by default: direct identifiers.** Names, phone numbers, national or registration ID numbers, email addresses, and exact household GPS points are detected by header and by value pattern (`PII_DETECTORS` registry: header synonyms in four languages, phone, email and ID patterns, coordinate precision finer than about 100 m). The confirm screen says "This column looks like personal data (phone numbers). Datasets hold figures; remove it?" with **Remove column** as the default action. The removal is a recorded tidy step, so it repeats on every refresh.
2. **Allowed: aggregate and pseudonymous data.** Counts by place, period, sex and age group; case codes that are not names; facility coordinates (a place, not a person).
3. **Exception: line lists, `ADMIN` only.** If an organisation genuinely needs person-level rows (a case line list), only `ADMIN` can switch a dataset to **Restricted** and must record a lawful basis (consent, legal duty, vital interest), a purpose and a retention date. A Restricted dataset is:
   - never available to share links, embeds, Ask DonorDesk, exports to donors, or outside partners;
   - visible only to people named on it;
   - shown with a "Restricted — personal data" banner;
   - deleted or reviewed at its retention date (reminder through `JobOutbox`);
   - audited on every view and download.

The organisation's data protection settings and the DPA page (`/dpa`) name this tier. Tests: each detector on fixture columns, the default
removal replayed on refresh, a Restricted dataset refused on every guest and AI path.

## 9. Tests

### 9.1 Per batch (in addition to each batch's exit criteria)
| Batch | Domain (`node --test`) | Contract and architecture | Application and API | Browser harness |
|---|---|---|---|---|
| 54.1 | guessers per fixture; key uniqueness; limits; `datasetToSource` fields and joins | `source-reader.contract` passes for `DatasetSourceReader`; catalogue seam; dependency guard | upload, confirm, save; RLS isolation between tenants; partner allow-list | `test:datasets-upload` |
| 54.2 | each aggregate row; `AVERAGE_OF_RATE` refusal; ratio of sums | `figure-kind.contract` | query endpoint on datasets | — |
| 54.3 | `wellsToQuery` for every family; refusals | `well.contract` (every well accepts only what it declares) | — | `test:wells` (mouse, keyboard, touch) |
| 54.4 | `DATASET_COLUMN` options and cascade | no kind branches | filter-options on datasets; share-link column hiding | `test:filters` extended; signed-out link check |
| 54.5 | each step apply, validate, describe; replay idempotent | `step.contract` (pure, reversible preview) | — | `test:tidy` |
| 54.6 | each check on clean, dirty, empty | `check.contract` (never throws) | problems sheet download | — |
| 54.7 | `matchKit`, `buildPages` (omits missing roles), `validateKit` | kit pages use registered block kinds only | create dashboards from kit | `test:nutrition-kit`; Pakistan golden regeneration |
| 54.8 | reference validation; refused on kinds without the capability | print parity | — | `test:studio` subset |
| 54.9 | diff summary; version restore; DHIS2 mapping by code; idempotent pulls | `connector.contract` for Kobo, SurveyCTO, DHIS2 (Kobo and SurveyCTO tests unchanged) | scheduled pull, failure notice, SSRF limits | — |
| 54.10 | link validation (rate to rate with parts) | — | draft write; verified value never overwritten | — |
| 54.11 | completeness cells; coverage matrix | — | — | — |
| 54.12 | known-difference ranking; refusals; fixed wording | `driver-candidate.contract` | — | — |

### 9.2 Independent recomputation
Acceptance tests do not trust the code under test. Each figure on generated pages is recomputed in the test from the fixture's raw rows with a naive loop and compared:
- a rate as Σ numerator ÷ Σ denominator;
- a completeness cell as reported ÷ expected;
- a count distinct by set size.

### 9.3 Security tests
- Tenant isolation on all new tables (RLS on, cross-tenant read refused).
- File-type sniffing.
- Oversize and over-row files refused with a sentence.
- Formula cells read as values.
- CSV export injection neutralised.
- Personal-data warning raised on fixture columns.
- Share links never carry `PARTNER`, `DONOR`, money or hidden columns.

### 9.4 SOLID reviewer checklist (what no test sees)
- [ ] Can each new file's job be said without "and"?
- [ ] Is every new variation a row, with the reading function untouched?
- [ ] Could a row be deleted without editing another file?
- [ ] Does any caller need to know which row it received? If so, the contract is wrong.
- [ ] Does any adapter implement a method it cannot honour?
- [ ] Do all dependencies point inward, wired only in `container.ts`?
- [ ] Does any domain test need a database, the clock or the network?

## 10. Usability acceptance (with real people, not only harnesses)
- **Participants.** Five people who have never used DonorDesk: two nutrition officers, one M&E officer, one data manager and one programme manager. At least one works in French or Arabic.
- **Tasks:**
  - J1 and J3 with the synthetic files;
  - J7: "show cure rate by district, coloured by partner";
  - J4: share with a donor;
  - J2: refresh.
- **Pass.**
  - ≥ 4 of 5 complete each task unaided, within the §1.1 targets.
  - System Usability Scale ≥ 75.
  - No task produces a wrong number unnoticed.
- **Findings.** Every finding is logged in `memorybank/demo/usability-phase54.md` and fixed or explicitly deferred in 54.13.

## 11. Element-by-element acceptance (the 17 source pages, made from the Nutrition kit)

| Source page | How it is made | Batch |
|---|---|---|
| 1 Overview (totals, districts, donors, partners, OTP/SC/SFP counts, map, province panels, meetings) | Kit page; KPI, `MULTI_CARD`, count distinct of District, Donor and Partner columns; categorical map; callouts | 54.2, 54.4, 54.7 |
| 2 Partners and where they work | Map coloured by Partner column; bar of children reached by partner | 54.4 |
| 3 Screening and admissions by district | Stacked bars, Axis = District, Values = children and women screened; top N | 54.3 |
| 4 SAM identified, admitted, SAM % by month and province | Area chart; SAM % = Σ identified ÷ Σ screened per province | 54.2 |
| 5 MAM (same pattern) | Same | 54.2 |
| 6 CMAM admissions, by province, gender split | Clustered bars; pies from boys and girls columns | 54.3 |
| 7 Outcomes per programme | Pies of exit columns; cards | 54.3 |
| 8–9 OTP and SFP performance by province and district | Tables with conditional colours and references (75 / 15 / 10 %) | 54.8 |
| 10 Admissions, cured and default by month | Lines | 54.3 |
| 11 PLWs in SFP | Kit page | 54.7 |
| 12 IYCF | Kit page | 54.7 |
| 13 Micronutrients | Kit page; donut boys and girls | 54.7 |
| 14 Supplies | Kit page; received, used, balance per item; months of stock | 54.7 |
| 15–16 Response-plan view, gauges | Filter `Funding = RRP` saved as a page filter; gauges against targets | 54.4 |
| 17 Key influencers | Driver analysis | 54.12 |
| "(Blank)" | "Not reported" | Built |
| Data sharing by province and month | Completeness table | 54.11 |

## 12. Risks

| Risk | Mitigation |
|---|---|
| jsonb queries too slow at national scale | Spike first (54.0); typed-cell fallback; resolved keys indexed |
| Column guesses wrong and nobody notices | Every guess is confirmed on screen; low confidence highlighted; checks catch common errors; kit mapping saved after the first confirmation |
| People upload personal data | Detection, warning and recorded reason (D7); guidance favours aggregates |
| Two truths: dataset vs indicator | Only explicit links write to indicators, as drafts through verification; verified values never overwritten |
| Kit content clinically wrong for a country | Unreviewed label, per-organisation overrides of thresholds and aliases, named reviewer (D6) |
| Feature creep toward full Power Query or DAX | Fixed step and figure registries for this phase; new rows only with a user need |
| Host disk at ~89 % | Raw files counted in plan entitlements; versions capped at 10; `du` check in 54.0 |
| Share link leaks partner or donor identity | Semantic share policy, per-column hide, signed-out browser check in every relevant harness |

## 13. Deploy
- **Rules.** Follow `AGENTS.md`:
  - migrations before code, additive only;
  - RLS per table, with `relrowsecurity` checked;
  - `/ready` pairs for `DatasetVersion.columnsJson`, `DatasetVersion.status`, `Dataset.restricted`, `DatasetRow.valuesJson`, `DataConnector.datasetId` and `DatasetIndicatorLink.figureRef`.
  - New permissions must be present in `ROLE_PERMISSIONS` and the authorization-coverage test before the routes ship.
- **Scope.** `scripts/deploy-fast.sh` at the smallest scope. Web builds use `BUILD_ON=local` (the host build cannot fit them, per the Phase 52 note).
- **Batching.** Group into four releases:
  1. 54.1 + 54.2;
  2. 54.3 + 54.4 + 54.5 + 54.6;
  3. 54.7 + 54.8 + 54.11;
  4. 54.9 + 54.10 (+ 54.12).
- **Testing.** Fast loop per batch (only what changed); the full suites once before each release with a migration.
- **Live check.** After each release, run a signed-in check and a signed-out share-link check on a demo tenant, recorded in `memorybank/demo/`.

## 14. Not in this phase
- A formula language (DAX-like).
- Joins between two uploaded datasets other than through place and period. Revisit after usage data.
- Row-level editing of a dataset in the browser; fix the file and re-upload.
- Calendars other than Gregorian months and epi-weeks (registry rows later).
- Forecasting.
- Machine-learning drivers.
- Published kits other than nutrition. The mechanism serves every sector (§1.4) and a WASH fixture proves it, but each further kit needs its own content and reviewer, so it ships as a data-file follow-on, not in this phase.
- Native-reviewed translations.
- Clinical sign-off of kit content (owed to the D6 reviewer).

## 15. What changed from the superseded v1 plan

| v1 | Now | Why |
|---|---|---|
| Programme definitions generating ~60 indicators per project | Kit columns mapped from the person's own table | A user thinks in their report table, not a logframe |
| One project per partner for slicing | Partner and donor are columns | National data arrives as one consolidated export |
| Supplies as generated indicators | Supplies are columns, plus the `BALANCE` check | Same result, nothing new to learn |
| Country profile object | Column aliases, place aliases and kit thresholds per organisation | Fewer concepts; the places list already holds level names and codes |
| Dashboard recipes per country | `buildPages` from kit roles | One mechanism for every country |
| First value in batch 54.9 of 11 | Charts after 54.1, dashboards after 54.4 | Time to value |
| Literal-ban test on "OTP" | No-kind-branch test; content lives in kit data files | The literal test would trip on copy and templates |
| **Kept:** | honesty rules; ratio of sums; completeness; reference lines; quality checks as row messages; DHIS2 and scheduled pulls; explainable drivers; unreviewed clinical content; SOLID made checkable | Still right |

## 16. Definition of done and how to start

### 16.1 A batch is done when
- [ ] Its exit criteria (§6) are met and shown by a test, not a claim.
- [ ] Its row in §9.1 passes, plus the contract and architecture tests for every registry it touched.
- [ ] No new `kind ===` branch, no sector word outside kit data files, every file ≤ 300 lines (§1.4, §1.5).
- [ ] Every new screen has empty, loading, partial and error states, a keyboard path and four-language draft copy (§4).
- [ ] Gaps show "Not reported"; no rate is summed or averaged (§1.2); share links checked signed-out where the batch touches them.
- [ ] Migrations additive, RLS on and checked, `/ready` pairs added, permissions in `ROLE_PERMISSIONS` (§13).
- [ ] `AGENTS.md` "Phase 54 invariants" and this plan's log (§16.3) updated in the same commit as the code.

### 16.2 Starting 54.0 (checklist for the first session)
1. Create branch `0023-datasets` from the current deployed tree (the Phase 53 branch `0022-simple-maps`).
2. Read `AGENTS.md` (fast-verification loop, deploy rules, Phase 48 and 50 invariants) and this plan.
3. Write `test/fixtures/datasets/generate.mjs` (§6, 54.0): SNIS-like wide, Kenya-like county and months-as-columns files, deterministic, synthetic.
4. Benchmark jsonb storage on a scratch database at 200,000 rows (budgets in §7); record results in `memorybank/imp/phase54-baseline.json`.
5. Prototype the column guessers on the three fixtures; record the hit rate (target ≥ 90 %).
6. Make the `SourceProvider` seam compile with the existing visual-data tests unchanged.
7. Report to the owner: budgets met or the fallback chosen, guess accuracy, and any change to the plan, **before** 54.1 starts.

### 16.3 Log
| Date | Entry |
|---|---|
| 2026-11-13 | v1 plan (`phase54-nutrition-analytics-v1-superseded.md`) reviewed for simplicity and Power BI parity; replaced by this plan. |
| 2026-11-13 | Owner decisions: D1 separate storage, one experience; D2 Postgres; D3 and D6 Owner or Project Manager; D7 as §8.2; D4, D5, D8 adopted on recommendation. Requirement added: every capability serves all sectors (§1.4). Plan approved. |
| 2026-11-14 | Built in one pass on `0023-datasets`: domain `contexts/datasets` (kinds, semantics, guessers, PII, 11 tidy steps, 9 checks, refresh diff, completeness, drivers, links, access, DHIS2, form records, Nutrition + WASH kits), open catalogue + 5 new aggregates + wells + references, 4 canvas blocks with screens and print painters, API (`/v1/datasets*`, `/internal/datasets/pull`), web (wizard, dataset page, slicers, wells editor, 4 languages). Deviations: connector stored on the dataset (not `DataConnector.datasetId`); Kobo/SurveyCTO not moved into a registry; dataset MAP family is a ranked place list; 54.0 spike not benchmarked on production-size Postgres; §10 usability owed. |
