# Phase 62 — assessments and surveys (plan, 2026-11-22, branch `0025-place-tree`)

**Status: BUILT, tested and deployed 2026-11-22 (see "Built vs plan" at the end). Owner decisions (§9) taken 2026-11-22: 1 AI reader yes, 2 Urdu and Pashto for forms AND screens, 3 facilities are Places, 4 equal weights until the Foundation says, 5 on-screen signature and stamp photo both fine, 6 order as recommended.**

Trigger: the Khyber Pakhtunkhwa Health Foundation *Health Facility Assessment Tool* (`Temp/HFA TOOL NOV 25.docx`: 24 sections, ~84,000 characters, mostly tables and tick grids). An audit of the form engine (2026-11-22; `form-rules.ts`, `contracts/src/collection.ts`, `CollectionRecord`, `form-source.ts`) found it cannot hold this tool. The same gaps block every facility checklist, WASH/school/shelter assessment, needs assessment and monitoring checklist, so the work is **sector-neutral** (a sector differs only by its kit data file, as in Phase 54).

## 1. Goal and non-goals
**Goal.** A person with no technical skill can turn a paper assessment tool into a form, send assessors to facilities, collect offline over days, review, score, compare visits and see results by place, in a report or dashboard.

**Non-goals (this phase).** Probability sampling and weighting for household surveys; statistical tests and cross-tabs; skip-pattern import from XLSForm; a full survey research platform (use Kobo or SurveyCTO through the connectors). Listed in §8 as later work.

## 2. What exists and what is missing (audit)
Present: `NUMBER TEXT DATE SELECT YES_NO PLACE GPS FILE`; `relevantWhen` / `requiredWhen`; 100 fields, 100 options, 50 mappings per form; flat `answersJson`; public link, offline `/field`, sheet import, review, duplicate keys; COUNT/SUM into indicators; form → dataset (drops `TEXT GPS FILE`).

Missing, with the batch that closes it:

| # | Gap | Batch |
|---|-----|-------|
| G1 | No repeating group (blocks, wards, rooms, staff) | 62.1 |
| G2 | No grid / matrix question (rows x typed columns) | 62.2 |
| G3 | No sections or pages, no intro text, no progress | 62.3 |
| G4 | No multi-select | 62.3 |
| G5 | 100-field cap | 62.3 |
| G6 | No draft / resume for long forms (and offline) | 62.4 |
| G7 | A record is not tied to a facility by id (PLACE answer is resolved at read time) | 62.5 |
| G8 | No assignment of facilities to assessors; no "visited / not visited" | 62.5 |
| G9 | No scoring (Good/Average/Poor to points, section and overall score, bands) | 62.6 |
| G10 | Mappings are only COUNT/SUM; no "count where", no percent of facilities | 62.6 |
| G11 | No comparison between visits (baseline vs follow-up) | 62.7 |
| G12 | Reporting drops repeat/grid answers; no child dataset | 62.8 |
| G13 | No evidence per row (FILE inside a repeat or grid cell) | 62.1/62.2 |
| G14 | No signature capture | 62.9 |
| G15 | No Word/Excel import of an existing tool to build the form | 62.10 |
| G16 | No printable / PDF of a completed assessment | 62.9 |
| G17 | No health-facility kit (forms, indicators, dashboard, score rules) | 62.10 |

Anticipated gaps found while planning (not in the first audit):
- **A1 Calculated fields** (bed occupancy % = admissions / beds x days; budget utilisation %): needed inside the form, shown live.
- **A2 Cross-field validation** (functional beds <= sanctioned beds; sum of sources = total budget).
- **A3 "Not applicable" per item** (the tool says write N/A): an answer state, not a gap and not 0.
- **A4 Reference lists** (facility list, district, tehsil/UC, facility type) loaded from the places tree and organisation lists, not retyped.
- **A5 Prefill from the last visit** (static facility facts), changes highlighted.
- **A6 Skip and "unable to assess" reasons** per section (a closed unit, no access).
- **A7 Observation vs record-verified** flag per answer (the tool asks for both) and a required evidence rule.
- **A8 Two-party sign-off** (facility in-charge and DHO) with names, dates and stamp photo.
- **A9 Response time and quality checks** (an assessment finished in 4 minutes, GPS far from the facility).
- **A10 Roles** (assessor, supervisor, facility viewer) and a facility-level read-only share of its own result.
- **A11 Corrective-action tracking**: a Poor rating can raise a task or a risk (existing queue and risk register), never automatically without confirmation.
- **A12 Translations of a form** (Urdu, Pashto, Arabic, French): questions carry per-language labels.
- **A13 Large forms offline**: pack size and phone memory; section-by-section loading.
- **A14 Privacy**: staff names and contacts are personal data; link to Phase 54 restricted rules.

