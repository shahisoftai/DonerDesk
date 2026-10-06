# Verification demo 4 — a six-month WASH project built and reported entirely through the UI (2026-10-05)

A completed six-month **WASH** project, built on production (`donordesk.online`, tenant `GEC`, `mnpiracha@gmail.com`) the way a tenant would: every step went through the real web UI in
one visible Chromium window (Playwright driving the page, no API calls and no database writes), then **one AI final report** was generated, reviewed and downloaded. This re-tests the
Phase 23 user-friendliness work ([`../imp/PHSE23-userfriendliness.md`](../imp/PHSE23-userfriendliness.md)) and follows [`verification-demo-3.md`](verification-demo-3.md), which used the API.

Final project: **"[DEMO] Safe Water & Sanitation for Flood-Affected Communities"** — project `588b9bd0-42d8-488f-8727-f86d2f4a749c`, Pakistan / Sindh / Dadu, 2026-03-01 → 2026-08-31,
USD 480,000, monthly reporting, donor "Global Water & Health Fund", partner Sindh Rural Support Network. Final period `3d1c777f-4216-49b5-93c4-11fa228a011b`.
Two earlier builds are archived and renamed `[DEMO-SUPERSEDED] …` (`ba3f95ef…`, `b3a86e3a…`): see findings 4 and 5 for why they had to be redone.

Reusable scripts: `scripts/demo-wash-ui/` (credentials only from `DEMO_EMAIL` / `DEMO_PASSWORD`; nothing is stored). Downloaded report files and the generated inputs:
`verification-demo-4-artifacts/`.

## What was built

| Layer | Content |
|---|---|
| Logframe (imported from CSV) | 1 goal, 2 outcomes, 6 outputs, 5 activity nodes |
| Indicators (imported from CSV) | 8: people with safe water (sex breakdown required), handwashing coverage %, water points, committees, chlorine compliance %, household latrines, school WASH blocks, people reached with hygiene promotion (sex breakdown required). Counts SUM, rates "reported directly", higher is better |
| Donor templates | Monthly (6 sections) and Final (9 sections), uploaded as DOCX, LLM-extracted accurately, reviewed, approved |
| Periods | Months 1–5 monthly; month 6 created by the **closing-report stepper** as the FINAL period |
| Data | 48 indicator values (6 months × 8) entered in the grid, **verified with "Verify all"** (8 per click); sex splits on the two people indicators; 5 story answers per period |
| Activities | 37 records (36 + 1 corrected replacement), each linked to a logframe activity node; 36 accepted, 1 left at "Needs revision" |
| Evidence | 59 files (PDF certificates and checklists, CSV registers and test logs, labelled synthetic photos), each attached to its activity and an indicator, **all verified**, each linked to its reporting period |
| Finance | 5 budget lines, USD 480,000 budget, 460,800 spent (96%), entered and **verified** on the final period |
| Final report | 12 sections generated in about 3 minutes; statements decided, 12/12 sections approved; Word (76 KB), PDF (9 pages, internal-review banner on every page), indicator spreadsheet, evidence checklist downloaded |

## What worked (Phase 23 confirmed in a real browser)

- **Lifecycle banner**: "Draft — activate to report" with an Activate button; no silent gate.
- **Indicator calculation** is visible at creation; the two rates read "Calculation needs review" and **Confirm all (2)** cleared them in one click; "Reported directly (latest value)" is offered for percentages.
- **"What you can create"** panel lists every period type with a reason; **closing-report stepper** created the FINAL period without any overlap or finance refusal.
- **Verify all** (bulk verify) verified a whole period in one click; the **breakdown editor** checks that categories add up.
- **Request revision / Accept** on activities, **Keep with a note** on flagged statements, **Approve all clean sections**, and the "this summary may be out of date" banner after a section was regenerated all behaved as designed.
- Template extraction was accurate (6 and 9 sections from the DOCX); draft export is possible while issues are open and is clearly marked on every page.

## Findings

Severity: **H** blocks or misleads a normal user, **M** friction or a dead end, **L** polish.

