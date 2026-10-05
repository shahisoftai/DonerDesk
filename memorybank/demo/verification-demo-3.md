# Verification demo 3 — a fully completed 6-month Education project, one AI final report (2026-10-05)

End-to-end build of a completed six-month **Education** project on production (`donordesk.online`, tenant `GEC`, `mnpiracha@gmail.com`), then **one AI final report** generated from the UI in a
visible browser. As in demos 1 and 2 everything went through the real HTTP API (bearer token from `POST /v1/auth/login`, run on the Contabo host over `ssh contabo` because the API is
loopback-only), never by writing to the database. The demo found **several real product bugs and set-up traps**; each was fixed (or recorded), deployed and verified by regenerating the
report. The report was regenerated three times; every version stays in version history.

Reusable script: `scripts/demo-education-6mo.mjs` (credentials from `DEMO_EMAIL` / `DEMO_PASSWORD`; nothing is stored in the repo). It generates **no** AI report.

## What was built (final project `3eef42c9-71fe-4eee-a333-219df707df87`)

"[DEMO] Learning Recovery for Displaced Children" — EDUCATION, Kenya / Turkana / Turkana West, 2026-03-01 → 2026-08-31 (all in the past, so it reads as delivered), USD 420,000, monthly
reporting, donor "Global Education Partnership Fund".

| Layer | Content |
|---|---|
| Logframe | 1 goal, 2 outcomes, 4 outputs, 6 activity nodes |
| Indicators (6) | children enrolled (1,200 → 1,260), teachers trained (60), learning spaces rehabilitated (12), kits distributed (1,200), caregivers trained (300), average attendance % (baseline 62 → 86, target 85). Explicit semantics: counts `SUM`, attendance `LATEST`, higher is better |
| Periods | **Months 1–5 are MONTHLY; month 6 is the FINAL period** (the closing period of the cadence: life-of-project totals from every earlier period, plus finance). Each has a story (5 answers), 6 verified indicator updates (sex split on IND-1/2/5), 5 accepted activities (30 in all, each linked to an output and an indicator), narrative evidence, a checklist |
| Evidence | 38 verified prose field reports (+3 on the final period), each **tagged and attached** to its activity and to the indicator update |
| Finance | Verified on the FINAL period: 5 budget lines, USD 420,000 budget, 97% spent |
| Templates | Monthly and final donor templates, LLM-extracted, reviewed, approved |

Product rules found while building (they shape the design, they are not bugs): monthly and custom reports have **no finance section**; FINAL / SEMI_ANNUAL / ANNUAL / QUARTERLY are
*cadence* types that **may not overlap** each other. A FINAL report is the closing period of the cadence (it already rolls up the project's accepted activities and states life-of-project
figures), so the demo uses it that way. The first attempt made the whole-project report a CUSTOM period, which has no finance and no roll-up; the overlap error now explains the supported flow.
Earlier partial/duplicate builds (`42859390…`, `52476c07…`) are archived.

## Findings, root causes and fixes

### Round 1 — disaggregation and attendance (first report: "disaggregated data was not recorded", "attendance not calculable", everything "Descriptive only")

| # | Cause | Fix |
|---|---|---|
| 1 | **Bug.** `computeIndicator` flagged `MISSING_DISAGGREGATION` for every indicator that *requires* a breakdown, recorded or not; the writer never got the values | Flag now means required **and** not recorded; `VerifiedFinding.disaggregation` reaches the AI Reporter / narrator (Python `Finding.disaggregation`) |
| 2 | Verifier did not know breakdown figures | They bind to their finding |
| 3 | Verifier order bug: "from a baseline of 62% to 86%" failed because the reference was read before the value that binds the sentence | Binding is decided for the whole sentence first |
| 4 | **Set-up trap.** A directly reported `PERCENTAGE` has no numerator/denominator, so it was "not calculable" by design | Script configures semantics; **and** `inferIndicatorSemantics` now reports a percentage with no numerator/denominator as its latest verified rate (still `REQUIRES_REVIEW`) |

### Round 2 — the long tail (after round 1, 63 of 86 claims still failed, none numeric)

