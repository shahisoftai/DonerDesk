# Phase 33 — Competitive parity plan (from competitors' official documentation)

Status: plan, 2026-10-27. Nothing built. Supersedes the "small tweaks" list in `competitor-matrix-verified-2026-10-27.md` §priorities.
Input: that matrix (DonorDesk verified in code and in the browser) + the competitors' own help centres (sources at the end).

## Status (2026-10-28)

| Batch | State |
|---|---|
| 33.1 Places registry | Built and tested (domain, table, handlers, routes, Settings → Places incl. sheet import and "Places to confirm"). Not deployed. Not built: attaching a place id to stored breakdown entries and plan items (text is resolved at read time), "Where we work" per-project assignment, entry-time place suggestions in the indicator grid, widening the bundled gazetteer. |
| 33.2 Results by place | Built and tested (`rollupByPlace`, `/place-results`, Data Center "By place" tab with level picker, partly-reported and unplaced notes, CSV). Not built: choropleth/map of the roll-up, place targets, report tables and infographic block reading the roll-up. |
| 33.7 Integration | Built and tested: API keys (3 read scopes), `/api/v1/projects|indicators|place-results`, webhooks (signing, retry, SSRF check, auto-disable), Settings → Integrations. One event wired (`report.approved`). Not built: the other five events, KoboToolbox/SurveyCTO connectors, MCP server, API rate limiting, per-key project picker in the UI. |
| 33.3 Formulas, targets, "not applicable" | Formulas built and tested (ratio/total/difference, validation, never stored, data sheet, entry grid, indicator editor, report findings incl. comparison and life of project, logframe versioning). Stoplight on the entry grid built (target met / below target, none when not fair). Also built (migration `20261028130000_indicator_update_not_applicable`): "Not applicable this period" answer with a required reason, incremental target entry (typed as steps, stored as the running total), and a multi-editor conflict check on the entry grid (`expectedUpdatedAt`). Grounding of a calculated value is pinned by a test (`number-grounding.test.mjs`); still unchecked: a real draft and export workbook with a formula indicator. |
| 33.4 Period data submission | Built and tested, not deployed: derived period data status, "Submit for review", reviewer notification, period-level "Send back" with a reason, entry window (set per period, enforced on single/bulk/submit, reviewers exempt), status sentence on the entry grid, partner access. Deployed 2026-10-28 (`releaseId=20261028030634`). |
| 33.5 Forms and records | Built and tested, not deployed (migration `20261029090000_collection_forms`): form rule engine (`collection/form-rules.ts`), records-to-indicator aggregation (`record-aggregation.ts`), designer, fill-in, review queue (accept / reject with reason), totals preview and "enter as drafts", anonymous collection links (hash-only, expiring, revocable), public page `/collect/<token>`. Also built: spreadsheet import of records with the form's own template and an error file (D10), return a reviewed record to waiting, nginx rate limit on `/api/collect/`. Deployed 2026-10-28 (core); import and reopen follow. Also built: photo/document questions (`FILE`, 5 MB, JPEG/PNG/WebP/PDF told by their bytes; members and public links), place answers read against the places list in the review table ("To confirm" when unknown or ambiguous), a downloadable notes file on the other text imports. Whole of 33.5 is built; the connectors are 33.7 and offline filling is 33.6. Photo questions deployed 2026-10-28. |
| 33.6 Offline field app | Built, tested and deployed 2026-10-28 (not yet tried on a phone): `/field` page kept by the service worker, offline pack (open forms + places list, per project, per person, removed on sign-out), forms filled offline and queued in the existing outbox (`collection-record` kind, photos kept with the record, uploaded then submitted under the record's own id), GPS button, place suggestions from the pack, stale-pack notice, parked entry when the server refuses. Not built: offline indicator-value entry, offline review, background sync while the app is closed, opening any other page offline. |
| 33.8 Dashboards | Built, tested and deployed 2026-10-28 (migration `20261029110000_dashboards`; public pages rate limited): dashboards of saved Data Center charts at three scopes (organisation, one project, only me), drag / resize / keyboard layout on a 12-column grid with domain-computed collision rules, "Add to a dashboard" from the Data Center, optimistic-save conflict message, read-only share links (hash only, expiring, revocable, no finance) and an iframe embed page, navigation entry and a project tab. Not built: saved pivots / table widgets, number tiles, per-viewer filters, dashboards across several projects' indicators in one chart, password-protected links, a rate limit on the public pages. |
| 33.9 Ask DonorDesk | Built and tested, not deployed, never run against a real model (migration `20261029120000_organization_ask_enabled`): a question per project ("Ask" tab) answered from indicator values, accepted activities and the text of evidence the asker may open; the model must cite numbered sources and a deterministic check drops any sentence that cites no real source or quotes a figure its sources do not contain; "what the records do not tell" is shown; per-organisation administrator opt-in (off by default), personal details redacted going out, finance excluded, audit by length and sources (not text), hourly/daily caps. Not built: conversation memory / follow-ups, questions across projects, saved answers, answer quality evaluation on a real model (the golden-question set), partner access, finance questions. |
| 33.10 Localisation | Framework built and tested, not deployed: English, French, Spanish and Arabic (right to left); the person's choice (cookie) → organisation default → browser → English; a typed message catalogue (`features/i18n`), plural forms per language, completeness / placeholder / no-raw-code tests, language switcher. Translated so far: the left navigation, the field app, the form filler (including every answer problem, via codes from the rule engine), the public collection page. Drafted by the assistant; **needs a native-speaker review** before it is relied on. Not translated: everything else in the signed-in app (reports, logframe, settings…), marketing pages, e-mails, exports, donor-facing report text, the AI's answers. Arabic layout: logical properties only on the new screens; the rest of the app has not been checked right to left. |
| 33.11 Finance and standards | Not started |
| 33.12 Trust and commercial | Not started (security-page MFA wording fixed separately) |

## 0. How to read this plan

Competitors' documentation shows **how** each capability is built, not only that it exists. For every domain we record:
the pattern they converged on (what users already expect), what DonorDesk has, and the design we adopt — including where we
deliberately do **better** or refuse a pattern that their own docs or users describe as painful.

Rules carried over from AGENTS.md: one rule per concept, missing is never 0, rates never summed, writers never receive
workflow state, every route in `RULES`, every tenant model in `rls.sql`, copy through the copy lint.

---

## 1. What the market converged on (patterns from the docs)

### 1.1 Places are master data, not free text
- **DevResults**: two geography kinds — *Locations* (GPS points: school, clinic) and *Administrative divisions* (shapes from KML).
  Every indicator has exactly **one geographic reporting level**; data at a lower level **rolls up automatically** to regions,
  country, world. A project is *assigned* the geographies it may report for; without the assignment it cannot enter data.
  Locations carry address, contacts, tags, and show which projects work there. Maps show one indicator at a time at any level;
  KML context layers. "Not intended to replace GIS."
- **Amp Impact**: *Geographic Areas* are catalog-level data (uploaded once), results are entered per Reporting Period × Geographic Area.
- **ActivityInfo**: a built-in *geographic database* (admin levels) that fields reference; thematic maps.
- **LogAlto**: location is a field type; import templates require location values to match the list exactly.

**DonorDesk today**: location is a free-text disaggregation category (`LOCATION` entry, `normalizeLocationKey`) and a free-text
plan field matched to a bundled gazetteer. Browser check: Rabak, Sinja, Um Gargur unplaced; the Data Center has no location view.
Roll-up to admin levels is impossible because nothing knows Rabak is in White Nile state.

### 1.2 Indicator data sources: direct entry, records, formula
- **DevResults**: three sources — *Direct entry*, *Data table* (row-level records with a date; aggregated into periods automatically),
  *Formula* (from other indicators: ratio, sum; also used to join a redefined indicator's old and new series).
  Type decides roll-up (counts sum, percentages/ratios average, never sum). Targets per indicator are **incremental or cumulative** (chosen per indicator).
  Results are reported incrementally.
- **TolaData**: result typed in **or calculated from a dataset** (Excel, KoboToolbox, SurveyCTO, its own forms); results summary with automatic tables/charts;
  weighting and duplication policies for aggregated indicators. Users ask for **targets per disaggregation** and **roll-up of one disaggregation** across projects (Capterra) — both missing there.
- **LogAlto**: data-entry view grouped by collection frequency; enter **either** period progress **or** cumulative total; reference (baseline) value required to compute progress; per-period targets; Excel import of values; "calculate all values for indicators linked to forms".
- **Amp Impact**: Add Results grid per period/area; disaggregated entry; **"mark result as not applicable"**; **performance stoplights**; document upload on results; **submit results for review**; refresh when several users edit at once.

**DonorDesk today**: direct entry grid per period (baseline, target, period, cumulative, breakdown panel with consistency line,
group targets — ahead of TolaData), `aggregation` per indicator, scheduled cumulative targets, rate rules. Missing: formula
indicators, record-based indicators, "not applicable" as an explicit answer, stoplights on the grid, multi-editor refresh.

### 1.3 Collection: forms, links, offline, drafts, validation
- **ActivityInfo**: no-code form designer; calculated fields; **validation rules** (rule builder or formula; block save; custom message;
  skipped when blank); **relevance and conditionally required fields**; **drafts** (invalid entries flagged, valid drafts local);
  **collection links** (web, or installable app link usable offline); **"Download for offline use"** per database, auto-sync on reconnect;
  GPS works offline; audio attachments; record history; deduplication and merge; multilingual forms; spreadsheet importer.
- **LogAlto**: drag-and-drop form designer; four ways in: add record (side panel), **Excel import with a generated template and an error file with highlighted cells**,
  **share link (no login)**, share with users/projects/org units with **confidential fields**; Android app with offline.
- **TolaData**: own form builder plus connectors (Kobo, SurveyCTO, Excel, Google Drive).
- **Amp Impact**: *Submissions* — form templates sent to internal or external stakeholders.

**DonorDesk today**: indicator grid, activity form with dictation and an offline outbox, `TextImportPanel` (paste/file/dictate).
No form designer, no anonymous collection link, no Kobo/SurveyCTO connector, no offline opening.

### 1.4 Review, submission windows, locking
- **DevResults**: per project × period status **No data → In progress → Submitted → Returned → Approved**; submission **windows**
  (limited users report only inside them); submit locks for the submitter; approvers/owners edit; return unlocks; optional row locking for data tables after approval;
  out-of-window data goes through an approver.
- **ActivityInfo**: approval = a reviewer-only status field (Pending/Approved/Rejected); permissions per role.
- **Amp Impact**: submit results for review; stoplights.

**DonorDesk today**: stronger at report level (claims, second approver, locked figures after approval, reopen with reason) and
row-level verify; there is no **period data-submission status** distinct from the report, and no submission window.

### 1.5 Analysis, dashboards, publishing
- **ActivityInfo**: pivot tables (sum/avg/count/count distinct/median/max, percentages, blanks shown), charts, interactive and
  thematic maps, **dashboards**, **notebooks** (several analyses as one report), report designer, **publish to web / embed / SharePoint**, Power BI, R, Python, ArcGIS, QGIS.
- **LogAlto**: Analytics = name → dataset → output type (grid, chart, map) → side-panel config; **global, personal ("My dashboard") and project dashboards**; add saved reports, drag to reorder, resize.
- **TolaData**: dashboards from widgets, shared internally and **externally with a link**; Power BI/Tableau/Superset.
- **DevResults**: dashboards with map tiles, geotagged photo map.

**DonorDesk today**: Data Center (pivot by period, charts from specs, CSV/XLSX), infographic studio with share links, Overview by role,
portfolio. Missing: saved charts/dashboards a user composes, a personal dashboard, location pivot, public embed of live data, BI connector.

### 1.6 Programme management around the results
- **Amp Impact**: workplans and milestones, workforce/procurement, **budgets, funding pools, disbursements, allocations related to targets and results**, risks and mitigations, impact stories, grants intake.
- **LogAlto**: portfolio, activities, responsibles, system lists (donors, sectors, partners, cross-cutting issues), lessons learned, success stories.
- **TolaData**: tasks, approvals routing, feedback; IATI.

**DonorDesk today**: at or above parity (Phase 28 plan, risks, tasks, reminders, comments, programmes/grants, adaptations).
Missing: **cost per result** (budget ↔ indicator link), IATI publishing, cross-cutting markers (gender/environment) on activities.

### 1.7 AI
- **TolaData (pilot, rollout late 2026/2027)**: Knowledge Database (questions over documents, answers cite sources), Data Analytics
  Assistant (questions over indicators, shows figures, flags gaps), Report Generation (donor drafts, human review). Opt-in, off by default, within permissions, not used for training. Planned: data-quality checks, indicator suggestions.
- **ActivityInfo**: MCP server, automatic translations, duplicate scanner.

**DonorDesk today**: shipping what TolaData pilots for reports (grounded drafting, claim verification, citations). Missing: Q&A over
documents and data, MCP server, translation, duplicate detection on beneficiaries.

### 1.8 Platform
- **ActivityInfo**: ISO 27001, SSO, audit log, backups, **webhooks + automation builder + email notifications**, branded domains, SaaS or self-managed, SLA.
- **LogAlto**: UI in FR/EN/AR/ES; OIDC on a plan; out-of-the-box vs configured vs dedicated hosting.
- **TolaData**: free trial, €39/month entry.

**DonorDesk today**: SSO+SCIM, MFA, hash-chained audit, scheduled backups; missing: public API/webhooks, UI localisation, certification, self-hosting.

---

## 2. Design decisions (what we adopt, improve, or refuse)

| # | Decision | Why |
|---|---|---|
| D1 | **Places become master data**: a `Place` registry per organisation (point or area, parent area, admin level, code, aliases), seeded from the bundled gazetteer + Natural Earth admin-1 + uploaded layer. Free-text locations are **resolved to a Place at entry** (suggest, confirm, or "new place"), never silently. | DevResults/Amp model; makes roll-up possible; fixes the unplaced-locality gap. |
| D2 | **Refuse "one fixed geographic level per indicator"**. An indicator declares the *lowest* level it is collected at (optional); values roll up through the Place tree. | DevResults' rule forces duplicate indicators when needs differ. |
| D3 | **Refuse "changing disaggregations deletes data"**. Adding a category is allowed; removing one with values archives it (same rule as indicators). | DevResults docs say changes force data re-entry. |
| D4 | **Three indicator sources**: direct, **records** (rows with date + place, aggregated by period and place), **formula** (num/den, sum, difference of indicators; joins old/new definitions). Type rules unchanged (rates never summed). | DevResults/TolaData/LogAlto all have it; ours stays explainable (formula shown beside the value). |
| D5 | **Targets per disaggregation group and per place** stay first-class (already ahead of TolaData); add **incremental vs cumulative target entry** per indicator. | DevResults offers both; our scheduled target is cumulative-only. |
| D6 | **"Not applicable" and "Not measured" are explicit answers** on the grid (with reason), distinct from blank. | Amp Impact; matches our "missing is never 0". |
| D7 | **Period data status** per project × period: Not started → In progress → Submitted → Returned → Accepted, with optional submission window. Separate from report status; report generation reads only Accepted (or warns). | DevResults pattern, fits our verify step. |
| D8 | **Forms v1 = collection forms that feed indicators**, not a general survey tool: designer with field types, validation rules, relevance, required-when; each form maps fields → indicator values (records source) with place and date; anonymous **collection link**; installable **offline** web app (download project for offline, drafts, sync). | ActivityInfo/LogAlto UX; keeps us on the reporting path. |
| D9 | **Connectors before a survey engine**: KoboToolbox and SurveyCTO import into records (TolaData pattern) — many NGOs already collect there. | Lower cost, higher adoption. |
| D10 | **Excel import with generated template and an error file** (highlighted cells) for every import. | LogAlto; our importer already blocks on bad rows — return the file. |
| D11 | **Saved views and dashboards**: any Data Center chart/pivot can be saved; dashboards at three scopes (organisation, my, project), drag/resize; share link (read-only, expiring, like infographic links). | LogAlto/TolaData. |
| D12 | **Location everywhere**: Data Center "By place" pivot and choropleth, Overview map coloured by result, report tables by place, infographic location block from the same function. | DevResults maps one indicator at a level. |
| D13 | **Public API + webhooks + MCP server** (design in `public-api-and-webhooks-design.md`; MCP reuses the API scopes). | ActivityInfo; enterprise asks. |
| D14 | **Ask DonorDesk** (Q&A over documents and indicator data) reusing grounding: every number in an answer grounded, every claim cited, gaps flagged; opt-in per organisation. | Matches TolaData's pilot with our stronger grounding. |
| D15 | **UI localisation** FR, ES, AR (RTL) first; donor-facing exports already multilingual. | LogAlto ships these four. |
| D16 | **Cost per result**: budget lines optionally linked to outputs/indicators; Overview shows spend beside achievement (juxtaposition, no score). | Amp Impact relates finance to targets/results. |

---

## 3. Roadmap (batches; each ships independently, each with tests, migration notes and copy-lint)

### Batch 33.1 — Places (foundation) — highest priority
- Domain: `Place {id, tenantId, name, kind POINT|AREA, adminLevel, parentId, countryCode, lat/lon?, geometryRef?, aliases[], code?}`; `resolvePlace(text, ctx)` replaces string matching (uses `normalizeLocationKey`, aliases, project country, parent hint).
- Seed per organisation from gazetteer + admin-1; uploaded `TenantMapLayer` features become AREA places; "Add a place" (name, parent area, pin) from any unresolved location.
- Indicator breakdown LOCATION category gains `placeId` (text kept for display); plan items gain `placeId`; backfill resolves existing text, leaves unresolved as text and lists them in a **"Places to confirm"** queue.
- Project "Where we work": the places a project is assigned (DevResults), used as suggestions in entry.
- Migration (additive) + RLS + `/ready` pairs; tests: resolver table, backfill idempotence, roll-up tree.

### Batch 33.2 — Results by place (the missing view)
- `placeRollup(sheet, tree)` in domain: additive types sum up the tree; rates shown per place, never summed; parent with partial children marked "partly reported".
- Data Center **By place** tab: pivot (rows places at a chosen level, columns periods or indicators), choropleth/points, CSV/XLSX; same function feeds Overview map, report tables, infographic block.
- Place targets (`targetBreakdowns` by placeId); "Not planned" when absent.

### Batch 33.3 — Indicator sources and answers
- Formula indicators (num/den, sum, difference; validated DAG, no cycles; formula shown beside value; grounding accepts derived values only when computed by the formula engine — update `grounding.py`, `number-grounding.ts`, `NumericAssertionVerifier` together).
- Incremental vs cumulative target entry; "Not applicable" / "Not measured" answers with reason.
- Grid: stoplight column from existing `performanceEvaluation`; "edited by someone else" refresh notice (optimistic version).

### Batch 33.4 — Period data submission
- `PeriodDataStatus` table-driven transitions; optional submission window; submit locks data-entry users; return requires reason; accepted feeds generation (warn otherwise); reminders and My work items from the existing queue.

### Batch 33.5 — Collection forms and records
- Records source: `IndicatorRecord` rows (date, placeId, fields) aggregated by period/place; dedup key.
- Form designer (field types: number, text, date, select, yes/no, place, photo/file, GPS, calculated); validation rules, relevance, required-when (one rule engine in domain, shared by web and API).
- Field → indicator mapping; anonymous collection link (token hash, expiry, like share links); record review queue.
- Excel template + error file for every import.

### Batch 33.6 — Offline field app
- Installable PWA: "Download project for offline" (forms, places, lists), drafts in IndexedDB, existing outbox for submit, GPS offline, conflict = parked entry. Replaces the shell-only `sw.js`.

### Batch 33.7 — Integration
- Public API keys + webhooks (design doc); KoboToolbox/SurveyCTO connectors into records; MCP server on the API scopes; Power BI via the API's CSV/JSON endpoints.

### Batch 33.8 — Dashboards
- Saved views (Data Center chart/pivot spec), dashboards at org/my/project scope with drag/resize, read-only share links, embed.

### Batch 33.9 — Ask DonorDesk
- Q&A over evidence chunks + record chunks + data sheet; answers cite chunks, numbers grounded, gaps named; opt-in; PII firewall; audit.

### Batch 33.10 — Localisation
- i18n framework in `apps/web`; copy tables already centralised (`*-copy.ts`) are the extraction points; FR, ES, AR (RTL); copy lint per locale.

### Batch 33.11 — Finance and standards
- Budget line ↔ output/indicator link, cost per result on Overview; cross-cutting markers; IATI export.

### Batch 33.12 — Trust and commercial
- MFA enforceable per organisation, MFA for partners; ISO 27001 readiness checklist; free trial flow review; self-hosting decision (business).

## 4. Order and rationale
33.1 → 33.2 first: they turn the verified-but-hidden location capability into the headline competitors document, and every later
batch (forms, maps, dashboards, API) needs Places. 33.3/33.4 close the MEL-core gaps buyers test in demos. 33.5/33.6 are the largest
and most visible gap vs ActivityInfo/LogAlto. 33.7 unblocks enterprise. 33.9 is our differentiator extension — start after 33.2 so answers can cite place data.

## 5. Evidence still owed before public claims
Competitor rows here are from their documentation, not hands-on use; plan-dependent features (LogAlto) and pilots (TolaData AI) must be rechecked before any marketing comparison.

## Sources
- DevResults: Data Model https://devresults.knowledgeowl.com/help/data-model · Indicator Guidebook https://devresults.knowledgeowl.com/help/indicator-guidebook · Mapping https://help.devresults.com/help/mapping-functionality · Submission & Approval https://devresults.knowledgeowl.com/help/data-submission-approval-process · Row locking https://devresults.knowledgeowl.com/help/data-table-row-locking · Assign geography https://devresults.knowledgeowl.com/help/assign-a-geography-to-a-project
- ActivityInfo: Features https://www.activityinfo.org/about/feature/index.html · Analysis https://www.activityinfo.org/about/data-analysis-visualization.html · Validation rules https://www.activityinfo.org/support/docs/forms/validation-rules.html · Drafts https://www.activityinfo.org/support/docs/working-with-data/understanding-drafts-in-activityinfo.html · Approval https://www.activityinfo.org/support/docs/forms/set-up-an-approval-workflow.html · Offline https://www.activityinfo.org/support/docs/mobile/working-offline.html
- LogAlto: Features https://www.logalto.com/en/monitoring-and-evaluation-tool/ · 10 steps https://help.logalto.com/article/240-getting-started · Data entry https://logalto.helpscoutdocs.com/article/85-enter-an-indicators-actual-value
- TolaData: Features + AI https://www.toladata.com/features/ · Indicator management https://www.toladata.com/docs/knowledge-base/indicator-workflow/about-indicator-management/ · Results framework https://www.toladata.com/docs/knowledge-base/indicator-workflow/what-is-a-results-framework/ · Reviews https://www.capterra.co.nz/software/186747/toladata
- Amp Impact: Data entry guidance https://verasolutions.atlassian.net/wiki/spaces/AIEP/pages/3630366725 · Add Results https://verasolutions.atlassian.net/wiki/spaces/AIEP/pages/3732406327
