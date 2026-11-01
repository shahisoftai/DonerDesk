# Phase 37 — AI project setup wizard v2: proper extraction, proper placement

**DonorDesk Version 3.007** · plan written 2026-11-01 · status: built and tested 2026-11-01 (uncommitted, not deployed, not yet run against the real model) — see §8

Builds on Phase 36 (`phase36-ai-project-setup-wizard.md`) and the optimisation pass of
2026-11-01 (memory note `phase36-wizard-optimisation-2026-11-01`). Test corpus: the four AMAN
documents in `Temp/Revised` (proposal, logframe, Gantt work plan, summary budget).

## 0. Goal and the measure of done

The wizard reads a donor proposal pack and, with no retyping, places every relevant fact in the
right part of DonorDesk: facts → project, results chain → logframe (Goal / Outcome / Output /
Activity, with parents), indicators → under their result with baseline/target/unit/frequency,
Gantt → work plan with dates and logframe links, budget → funding and budget lines, places,
periods and risks. "Done" is measured, not felt:

| Measure (golden corpus, Haiku, 5 runs) | Today | Target |
| --- | --- | --- |
| Results chain: items correct and correctly parented | varies; Outcomes missing in some runs | ≥ 95 %, same answer every run |
| Facts filled (title, donor, country, dates, currency, amount) | country sometimes "Not stated" | 100 % when stated; 0 invented |
| Gantt rows → plan items with correct dates | 109 / 112 | 112 / 112, every item linked to a logframe activity or flagged |
| Indicators placed under the right result | not possible in review | 100 % placed or flagged "choose a result" |
| Budget lines exact (amounts verbatim) | summary sheet only | every line, totals reconcile |
| Read time (4 docs) | 60–80 s | ≤ 60 s p95 |
| Items invented (fail grounding) shown to user | 0, but drops are silent | 0, and every drop is counted and viewable |

## 1. What we learned from other tools