| # | Cause | Fix |
|---|---|---|
| 5 | **Verification only checked factual claims against evidence-file chunks.** Statements grounded in the project's own records (activity records, project details, story, verified findings, finance, evidence log) were "unsupported". The writer cites a source on only ~2 of 86 claims | New `RecordChunkBuilder` (`packages/application/src/services/record-chunk-builder.ts`): short per-statement chunks from those records, used by the claim verifier. `ReportAssuranceService` loads them once per revision. Records are never cited as evidence |
| 6 | Honest disclosures ("the inputs record no expenditure figure") and document meta ("This section interprets it in brief") were verified as claims | `isDisclosureOrMeta` in the extractor: only sentences that name their scope (inputs/records/evidence) *and* negate recording *and* carry no figure; "No incident occurred" stays a claim |
| 7 | Figures stated in activity records (participant splits, "30 activities") failed `VALUE_MISMATCH` (the known false-positive class from demo 1) | Standalone figures in the records ground a number (dates, years and codes excluded) |
| 8 | A percent of target written to the whole percent ("101%") failed `DERIVATION_INVALID` | 0-, 1- and 2-decimal roundings accepted |
| 9 | Long sentences that synthesise several records scored "uncertain" pairwise | Coverage: supported when the best 6 chunks together contain ≥ 85% of the sentence's content words (figures included) and one chunk is genuinely about it. A sentence with an invented element is still not supported (tested) |
| 10 | Evidence ids cited in prose ("evidence: 14141986-6483-…") parsed as numbers | UUIDs are masked in numeric extraction |
| 11 | "5% above target" is a second derivation no value supports | Writer guidance: percent of target only |
| 12 | **Bug for roll-up reports.** A FINAL report evaluated *this period's* value (August alone: 240) against the *project* target, so "four indicators below expectation" | `performanceEvaluation` is computed from the life-of-project value for roll-up types; a value exactly on target is now POSITIVE ("target met"), exactly on a baseline neutral |
| 13 | **Bug.** `finding.disaggregation` describes the *period*; a roll-up report quoted it beside the project total ("1,260 enrolled, 125 female and 115 male") | `lifeOfProject.disaggregation` (breakdown of the whole value, summed across periods) beside the total; guidance says which is which. Report now says "656 female and 604 male; the August figure of 240 comprised 125 female and 115 male" |
| 14 | Evidence only reached the writer if *attached*; uploading with `activityId`/`periodId` only *tags* it | Verified evidence tagged to the period or its activities now reaches the writer; `attach-evidence` accepts `indicatorUpdateId` (clear name; `indicatorId` kept as an alias; attaching still rewrites `evidence.indicatorId` to the update id) |
| 15 | The report-inputs panel showed "Evidence · 0 files" before the first draft | `GetExportPreflightHandler` returns the real evidence, sensitive, unverified and annex counts when there is no draft |
| 16 | FINAL/ANNUAL overlap error did not say what to do | Message explains the closing-period flow and the Custom alternative |
| 17 | `apps/web` e2e asserted the retired "self-service reset is not available" copy | Test now checks the real reset form |

### Round 3 — what the export wizard still showed in red, and "not downloadable"

After round 2 the editor showed 1 flagged statement, but the **export wizard listed 97 issues** (46 numeric contradictions, 48 unsatisfied requirements, confidentiality, coverage) and
**blocked the download completely** — even though the backend allows an internal-review export of any draft (the API created Word and PDF exports fine). Findings:

| # | Cause (all code unless marked) | Fix |
|---|---|---|
| 18 | **UI.** `ExportWizard` replaced itself with an "Export is blocked" panel whenever the preflight listed any blocker, though only a *donor submission* needs a clean report | "Download draft anyway" in the blocked panel and a **Download draft** entry in the editor menu (the primary "Export report" action only appears once approved). Opens the normal wizard as an `INTERNAL_REVIEW` export, lists the open issues as warnings, and can go back to the issues. Donor submission is unchanged |
| 19 | The internal-review notice was a single line after the indicator table | Word: a red header on every page plus a cover line; PDF: a banner at the top of every page (8 pages → 8 banners, verified with a PDF text extractor). Donor submissions are never marked |
| 20 | **Re-assessment verified against no evidence.** Only generation passed the evidence packages; every re-assessment (an edit, a resolved statement, "reassess") built them from the sources the writer cited, i.e. none — claims got weaker after any human edit (56 → 49 passed) | Shared `taggedEvidenceIds` + `RecordChunkBuilder.evidenceIds`: a re-assessment verifies against the period's evidence (attached or verified-and-tagged), restricted files excluded unless cited |
| 21 | **Contradiction lint false positives (46).** It accepted only a finding's period value, baseline, target and comparison, so life-of-project totals, both breakdowns, finance, the project budget, record counts, "age 6-14", UUID fragments of evidence ids in the evidence log and "different figures for female/target" (different metrics) were all "contradictions" | `toLintFindingData` (cumulative, life-of-project, every breakdown value, percent of project target); `LintGrounding` supplies the figures stated by the records, findings, finance and evidence (also for the readiness quality score); ages and ids are exempt; generic category nouns do not form a divergence key |
| 22 | **Stale checklist items.** "Unsupported claim: …" items projected from earlier wording/versions were never closed; an "Only 8 evidence files uploaded" item stayed open although a FINAL report counts the project's evidence | `reconcile` closes unsupported-claim items whose statement no longer fails; the scan closes a shortfall item once evidence suffices; a FINAL/ANNUAL/SEMI_ANNUAL report counts project-wide evidence |
| 23 | Every open checklist item was listed twice (by the gate and again by the checklist) | Listed once |
| 24 | A recommendation that mentions a budget was classified as a compliance declaration and verified as a fact; "all six indicators at or above target" and "delivered within budget" had no supporting statement | Recommendations/forecasts are verified only for the figures they state; findings and finance supply those derived statements; number words equal digits for similarity |
| 25 | The writer concluded compliance the records do not state ("these records demonstrate safeguarding mainstreaming") | Guidance: never state or imply safeguarding/protection/visibility was met unless a record says so |