## 3. Design by SOLID (rules fixed in advance)
- **One table per variation, no branching on a field-type name.** `FIELD_TYPE_DEFS` (validate, blank, toColumns, defaultFor, filler component key, sheet column rule) replaces the `switch` in `validateSubmission`, `formColumns`, `record-sheet`, `FormFiller`. Adding a type is a row.
- **Rule engine stays pure and shared** (domain; browser-safe subpath, no `node:*`): the filler, the member route, the public link, the offline sender and the server all call the same `validateSubmission`.
- **Answers stay one JSON document** per record, with a schema version (`answersVersion`). Existing forms and records read unchanged (flat answers are version 1).
- **Scoring is a table**, not code per tool: `SCORE_RULES` (rating map, section weights, bands). A kit supplies data only.
- **Honesty.** A missing answer is null, never 0; "Not applicable" is its own answer and leaves the denominator; a rate is never summed; a score says what it was computed from and how many items were unanswered; no band is shown when fewer than the minimum share is answered.
- **No second write path.** Indicator values still go through `BulkUpsertIndicatorUpdatesHandler` as drafts. Drafts of a record use the same submit validator on completion.
- **Files**: ≤ 300 lines, one class per file; architecture test extended (`collection-architecture.test.mjs`).

## 4. Batches
### 62.0 Foundations (no visible change)
- `answersVersion` on `CollectionRecord`; `FIELD_TYPE_DEFS` registry; move current types into it; characterisation tests proving every existing form validates and renders the same (golden forms).
- Typed `FormDefinition` v2 (sections, groups) with `migrateForm` lifting v1.
### 62.1 Repeating groups (G1, G13)
- Field type `REPEAT { key, label, minRows, maxRows, rowLabel, fields[] }`; answers `{ key: [ {…row} ] }`; nested depth 1.
- Row-level conditions (a condition may name a field of the same row or an earlier top-level field); keys unique per row; FILE allowed inside a row.
- Filler: add / remove / reorder rows, "copy last row", row summary line; offline-safe.
- Sheet import: a repeat is a second sheet tab (one row per item with a `Parent row` column).
### 62.2 Grid questions (G2, G13, year columns)
- Field type `GRID { rows[], columns[] }`, each column typed (`NUMBER`, `SELECT`, `YES_NO`, `TEXT`, `FILE`); answers `{ key: { rowKey: { colKey: value } } }`; per-column min/max and required; "pick one" row types (the 0/1/2/3 count) as a column kind.
- Phone layout: a row becomes a card; wide screen is a table with a sticky first column.
- Year series (2022, 2023, 2024) is a grid with a year column set.
### 62.3 Sections, text, multi-select, limits (G3, G4, G5)
- `SECTION` (title, intro, instruction text, optional "assess this section?" gate with reason when skipped: A6), `NOTE` (read-only text and rating legends, e.g. Good/Average/Poor definitions).
- `MULTI_SELECT` (array of option values; `IN`/`CONTAINS` condition ops); `NOT_APPLICABLE` answer state per item (A3).
- Caps raised: 600 fields, 60 sections, 100 rows per repeat; limits in one `limits.ts`, with a sentence when exceeded.
- Table of contents with per-section completeness; keyboard and screen-reader order tested.
### 62.4 Drafts and resume (G6, A13)
- `CollectionDraft` (per user, form, facility, `answersJson`, `updatedAt`, `expectedUpdatedAt` conflict rule); autosave 2.5 s after the last change (same rules as the Entry Sheet autosave: no state set when nothing changed); offline drafts in IndexedDB and sync through the outbox as kind `collection-draft`.
- Submit validates the whole form; a draft is never counted or reviewed. Drafts expire after a stated number of days (reminder before).
- Pack loading by section so a 600-field form fits a low-memory phone.
### 62.5 Facility link, assignment, visits (G7, G8, A4, A5, A9)
- `CollectionRecord.placeId` and `visitNo`, plus `CollectionForm.subjectKind` (`FACILITY | PLACE | NONE`); a facility is a `Place` with `facility` flag and `facilityType` (Phase 56 / Phase 50). Existing PLACE answers keep resolving; new records store the id.
- `CollectionAssignment` (form, facility, assessor, due day, status `TO_DO | IN_PROGRESS | DONE | NOT_VISITED` with reason). Feeds the existing assignment queue (a new `IAssignmentSource`; one row in `ASSIGNMENT_KINDS`).
- Prefill static facts from the facility's last accepted record, highlighted as "from last visit" and never submitted unconfirmed (A5).
- Quality flags (A9): too fast, GPS farther than N km from the place pin, duplicate visit in a period, empty required evidence. Flags are shown to the reviewer, never block.
- Coverage view: facilities assigned / visited / reviewed per district.
### 62.6 Calculated fields, validation, scoring (G9, G10, A1, A2)
- `CALCULATED` field type using the formula-indicator grammar (`evaluateFormula`, exact decimal; a missing term = not measured, never 0).
- Cross-field rules table `FORM_CONSTRAINTS` (`LTE`, `SUM_EQUALS`, `ONE_OF_REQUIRED`) with a plain sentence per code (translated).
- `SCORE_RULES` (kit data): item to points (Good 2 / Average 1 / Poor 0, Yes/No, thresholds), section weight, overall; bands (e.g. Ready / Partly ready / Not ready) with a minimum answered share; N/A leaves the denominator; the score screen lists unanswered items.
- Mapping methods added: `COUNT_WHERE`, `PERCENT_WHERE` (share of accepted records meeting a condition), `AVERAGE_SCORE`, `LATEST_PER_FACILITY` (one current figure per facility, so a re-visit does not double count).
### 62.7 Visit comparison and follow-up (G11, A11)
- Baseline vs follow-up per facility: item-level change (improved / same / worse), section score change; honest when a question changed (matched by field key and form version).
- A Poor or failing item can offer "Create a task" or "Raise a problem" (existing `ProjectTask` and `ProjectRisk`), one click, never automatic; the task names the facility and item in plain words.
### 62.8 Results, datasets and dashboards (G12)
- Form → dataset v2: top-level answers one row per record; each repeat is a child dataset (`dataset:form-<id>-<repeatKey>`) joined by record and facility; a grid is flattened to `row x column` columns; multi-select becomes one yes/no column per option; text, GPS, files stay out (restricted-data rule).
- Canvas: existing `DATA_VISUAL` blocks read these; new starter blocks: readiness by district (choropleth by place), items most often Poor, score by section (bars), facility list with band, visit coverage.
- Reports: a section can cite a score and a list of Poor items from accepted records (record chunks, never invented figures); writer sees counts and bands only.
### 62.9 Sign-off, signatures, print (G14, G16, A7, A8)
- `SIGNATURE` field (drawn on screen, stored as a private image, never in a dataset or link); two-party sign-off with name, role, day; photo of a stamp allowed.
- Per-answer evidence mode `OBSERVED | RECORD_CHECKED | REPORTED` (optional per field) with "evidence required" rule.
- Completed assessment as PDF / Word / XLSX in the tool's own layout (title, section tables, ratings, photos), generated from the stored answers (no browser rendering; same composer family as infographics).
### 62.10 Build-from-document and the health-facility kit (G15, G17, A12)
- "Make a form from my tool": upload `.docx` / `.xlsx`; the wizard reader proposes sections, fields, grids and repeats from headings and tables, with a quote per item, **proposes only** and fills nothing without a click (same rules as the project wizard: grounded quote, never guess, "Not stated"). Falls back to a spreadsheet template (`GET /api/templates/assessment`) for manual building.
- `kits/data/health-facility.ts`: forms for the 24 sections (core form + departmental forms), indicators (functional beds, % facilities with functional X-ray, readiness score), score rules, dashboard and canvas templates. Ships UNREVIEWED; a sector reviewer checks it.
- Per-language labels on a form (`labels.<lang>` on each field), a language switch for the assessor; right-to-left supported.

