# Verification demo 13 — 6-month food security and livelihoods project, north-east Nigeria (wizard setup + month 1 + dashboard)

**DonorDesk Version 3.007+** — production, test tenant GEC, `mnpiracha@gmail.com`, run 2026-11-05 in one visible Chromium (CDP 9350). All organisations, people and figures are **fictional**.

## 1. The project
| Field | Value |
| --- | --- |
| Title | [DEMO-13] Strengthening Food Security and Livelihoods for Conflict-Affected Households in North-East Nigeria (FSL-NE) — *label clashes with an older "[DEMO-13] Resilient WASH" project; treat this as 13b* |
| Code / donor / sector | NG-FSL-20261101 · Nigeria Humanitarian Fund · Food security |
| Dates / budget | 2026-11-01 → 2027-04-30 · USD 900,000 (seven budget lines) |
| Implementer | Borno Relief and Resilience Initiative (BRRI, fictional) |
| Places | Maiduguri, Bama, Monguno (Borno), Mubi (Adamawa), Potiskum (Yobe) |
| Results | 1 goal, 3 outcomes, 6 outputs, 11 activities (21 rows) |
| Indicators | 18 (4 outcome/goal rates read quarterly or annually, 14 output counts monthly) |
| Plan | 17 planned activities |
| Reporting | monthly (Nov–Mar), semi-annual (mid-project), final |
| Project id | `40d65f44-d771-4ee6-9edf-4c34a4cab5ac` |
| Dashboard | `/dashboards/77d17d77-86f1-4eb5-a515-71cd3edc9ed4` (17 charts) |

Inputs and scripts: `scripts/demo-food-ng/` (`mk_inputs.py` builds the proposal .docx, logframe/indicator/budget/work-plan .xlsx; `gen_evidence.py` builds month-1 activity records and 12 evidence files; Playwright drivers `start/read/do/planfill/indfill/act/nov/mkdash/tiles…`).

## 2. What was done (as a user, in the browser)
1. **Wizard, with documents**: uploaded the proposal, logframe sheet, indicator sheet, budget and work plan; read; confirmed results (21), indicators (18, after removing 18 duplicates), places (6 areas), work plan (17, with lead / places / indicators fed), data-entry methods, reporting (monthly + semi-annual + final), budget (900,000 USD agrees with funding), risks (5 + 2 assumptions), signed off and **started the project** (ACTIVE).
2. **Month 1 (Nov 2026)**: 12 completed-activity records with 12 evidence files, each file linked to its indicator; all 12 accepted in one action; 13 indicator values entered in the Form view, handed in and **verified** (full review mode). Quarterly/annual indicators correctly showed "Not due this period".
3. **Humanitarian dashboard**: Food security template applied to the project, then a results-by-place map, an activities-by-delivery-state map, number tiles (obligated, activities total/in progress/done/late) and a heading added; saved.

Month-1 figures: households registered 2,200; receiving transfer 1,640; cash USD 62,300; satisfaction 82%; children screened 1,480; referred 96; caregivers 640; seed kits 520; farmers trained 380; VSLA groups 14; grants 0; person-days 4,150; assets 3.

## 3. Findings and support-document updates
See `verification-demo-13-findings.md` (F1–F27 and the D list). Not done in this run: month 2+, mid-project and final reports, report generation/approval for Nov, infographics, exports.