**What is left in red is genuine:** one overreaching safeguarding sentence in the current draft (the new guidance applies to the next generation; today it can be excluded or accepted with a
limitation) and the project's own open attestations — *Final report sign-off obtained*, *Sensitive data handling confirmed* (also reported as a confidentiality item), *Final procurement and
expenditure records available*, *Confirm child-safeguarding compliance and donor visibility*. Those are a person's confirmations, not something code should tick; they only block a donor
submission, not a draft download. **The wizard issue list went from 97 to 8** and the draft downloads (Word 38 KB, PDF 8 pages, both with the internal-review notice).

## Results (the same final period, three generations)

| Version | Claims | Passed | Material failures | Notes |
|---|---|---|---|---|
| Old demo, CUSTOM period, after round 1 | 86 | 23 | — | 59 `SOURCE_MISSING`, no numeric failure |
| Rebuilt (FINAL), before round 2 | 87 | 36 | — | "below expectation" on 4 indicators; evidence panel 0 |
| After round 2 (re-assured, no AI) | 79 | 52 | **0** | 27 non-material |
| **Regenerated (final)** | 86 | 56 | 5 | all 10 sections drafted; story 5/5, evidence 8 |

The 5 remaining material failures are legitimate or by design: one **causal claim** (causal claims always need a human decision), one **unsupported safeguarding assertion** the writer
made ("these records demonstrate safeguarding mainstreaming") — correctly caught — and three long synthesis sentences (a finance listing, cross-references). The other 25 failures are
non-material synthesis/recommendation sentences. The report reads correctly: IND-1…IND-6 "On track", cumulative and % of project target columns, finance table (budget 420,000, spent
407,400, 97%), life-of-project breakdowns beside the totals.

### Deploys

| releaseId | Scope | What |
|---|---|---|
| `20261005054216` | both | disaggregation (round 1) |
| `20261005055544` | api | verifier fixes. **Mistake:** shipped with four guidance tests failing because the package tests had run against a stale `dist/`; replaced ~4 minutes later |
| `20261005061903` | api | corrected |
| `20261005065749` | api | record-grounded verification, disclosures, percent default, tagged evidence, overlap message |
| `20261005071815` | api | findings/finance/evidence record chunks, record figures, coverage, life-of-project evaluation, preflight counts |
| `20261005073141` | api | UUID masking, story/evidence/summary chunks |
| `20261005074239` | both | life-of-project breakdown (worker model change) |
| `20261005080930` | both | Download draft anyway (web), recommendation / cross-reference / compliance-guidance fixes |
| `20261005082211` | api | re-assessment verifies against the period's evidence; recommendation classification |
| `20261005083216` | api | derived statements (all at target, within budget), number words |
| `20261005084551` | api | contradiction-lint grounding, stale unsupported-claim items reconciled |
| `20261005085513` | api | evidence-shortfall item auto-closed; FINAL counts project evidence |
| `20261005090450` | api | age ranges exempt, checklist blockers listed once |
| `20261005091500` | api | internal-review notice on every page of Word and PDF drafts |

No migration.

Final gate (fresh builds): contracts 10, domain 311, application 275, infrastructure 302 (1 skipped), workers 165, artifact validators 14; `pnpm -r typecheck` clean; web e2e `phase2` 3/3.

## Pitfalls to remember