## 5. Cross-cutting requirements
- **Permissions:** `collection.design` (project.edit), `collection.assign` (project.edit), `collection.assess` (indicator.update), `collection.review` (indicator.verify). Outside partners: assigned facilities only, only inside the project's areas.
- **Audit:** assign, submit, review, score recompute, prefill override, draft discard (counts, never answers).
- **Webhooks:** `assessment.submitted`, `assessment.accepted` (ids and status only).
- **Public API / MCP:** read-only scores per facility with `places:read` + new scope `assessments:read`; no free text.
- **Offline:** pack v4 adds form v2, assignments, last-visit prefill facts for the assessor's facilities only; wiped on sign-out. A pack never holds other facilities' answers.
- **Copy:** typed catalogue in en / fr / es / ar (drafts, native review owed); Urdu and Pashto added to the form-label languages only (not the app chrome) unless the owner says otherwise.
- **Accessibility:** grid and repeat operable by keyboard; targets ≥ 44 px under `pointer: coarse`; no state by colour alone.

## 6. Data model (all additive, before the code)
- `CollectionForm`: `definitionVersion`, `subjectKind`, `scoreRulesJson`, `languagesJson`.
- `CollectionRecord`: `answersVersion`, `placeId`, `visitNo`, `flagsJson`, `scoreJson`.
- New tables (RLS forced): `CollectionDraft`, `CollectionAssignment`, `CollectionSignature` (private image key).
- `/ready` adds `CollectionRecord.placeId`, `CollectionDraft.answersJson`, `CollectionAssignment.status`.
- Migrations named `2026112x_assessments_*`; re-run `rls.sql` per table and check `relrowsecurity`.