- **Google LangExtract** ([github](https://github.com/google/langextract), [PyPI](https://pypi.org/project/langextract/)):
  every extraction maps to a character interval in the source; unlocated items are null and filtered;
  few-shot examples fix the schema; *multiple extraction passes* raise recall on long documents; it
  detects items copied from the examples instead of the input. → We already ground by quote; adopt
  **char offsets** (for highlight-in-source), **a second recall pass** for list areas, and the
  **example-leak check**.
- **Docling** ([arXiv 2408.09869](https://arxiv.org/pdf/2408.09869), [InfoWorld](https://www.infoworld.com/article/3997240/docling-an-open-source-tool-kit-for-advanced-document-processing.html)):
  layout model classifies headings/paragraphs/tables, TableFormer recovers spans and hierarchical
  headers; merged Excel cells are still imperfect; Gantt bars are not understood. → Keep our own
  deterministic sheet readers (they already beat a model on Gantt and budget); add **typed blocks**
  (heading / paragraph / table-row / list) and a **document classifier** in the same spirit.
- **Logframe Lab** ([guide](https://logframelab.tawk.help/article/how-does-it-work-a-step-by-step-guide)):
  scans a proposal for results-chain statements and classifies them output / outcome / impact, then
  lets the user fix them in a matrix. → The review should be **a logframe matrix**, not a flat list.
- **IATI results standard** ([guidance](https://iatistandard.org/en/guidance/standard-guidance/results/), [indicator](https://iati-standard.readthedocs.io/en/latest/activity-standard/iati-activities/iati-activity/result/indicator.html)):
  result → indicator (required `measure`: unit / percentage / qualitative…) → baseline (year required,
  value only if quantitative) → periods with target/actual. → Use this as the **indicator target
  schema** and as the rule for what is "complete" vs "Not stated".
- EU / GCF logframe templates ([GCF](https://greenclimate.fund/node/20331)) — the usual matrix columns
  (intervention logic, indicators, baselines, targets, sources of verification, assumptions). → The
  logframe-sheet reader recognises these headers in English, French and Spanish.

## 2. Root causes of the open issues

1. **One model call decides structure and content at once.** Haiku must find statements *and*
   decide their level and parent in one pass; runs disagree (missing Outcomes, duplicate Goal).
2. **No document typing.** Every part ranks passages from every file; a Gantt sheet competes with the
   proposal narrative for the logframe budget (the "Task-N as Output" and "Project Organogram"
   errors).
3. **Cross-area links are made late or not at all.** Indicators, plan items and budget lines are
   extracted per area and only matched by code at Apply; the review cannot show or change a link.
4. **Silent drops.** Grounding removes items without telling the person; they cannot tell "not in
   the documents" from "the model lost it".
5. **Facts read from the first blocks only** (`headBlocks:3`), so a country named on page 4 is lost.
6. **Apply depends on Drive provisioning** (periods waited for the workspace).

## 3. Target pipeline

```
upload → parse → classify documents → typed blocks
       → deterministic readers (logframe sheet, Gantt, budget, indicator table)
       → model passes only for what readers did not settle
            pass A: results-chain statements (find, quote)
            pass B: structure (level + parent) over pass-A items only, small and fixed input
            pass C: recall pass on the parts of the documents pass A did not quote
       → link resolver (indicator→result, plan→activity, budget→activity) with confidence
       → consistency checks → review (matrix + links + "left out" drawer) → apply
```

## 4. Work batches

### 37.1 Document classification and typed blocks (deterministic, no model)
- `classifyDocument` (infrastructure, pure over parsed blocks): PROPOSAL, LOGFRAME_MATRIX,
  WORK_PLAN_GANTT, BUDGET, INDICATOR_TABLE (PITT/M&E plan), OTHER — by sheet names, header words
  (EN/FR/ES table in one place, `DOCUMENT_SIGNALS`) and the Gantt calendar detector already in
  `document-prep.ts`. Per sheet for workbooks.
- Blocks carry `kind` (HEADING, PARAGRAPH, TABLE_ROW, LIST_ITEM), `section` (nearest heading path)
  and `docKind`. Each area spec declares the doc kinds it may read (`readsFrom`), replacing ad-hoc
  `skipBlock`. Example: LOGFRAME reads PROPOSAL + LOGFRAME_MATRIX, never WORK_PLAN_GANTT.
- Wizard step 1 shows "We read this as: Logframe / Work plan / Budget / Proposal" with a change
  control; the person's choice overrides.
- Tests: the four AMAN files + synthetic EU/USAID/UNICEF/GCF templates in `test/fixtures/setup/`.

### 37.2 Deterministic readers first, widened
- **Logframe matrix reader**: rows with level words (Goal/Impact/Objectif général, Outcome/
  Résultat/Specific objective, Output/Produit, Activity) and numbered codes (`1`, `1.1`, `1.1.1`,
  `OC1`, `OP1.2`); parent from code prefix, else nearest earlier higher level. Indicators,
  baselines, targets, means of verification and assumptions read from their columns.
- **Indicator table reader (PITT / M&E plan)**: IATI-shaped output — `measure` (UNIT, PERCENTAGE,
  QUALITATIVE…), baseline value + year, target value + date or per-period schedule, disaggregation,
  frequency, source, result code. Missing cells are Not stated, never 0.
- **Budget reader**: all detail sheets, not only Summary; category → line → amount, verbatim;
  reconciliation check (lines = category total = grand total) reported, never "fixed".
- **Gantt reader**: keep the dated reader; add task-code → logframe-activity linking (`1.1.1`
  columns or prefixes), header-row and sub-total detection (fixes the 3 lost rows and the wrong
  "Project Organogram" title, which is a section header row read as a task).
- A reader's output is final for its area unless the person asks for a model re-read; the model
  only fills areas or fields no reader settled.

### 37.3 Results chain in three passes (stable structure)
- **Pass A — find**: list every results-chain statement with verbatim quote and a *proposed* level;
  the input is only PROPOSAL/LOGFRAME blocks (ranked by section headings "objectives", "results",
  "expected outcomes", "theory of change").
- **Pass B — structure**: input is pass A's items only (small, < 3 k tokens), output is level and
  parent for each; JSON schema enforced through tool use / structured output; temperature 0.
  Rules in code after it: exactly one Goal (merge near-duplicates by `overlapRatio`), every Output
  under an Outcome, every Activity under an Output; a missing level is flagged, not invented.
- **Pass C — recall**: re-run pass A over high-ranking blocks that no kept item quotes (LangExtract
  "extraction passes"); merge by quote overlap.
- **Self-consistency option** (`SETUP_RESULTS_VOTES=3`): run pass B three times, keep the majority
  parent/level, flag disagreements for review. Costs ~3 small calls; removes run-to-run variance.
- Example-leak check: drop any item whose quote matches the prompt's own examples.

### 37.4 Facts that are not lost
- Facts read from typed fields first (cover page, "Project title/Country/Duration/Donor" key-value
  rows, budget sheet currency and total, Gantt start/end), then one model call over the
  best-ranked blocks from **all** documents (not only the head).
- Cross-checks in code: start/end vs Gantt span vs duration; total vs budget grand total; currency
  vs budget sheet. A disagreement is shown with both quotes and the person picks one.
- Country normalised against the gazetteer's country list (never guessed; ambiguous = choose).

### 37.5 Link resolver and placement
- One pure module `setup-links.ts` (domain) builds links with a reason and confidence:
  indicator → result (code, same row in matrix, else wording similarity), plan item → logframe
  activity (code, else title similarity ≥ threshold), budget line → activity/output (code, label).
- Below the threshold the link is empty and the row says "Choose a result" — never a guess.
- Apply consumes these links; indicators are created under their result (fixes "not tied to a
  result"), plan items carry `logframeActivityId`, budget lines are created once their planned
  activity exists (in the same apply, ordered after PLAN).

### 37.6 Review that matches the product
- **Results step = logframe matrix** (tree with level badges): drag to re-parent, change level,
  merge two rows, split; indicators shown under their result, with a result picker for unlinked ones.
- **Indicators step**: add manually (the AMAN case — documents have none) directly under a result,
  with IATI-shaped fields; suggest indicators only from the document text, never from a library
  without the person choosing (optional later: sector indicator library from existing templates).
- **Work plan step**: mini-Gantt preview (reuse `timeline-layout.ts`) with each row's logframe
  link and a filter "not linked".
- **"Left out" drawer per step**: every dropped item with why (no quote found / duplicate /
  outside project dates / reader header row) and "Add it anyway" (becomes EDITED).
- **Show the source**: clicking a row highlights the quote in a document preview (char offsets from
  37.3), as LangExtract's viewer does.
- Copy in en/fr/es/ar through the existing typed copy; native review still owed.

### 37.7 Apply robustness
- Periods do not wait for Drive: create the project and all records first, provision Drive folders
  in the background (`runInBackground`), move documents when ready; the Done slide says
  "folders are being prepared" until then.
- Apply returns at once with a run id (already polled); per-area progress on the Create slide.
- A second Apply after PARTIAL resumes (already true) and shows what remains.

### 37.8 Evaluation, telemetry and regression
- Extend `setup:eval` into a golden corpus: AMAN pack + 4 synthetic donor packs (EU, USAID, UNICEF,
  GCF) with an expected answer file per area. Metrics: precision/recall per area, parent accuracy,
  date accuracy, variance across 5 runs, time, tokens, cost.
- Record per run: kept / dropped (by reason) / edited / rejected per area, time per pass. Show a
  quiet "Read 112 rows, kept 112" line in the review; keep the numbers in the run row.
- CI runs the deterministic parts (classifier, readers, resolver, consistency rules) on every push;
  the model eval is a manual script with a recorded baseline in `memorybank/imp/`.

### 37.9 Cost and speed
- Prompt caching: one cached document prefix shared by all model passes of a read (Anthropic
  `cache_control`), section-specific instructions in the suffix — same layout as the AI Reporter.
- Readers settle Gantt/budget/matrix with no model call; model calls drop from 8+ to ~4 on AMAN.
- Model routing: Haiku for find/recall, Sonnet only for pass B when votes disagree (optional flag).

## 5. Order and size

| Batch | Depends on | Size | Fixes |
| --- | --- | --- | --- |
| 37.1 classify + typed blocks | — | M | wrong-source items, Gantt rows in logframe |
| 37.2 readers | 37.1 | L | exact budget, matrices, indicator tables, 3 lost Gantt rows |
| 37.5 link resolver | 37.2 | M | indicators/plan/budget placed under results |
| 37.3 three-pass results | 37.1 | M | run-to-run variance, missing Outcomes, duplicate Goal |
| 37.4 facts | 37.1 | S | lost country, conflicting dates/totals |
| 37.6 review UI | 37.3, 37.5 | L | matrix, indicator entry, left-out drawer, source highlight |
| 37.7 apply | — | S | periods waiting on Drive |
| 37.8 eval | runs alongside | M | proof, no silent drops |
| 37.9 caching/routing | 37.3 | S | time and cost |

Ship in three deploys to keep deploy time down: (1) 37.1 + 37.2 + 37.4 + 37.7 (api only),
(2) 37.3 + 37.5 + 37.9 (api), (3) 37.6 (web + api). Run `setup:eval` before each.

## 6. Invariants carried over (unchanged)
Only Apply writes, through existing handlers; every item has a verbatim quote or is dropped (and now
counted); missing is Not stated, never 0; currency never assumed; redaction before the model and the
same redacted text for grounding; areas are a registry (no branching on area names); documents stay
in the tenant's Drive.

## 7. Not in scope
Generating indicators the documents do not contain (beyond explicit person choice), OCR'd scanned
Gantt images, IATI export (separate phase), donor-template extraction (Phase 26/28 already).

## 8. Status (2026-11-01)

| Batch | State | Where |
| --- | --- | --- |
| 37.1 classify + typed blocks | Built | `domain/.../document-kind.ts` (`classifyDocument`, `splitSheets`, `DOCUMENT_SIGNALS`); `SourceBlock.docKind` set per sheet in `source-reader.ts`; `AreaExtractionSpec.readsFrom` + `document-scope.ts`. AMAN: Part C = PROPOSAL, Gantt = WORK_PLAN_GANTT, budget sheets = BUDGET. |
| 37.2 readers | Built | Gantt by its own header row, task headings kept as `group`, unscheduled rows listed with no dates, leading tab kept by `toBlocks` (the "Project Organogram" title bug); AMAN: 112/112 dated rows + 11 undated, 0 dropped. `logframe-matrix.ts` (EU/GCF matrix, EN/FR/ES) feeds both the logframe reader and the indicator reader so each indicator is tied to its row's result; `indicator-sheet-reader.ts` (PITT/M&E plan, partial, APPEND). Generated codes skip the figure check (`codeSource: GENERATED`). Not built: budget detail sheets, budget reconciliation. |
| 37.3 three passes | Built | `area-passes.ts` (`recallBlocks`, `runRefinement`); `LOGFRAME_STRUCTURE` (3 votes, majority, tree order) in `prompts/logframe.ts`; `results-chain.ts` (`tidyResultsChain`, `applyStructure`, `majorityStructure`). Recall on logframe, indicators, facts. Not built: example-leak check. |
| 37.4 facts | Partly | facts prompt v2 (countries in words, currency line), recall pass fills Not stated facts; `FACTS_DATES_FROM_PLAN` advice. Not built: gazetteer country normalisation, picking between conflicting quotes. |
| 37.5 link resolver | Built | `setup-links.ts` (`linkProposal`, `bestLink`: clear winner only, SUGGESTED, stale suggestions withdrawn); runs after `proposeCodes(…, "LIVE")` at the end of reading and rerun, and after `proposeCodes` at preview/apply. Placement checks (`placement-checks.ts`): several goals, missing level, unplaced indicators/activities. |
| 37.6 review | Partly | Result picker per indicator/activity/budget line (`LINK` edit, `linkItem`, `linkSource: PERSON`), work-plan heading shown, section-level advice, "Left out" panel from `groundAreaPatch.leftOut` (stored on the run). Copy in en/fr/es/ar (drafts). Not built: drag-to-reparent tree, manual indicator entry in the wizard, mini-Gantt, document-kind override, highlight-in-source. |
| 37.7 apply | Built | `PeriodsApplier` waits for the project's Drive folders (`SetupWorkspaceProbe`, 30 × 3 s) and otherwise fails with a sentence; Finish creating retries. |
| 37.8 eval | Partly | Deterministic tests for every reader and rule; the model eval on real proposals is still owed. |
| 37.9 caching/routing | Not built | Area prompts select different blocks, so a shared cached prefix gains little; revisit with the eval numbers. |

Deploy: no migration, no env. Ship api + web together (`SCOPE=both`): the web reads `linkSource`, `group`, `leftOut` and the new problem codes, the api accepts `op: "LINK"`.

### Second pass (2026-11-01, same day)
- **Budget detail and totals**: `BudgetLineDef.kind` (LINE / DETAIL / TOTAL) and `ref`; the reader adds the Detailed Budget's referenced rows and both stated grand totals; `checkBudgetTotals` (`budget-checks.ts`) sets the categories and the most detailed rows (`leafRows`) against each grand total, advice only, never across currencies. AMAN: 6 lines, 119 details, 2 totals, all reconcile to 62272809.4617. Only LINE rows count in `budgetNotApplied`.
- **Facts**: `country-names.ts` (`recogniseCountry`, `countriesInText`, EN/FR/ES spellings; ambiguous words never matched in running text); countries stored by the list's name; `FactsFromTextExtractor` fills a Not stated country from the documents' own words; a disagreeing reading is kept as `Proposed.alternatives` (grounded like the value, at most 3; `withAlternative`, `offerPlanDates` offers the work plan's span); `CHOOSE` edit (`chooseAlternative`); checks `FACTS_READINGS_DIFFER`, `COUNTRY_NOT_RECOGNISED`.
- **Example echoes**: `dropPromptEchoes` removes items whose quote (12+ characters) is the prompt's own words.
- **Review**: `MOVE` (`moveResult`: level and parent, no circle, tree order kept), `ADD_INDICATOR` (`addIndicator`, the person's own, EDITED), mini-Gantt (`plan-gantt.ts`, `PlanGantt`), "Your documents" panel with a kind override (`ProjectSetupProposal.sources`, `describeSources`, `applyKindOverrides`; `PUT …/documents/:documentId/kind` re-reads every part; rerun saves now check the version and retry), "Show in the document" (`GET …/passages/:documentId/:block`, the redacted block with the quote marked, `highlightParts`). Copy in four languages (drafts). Browser harness `test:setup-wizard` covers all of it (20 checks).
- **Prompt caching: deliberately not built.** The shared system prompt is ~1.2 k characters (~300 tokens), below Anthropic's minimum cacheable prefix, and each area sends different passages; there is no repeated prefix worth caching.
- **Still owed**: the real-model evaluation (needs the production key: deploy, then run the wizard on the AMAN pack 3-5 times and record per-area counts, variance, time and cost).
- Deploy: no migration, no env; ship api + web together. New routes in `RULES`: `PUT /v1/project-setup/proposals/:id/documents/:documentId/kind`, `GET /v1/project-setup/proposals/:id/passages/:documentId/:block`.

## 9. Document map and section router (decided 2026-11-01, replaces keyword-only passage picking)

**Why.** Until now a part found its text by keywords over 1,600-character blocks that ignore headings. The structure of a document is the strongest clue to where a fact is, so a part should read the *sections* that normally hold its information, whole and labelled, and use keywords only as a fallback.

**How it works (all deterministic, no model):**
1. **Document map** (`document-map.ts`): every non-tabular document is split into sections from its own headings — lettered or numbered codes (`C.3.`, `2.1`), "Section/Part/Annex", labelled lines (`Goal:`, `Objective 1:`), all-capitals titles and short title-like lines alone between blank lines. The result is a tree; each block is cut inside one section and carries its path (`C.3 Goals and Objectives > Objectives:`). A workbook sheet is a section named after the sheet. Text before the first heading is "Start of document" (cover, summary table).
2. **Section roadmap per part** (`AreaExtractionSpec.sectionTitles`, English, French, Spanish): the headings that normally hold that part's information. USAID Part C ("Statement of Purpose", "Goals and Objectives"), EU "Description of the Action" and similar donor layouts are simply titles in these lists, so no separate donor-profile mechanism is needed.
3. **Routing is per section, across every file.** Each file is mapped on its own, so a file that holds only the budget, only the work plan or only the narrative contributes just its sections to the parts that list them; a part reads the matching sections of all files, in reading order. Document kind (Phase 37.1) still decides which files a part may read at all.
4. **Selection:** routed sections are read first and whole (up to the part's budget); keyword ranking fills the rest of the budget, so a heading that matches nothing is never fatal. The prompt marks each section with a `§` label line (a label, not text to quote).
5. **Facts as label–value pairs** (`fact-pairs.ts`): a cover or summary table row or `Label: value` line whose label is a known one (project title, award number, donor, country, start date, end date, currency; EN/FR/ES) is read exactly, with its line as the quote; it is the primary reading and the model's differing value is kept as the alternative.
6. **Level-word headings are not results** (`isHeadingOnly`): a result titled only "Goal", "Outputs", "Specific objective 2" is dropped before grounding.

**Not built:** one cheap model call to assign headings that match no list (the list-first design makes it a refinement), and showing each file's contribution per part in the documents panel.

### Real-model evaluation, Haiku, AMAN pack (4 files), 2026-11-01 — runs 2–10 on production
| Run (release) | Time | Requests / tokens | Goal / Outcome / Output / Activity | Plan rows | Placed under a result | Budget reconciles |
| --- | --- | --- | --- | --- | --- | --- |
| 2 (before line-break fix) | 88 s | 16 / 72.7 k | 1 / 4 / 0 / 10 | 124 | 10 | no (-1.6 M) |
| 3 | 85 s | 16 / 71.8 k | 2 / 3 / 0 / 9 | 123 | 13 | no |
| 4 | 82 s | 16 / 72.4 k | 1 / 2 / 0 / 10 | 123 | 9 | no |
| 5 | 88 s | 16 / 74.9 k | 2 / 1 / 0 / 10 | 123 | 7 | no |
| 6 (after line-break fix) | 82 s | 16 / 70.7 k | 1 / 4 / 0 / 8 | 123 | 8 | **yes** |
| 8 (document map) | 79 s | 17 / 78.1 k | 1 / 2 / 0 / 13 | 123 | 4 | yes |
| 9 (document map) | 85 s | 17 / 79.2 k | 1 / 2 / 2 / 12 | 123 | 10 | yes |
| 10 (document map + feeds) | 79 s | 17 / 76.0 k | 1 / 2 / 3 / 11 | 123 | 6 | yes |

**Reading:** time is 79–88 s and steady; the Gantt gives 123 rows every run (112 dated + 11 undated); the budget (127 rows, 2 stated totals) reconciles to 62,272,809.46 from run 6; with the document map the goal is 1 and the outcomes 2 in every run (before: goals 1–2, outcomes 1–4). **Still open:** only 4–13 of 123 activities are placed under a result (the Gantt's wording differs from the proposal's activities; only clear wording matches are linked, by design), and the narrative has few outputs so the Output count moves between runs. Facts: country and dates come from the documents; donor and dates show the "documents also say" choice.