- `attach-evidence`'s `indicatorUpdateId` is an indicator **update** id; attaching **overwrites `evidence.indicatorId`** with it, so a re-run must skip evidence already attached (the script does).
- `/v1/evidence/search` is paginated (`page`, `pageSize` ≤ 200).
- A SUM indicator's breakdown categories must add to the period value or the save is rejected.
- Archive with `POST /v1/projects/:id/archive`, not `PUT status`.
- **Package tests run against `dist/`: build every package in dependency order first** (contracts → domain → application → infrastructure) and gate deploys on a fresh green run.
- `dataQualityPenalty: 15` in the readiness payload is the maximum-penalty constant, not a finding.

## Scripts

| Script | What it does |
|---|---|
| `demo-education-6mo.mjs` | Builds the whole project (above). `LINK_PROJECT_ID=<id>` re-attaches evidence on an existing project. Generates **no** AI report |

---

# Appendix — a user's-eye review of managing a project end to end (2026-10-05)

## How this was assessed (read this first)

This is the experience of one tester doing a real job — set up and deliver a completed six-month project, then produce and download its final report — on the production tenant. It is **not** a
usability study of non-technical staff.

- **Via the API (a script):** project creation, logframe, indicators and their semantics, donor templates, reporting profile, periods, indicator data and verification, activities, evidence upload,
  evidence linking, finance, story, checklist scans. The UI forms for these steps were **not** used, so their form design is **not scored**; what is scored is the rules, defaults, errors and
  contracts a form would sit on (which determine how hard any UI can be to use).
- **In a visible browser (the real UI):** login, the report page, generating the report, regenerating, the flagged-statements and readiness panels, the editor menu, the Chart tab, the export wizard,
  downloads, and the Export center.
- Scores are 1–5 (5 = excellent, 3 = workable with friction, 1 = blocked). Where a score changed because of fixes made in this session, both are shown ("before → after").

## The journey, as a user lived it

| Step | What I did | What it felt like |
|---|---|---|
| 1. Sign in | `POST /v1/auth/login`, then the web login | Quick and predictable. The API is loopback-only on the server, so anything scripted needs `ssh` — fine for operators, a wall for anyone else |
| 2. Create the project | `POST /v1/projects` then `PUT status ACTIVE`, then acknowledge setup | A new project is a DRAFT and nothing says so until period creation is refused. Setup acknowledgement failed with a bare 400 (it needs `{acknowledged:true}`; the body is not self-explanatory). Archiving needs a different route from changing status |
| 3. Logframe | Goal → outcomes → outputs → activity nodes | Clear and quick. But a recorded activity can only point at an **output** and an **indicator**, never at the logframe's own activity node, so those nodes are decoration |
| 4. Indicators | Create 6, then configure how each aggregates | The create call returns only an id. **Defaults hide the real behaviour:** an unconfigured indicator is "Descriptive only" forever, and a rate (percentage) with no numerator/denominator was "not calculable" — I only found the cause by reading code |
| 5. Donor template | Paste text, wait, review each section, approve | The best part: extraction was accurate, the LLM path was used, the wait is short. The review/approve steps are two more calls but make sense |
| 6. Reporting periods | One per month, then a closing period | The cadence rules (monthly vs final may not overlap; finance only on non-monthly, non-custom reports) are **learned by being refused**. The refusal text was poor ("overlaps an existing period"); it now says what to do |
| 7. Enter indicator data | Bulk save with a sex breakdown, then verify each | Bulk entry is good and the breakdown check ("categories must add up") is helpful. The bulk save does not return the update ids, so verifying needs a second lookup per indicator |
| 8. Activities | Create 5 a month, then accept each | Fields are sensible and complete. Participants are free numbers (nothing checks they relate to the indicator they support). Acceptance is a separate step and a **final** report only rolls up accepted activities — easy to miss |
| 9. Evidence | Upload, verify, link | **The weakest area.** Uploading with an activity/indicator "tags" a file; *attaching* it is a different action; the writer only saw attached evidence. "Link to indicator" really needs an indicator **update** id and overwrites the file's own indicator field. Search is paginated with a default of 20 |
| 10. Story and finance | Five story answers; verified budget lines | Simple. The finance rules (typed mode, verify step, not for monthly) are discoverable only from errors |
| 11. Checklist and readiness | Scan, readiness score | Readiness read **0%** on a report whose every number was right, because approval and checklist carry most of the weight; "10% ready · 14 to do" is discouraging and not actionable. Auto-created items went stale and stayed open |
| 12. Generate the report | One click in the UI | Excellent: clear progress ("Writing sections 4 of 10"), about a minute, readable sections, tables and figures built from data. Re-generating is clearly explained and keeps history |
| 13. Review flagged statements | The statements and issues panels | Powerful but noisy: dozens of "unsupported" flags that were really checker limitations (not report errors) made the report look unfinished. Reason codes (`SOURCE_MISSING`) mean nothing to a user |
| 14. Download | Export wizard | A report with open issues could **not** be downloaded at all, the file arrived with no extension, then with a UUID name, with a notice buried mid-document. All fixed this session |
| 15. Charts | Chart tab and the figures | Charts were generic, wrong for the section, mixed units and ignored the tables beside them. Rebuilt this session |