## 7. Tests and checks
- Golden forms (v1 and the real HFA tool, fixture trimmed to non-identifying text) validate and round-trip; property test: `migrateForm` is idempotent.
- Table-driven tests for every type, every condition op, every constraint code, every score rule (one row per rule; exhaustiveness with `assertExhaustive`).
- Architecture: no field-type name branch outside `FIELD_TYPE_DEFS`; browser-safe domain subpath; files ≤ 300 lines.
- Repository tests on a scratch Postgres (`UOW_VERIFY_DATABASE_URL`): draft conflict, assignment, `LATEST_PER_FACILITY`.
- Browser harness `pnpm --filter @donordesk/web test:assess` (Chromium): fill a repeat, a grid, autosave, offline, resume, score, compare; run after changing the filler. Not in `pnpm test`.
- Test only what changed per batch (repo rule); the full suites once before release because of the migrations.

## 8. Not in this phase (later, named so they are not forgotten)
Sampling frames and random selection of facilities/households; weighting and confidence intervals; XLSForm import/export; cross-tabs and tests; GPS route tracking and visit timing maps; in-app calling/chat with assessors; automatic corrective-action creation; native review of translations.

## 9. Decisions needed from the owner
1. **Scope of 62.10 (document reader):** build the AI reader now, or only the spreadsheet template and hand-built kit first?
2. **Languages:** Urdu and Pashto for form labels only, or also the app screens?
3. **Facility = Place:** use the existing place tree with a facility flag (recommended), or a separate facility register?
4. **Score bands and weights** for the health-facility kit: who supplies the ministry's rules? Until then ship with equal weights and a clear "illustrative" label.
5. **Signatures:** drawn on screen acceptable as the sign-off, or photo of the stamped paper only?
6. **Order:** recommended 62.0 → 62.1/62.2/62.3 → 62.4 → 62.5 → 62.6 → 62.8 → 62.7 → 62.9 → 62.10. A pilot of the first six batches can run a trimmed HFA tool.

## 10. Rough size
62.0 small; 62.1, 62.2, 62.3 large each (domain + filler + import + offline); 62.4 medium; 62.5 large (schema, queue, offline); 62.6 large; 62.7, 62.9 medium; 62.8 medium; 62.10 large. Ship as three releases: **A** (62.0–62.4, usable forms), **B** (62.5–62.8, facility programme and results), **C** (62.9–62.10, sign-off, print, document reader, kit). Each release: smallest `SCOPE`, host build when it fits, backup and migration first.

## Built vs plan (2026-11-22)
Built as planned: 62.0 (field-type table, `answersVersion`, definition v2 inside `definitionJson`), 62.1 repeats, 62.2 grids, 62.3 sections/notes/multi-select/limits (600 fields), 62.4 drafts (server and phone, photos kept with the draft, 60-day expiry), 62.5 facility link, visits, assignments, coverage, prefill, quality flags, 62.6 calculated fields, constraints, scoring, new mapping methods, 62.7 comparison and corrective actions, 62.8 datasets (grid/multi-select flattened, repeats as datasets, score columns), 62.9 signature, how-verified, document model with PDF/Word/Excel, 62.10 kit and document reader, translations (and Urdu/Pashto interface).

Deviations, on purpose:
- **The document reader is rule-based, not an AI model** (headings, tick options, blanks, header words). It proposes and quotes; it does not understand a complicated layout. Owner answered "yes" to an AI reader; a model-assisted second pass is not built (no real model was available to prove it).
- **`collection.submit` is a new permission** (not in the plan): field officers could not submit forms at all before.
- **Urdu and Pashto are partial interface catalogues** (assessor screens + `assess.*`, `form.*`, `problem.*`, `field.*` basics); other screens show English. All new text is unreviewed.
- **A PDF cannot show right-to-left scripts**: Word and Excel can.
- **Health kit**: scores infrastructure/services/interventions only (equipment counts are recorded, not scored); Section 21 (EPHS checklist) is not included (unreadable in the source); no dashboard or canvas template built from it.
- **Not built:** draft expiry reminders (the screen flags a draft near expiry; no notification is sent), the public API/MCP scope `assessments:read`, a signature pad for an outside partner (partners are not allowed on these routes), staff-list restriction as personal data (a note warns), collection-form PLACE answers stored by id, the "restricted dataset" rule for forms, `assessment.*` webhook events (an existing test pins collection records as not announced).
- Known unrelated failures seen in the suites (present before this phase): application `dashboard-template-handlers` test 5, web `pcw-places-view` "the words on this slide are plain language", API `external-access` H-15 (`entry-places` sample) and two DB tests when no Postgres runs on :5432.