| # | Sev | Finding | What happened |
|---|---|---|---|
| 1 | H | **Writer leaked an internal score into donor text.** | First draft, section 3, "Data quality notes": *"Readiness scoring for this final report stands at 0.0, so the report requires verification before approval."* Removed only by regenerating the section with an instruction |
| 2 | H | **Closing-report flow ignores the approved Final donor template.** | Step 6 reads "No donor template: the built-in structure is used" although a REVIEWED Final template exists; the period is created without one, no screen can change a period's template afterwards, so the report used the built-in 12 sections, not the donor's 9 |
| 3 | H | **Evidence uploaded against an activity does not count for the period.** | Upload form has no reporting-period field; the report inputs said "Evidence · 0 files" with 59 verified files attached to activities, until each file was linked to a period one by one (59 selects). The final report's export lists only the 10 files of the final period, not the project's 59 |
| 4 | H | **The UI cannot record a breakdown unless the indicator was imported with "Disaggregation Required".** | The create form and indicator page have no such setting; the grid's *Breakdown* button only appears when the flag is set. Build 2 had to be abandoned. Import also requires the indicator code to equal a logframe item code, so each node can carry only one indicator |
| 5 | M | **Indicators cannot be edited, moved or deleted.** | An ambiguous "Measures" label (my script matched `Activity A2.2` instead of `Output 2.2`) attached two indicators to the wrong node permanently; the only remedy was a new project. The create form offers no hint about the level it picked |
| 6 | M | **Approved sections cannot be edited.** | *Edit* is hidden once approved; "Rewrite with AI" has presets only; the only free-text route is *Regenerate* (which un-approves). After "Approve all clean sections" a one-word fix means regeneration |
| 7 | M | **A "Needs revision" activity is a dead end.** | The record shows the reviewer note but offers no edit or resubmit; the replacement had to be a new record, and the original keeps "1 activity record not accepted" on the closing plan |
| 8 | M | **Checklist resolution is a silent two-step.** | *Resolve → note → Confirm → a second red Confirm*. Clicking one Confirm leaves the item Open with no message; five items looked resolved for several minutes |
| 9 | M | **Stale / re-created checklist items.** | "No activity updates submitted for this period" (six accepted updates exist), "Financial figures entered" (verified figures exist), "Beneficiary data disaggregated" (data is disaggregated) stayed open on the FINAL period; "Sensitive data handling confirmed" still showed as an open critical item in the export after being resolved |
| 10 | M | **Export preflight is a stale snapshot, and cross-section "different figures" flags are false positives.** | After regenerating section 3 the list still reported a `"31,"` figure that no longer exists; three "different figures for 'children' / 'people' / 'people reached'" items compare monthly values with life-of-project totals; the wizard says *"A reviewer note cannot resolve this"* with no other route |
| 11 | M | **Indicator spreadsheet for a FINAL report exports the August value.** | *Achievement* = 2800 for "people with safe water" (life-of-project 14,000) |
| 12 | M | **Look-alike pickers.** | The activity form's period select reads "MONTHLY" ×5 with no dates; the evidence form's activity select has 37 near-identical titles with no month |
| 13 | M | **Save sometimes does not redirect.** | Logframe item, activity and evidence forms occasionally stayed on the form after saving (it had saved): a double-submit risk |
| 14 | M | **One person cannot hold two project roles.** | A single-user tenant cannot assign both Project Manager and M&E Officer, so the closing plan's sign-off step and the report's sign-off can never be completed alone (expected; worth a hint) |
| 15 | L | Raw reason codes still appear in checklist text ("SOURCE_MISSING", "CAUSAL_REVIEW_REQUIRED"), against R5 |
| 16 | L | The indicator page says "Not confirmed yet" under a "Calculation confirmed" badge for counts |
| 17 | L | Evidence detail shows Location "—" and Uploaded "—" although both were given at upload |
| 18 | L | The breakdown editor stacks every field full-width, one per line |
| 19 | L | Readiness fell from 70% to 40% after one section was regenerated and re-approved, with no explanation on screen |

## Report outcome

Final report (version 1, 12 sections, all approved): every life-of-project figure is correct and grounded (14,000 people, 24 water points, 12 committees, 300 latrines, 6 school blocks,
12,000 reached, chlorine 91%, handwashing 76%, finance 480,000 / 460,800 / 96%, sex splits 7,700 / 6,300 and 6,480 / 5,520). Three flagged statements were decided with notes
("Keep with a note"), the leaked-score sentence was removed by regeneration, the executive summary was regenerated and re-approved.

**Left open on purpose** (a person's attestation, not something to tick for them): *Final report sign-off obtained*, *Final procurement and expenditure records available* (a demo project has none),
and the report itself is **not approved** and not exported for donor submission. The five monthly reports were **not** generated or approved ("5 earlier reports not approved" stays a To-do on the closing plan);
only the final report was asked for. Remaining wizard issues: the confidentiality item and the three cross-section figure flags (finding 10).

## How this differs from demo 3

Demo 3 built the project over the API and used the UI to generate and review. This demo used the UI throughout; that is why findings 3 to 5, 8, 12 and 13 appear only now (the API had accepted
disaggregation, period tags and indicator parents directly).

## Recommendations

Fixes for every finding above, ordered and with acceptance criteria, are in [`../imp/Phase24-user-simplicity.md`](../imp/Phase24-user-simplicity.md)
(R11 link-at-creation, R12 editable indicator model, R13 template inheritance, R14 writer guard and reopen, R15 activity review, R16 live checks, R17 exports, R18 forms, R19 shorter journey).