## Scores

| Area | Score | Notes |
|---|---|---|
| Project creation and set-up readiness | 3.5 | Few steps, but the DRAFT/ACTIVE and acknowledgement gates are silent until they bite |
| Logframe building | 3.5 | Fast; activity nodes cannot be linked to recorded activities |
| Indicator definition (semantics, disaggregation) | 2.5 | Powerful model, **dangerous defaults** ("Descriptive only", rate not calculable); a user cannot see why a report reads oddly |
| Indicator data entry, breakdowns and verification | 3.5 | Bulk grid and sum-check are good; ids not returned; verify is one call per value |
| Activity recording | 3.5 | Complete fields; accept step easy to forget; no consistency check against indicators |
| Evidence capture and linking | 2.0 → 3.0 | Tag vs attach confusion, update-id overload, pagination. Writer now also sees tagged verified evidence; field still overloaded |
| Donor template handling | 4.5 | Extraction, review and approval are the strongest, most trustworthy part |
| Reporting periods and report types | 3.0 → 3.5 | Rules are sound but taught by refusal; error text now actionable |
| Story, finance and checklist inputs | 3.5 | Simple; stale checklist items were a real annoyance (now auto-closed) |
| **AI report quality** (accuracy, grounding, structure) | 4.0 | Numbers are exact and grounded; tables, finance, breakdowns and life-of-project totals are right; it still sometimes over-concludes (safeguarding) |
| Review, flagged statements and approval | 2.5 → 3.5 | Strong idea, but false-positive noise (checker limits shown as report faults) eroded trust; much reduced |
| Readiness and checklist guidance | 2.5 | Score is opaque and low for good reports; items do not tell you the next action |
| Export and download | 1.5 → 4.0 | Was blocked, mis-named and weakly watermarked; now downloadable at any time, readable names, notice on every page |
| Charts and figures | 2.0 → 3.5 | Now section- and table-aware; still only three chart sources |
| Error messages | 3.5 | Mostly structured and specific; a few bare 400s and codes a user cannot act on |
| Discoverability and documentation | 3.5 | The memory bank is excellent for engineers; a new user has nothing explaining the cadence, evidence and semantics rules |
| Speed and reliability | 4.5 | Fast, stable; no outage or lost data across ~20 deploys |
| UI polish and consistency (what I saw in the browser) | 4.0 | Clean, calm, accessible controls; progress feedback is good |
| **Overall ease of use for a non-technical officer** | **3.0** | Capable system; the hidden rules and the evidence model need guidance a UI form alone would not give |

## Recommendations (most valuable first)

1. **Make defaults safe and visible.** Show on every indicator how it will be aggregated and evaluated ("Counts: summed. Rate: latest value. Needs review") with a one-click confirm; offer "reported as a rate" for percentages; never let a project reach reporting with unreviewed semantics unnoticed.
2. **One evidence concept.** Uploading with an activity/indicator should attach it; separate the file's indicator from the indicator-update link (new field/column); always show on an activity or indicator which files support it and which statements cite them.
3. **Explain rules before refusing.** A "what you can create" panel for periods (monthly cadence → a final report closes it; finance only on final/quarterly; custom is one-off), and acknowledge/ACTIVE gates stated in the project header ("Draft — activate to report").
4. **Readiness that guides.** Show the three biggest blockers and a button for each; weight approval less for a first draft; do not show 0% for a correct report.
5. **Separate "your report is wrong" from "our checker could not confirm".** Label non-material, interpretive flags differently, hide reason codes behind plain language, and let a reviewer approve sections with one explained decision.
6. **A "closing report" flow.** A guided final report (project-wide figures, finance, evidence, sign-offs) instead of discovering FINAL vs CUSTOM vs overlap rules.
7. **Link recorded activities to logframe activity nodes** so the logframe shows delivery, and add a participants-vs-indicator consistency hint.
8. **Return ids from bulk saves and offer "verify all"** for a period; add a data-entry grid that verifies in one action.
9. **First-run guidance.** A short interactive tour of the order of work (project → logframe → indicators → template → period → data → evidence → generate → review → export) with the five rules above.
10. **Usability-test the UI forms** with two or three real project officers; this review could not.
