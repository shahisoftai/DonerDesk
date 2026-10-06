# Verification demo 5 — a six-month USAID health project in Kenya, built and reported through the UI (2026-10-06)

A six-month **health** project for **USAID**, built on production (`donordesk.online`, tenant `GEC`) as a tenant would: one visible Chromium window driven by Playwright, no API calls and no
database writes. It follows [`verification-demo-4.md`](verification-demo-4.md) and re-tests Phase 23/24 on a donor-style (USAID) project with monthly reports and a closing report.

Project: **"[DEMO-5] Turkana Maternal, Newborn & Child Health Strengthening Activity"** — `eb6e01d5-252b-4e66-9eb4-77e118199528`, Kenya / Turkana County, 2026-03-01 → 2026-08-31, USD 1,150,000,
monthly reporting, partner LOCHA. An earlier build (`565eb45d…`) is archived as `[DEMO-5-SUPERSEDED]` (finding 1). Scripts: `scripts/demo-health-ui/`; downloads and generated inputs:
`verification-demo-5-artifacts/` (`reports/` has every month's Word, PDF, indicator workbook and evidence checklist; `ev/` the 99 synthetic evidence files).

## What was built

| Layer | Content |
|---|---|
| Logframe | 1 goal, 2 outcomes (IR1, IR2), 8 outputs, 8 activity nodes (goal by hand, rest imported from CSV) |
| Indicators | 17: 4 percentages (ANC4+, skilled delivery, Penta3, danger-sign knowledge — quarterly) + KHIS timeliness, 12 counts; 6 with sex breakdowns; 16 imported with the *Logframe Code* column, 1 added by hand ("Indicator saved under Output 2.3") |
| Donor templates | USAID Monthly (8 sections) and Activity Completion Report (14, two nested) uploaded as DOCX, extracted accurately, approved |
| Team | Admin (project manager), M&E officer and field officer (two invited users accepted through the invite links); all three assigned to the project |
| Periods | Mar–Jul by "Create all"; Aug created by the **closing-report** page as the Final period |
| Data | 6 × 17 indicator values entered and verified (sex splits), 5 story answers a month; 48 accepted activity records; 99 evidence files, all verified |
| Evidence routes | Month 1 files dropped on the activity form (no indicator link); months 2–6 through the evidence form with activity **and** indicator |
| Finance | 7 budget lines, USD 1,150,000 budget, 1,102,500 spent (95.9%), entered and **verified** on the final period |
| Reports | 5 monthly reports and the Activity Completion Report: sections approved, report approved, donor copy exported |

## Findings

H = blocks or misleads, M = friction, L = polish. **Fixed** items were deployed during this demo (release `20261006074809`, commit `5a69cf4`).

| # | Sev | Finding | Status |
|---|---|---|---|
| 1 | H | Auto-create periods created the final month as a Monthly report; the closing report could then not be started and periods cannot be deleted | **Fixed**: the last block is never auto-created. Verified: the closing page then offered "Start the closing report" |
| 2 | H | Main narrative sections silently fell back to a stub ("Written without AI", no reason). Progress failed validation on derived percentages in months 1, 2 and 4; others hit a provider timeout (HTTP 500). The stub also used the wrong template ("Progress Against the Work Plan" got next steps; "Collaboration, Learning…" got an indicator dump). "Try AI again" only opens the rewrite box | **Partly fixed**: stub routing and banner text. Still open: no stored per-section reason, the writer still computes cumulative percentages, and a regenerate with an instruction is needed |
| 3 | H | An indicator with no value for the period (quarterly survey in a monthly report) was reported as "0%" | **Fixed**: left out unless a life-of-project figure exists. Verified: no "0" for it in months 2–5 |
| 4 | H | The export wizard always produced the watermarked internal copy ("INTERNAL PREVIEW — NOT FOR DONOR SUBMISSION"), even for an approved, clean report | **Fixed**: a **Copy** choice seals the version and exports the donor copy. Verified: no watermark in months 2–6 and the final PDF |
| 5 | H | `/settings/billing` fails with "Validation failed — limits.viewerSeats / aiCreditTopUp / byoLlmEnabled: Required" | Open |
| 6 | H | Compliance checklist items that depend on data (activity updates, finance, disaggregation) stay open on the final report until **⋯ → Scan for missing items**; the docs said they close by themselves | Open (docs corrected) |
| 7 | M | The writer leaked internal evidence ids into donor text ("evidence ids 4cf3e302, …"), invented section labels (IR1/IR2/IR3) and cross-references, and split a sentence at "no." in the award number, making a figure flag nobody could clear. Figure flags on restated verified numbers had to be kept with a note | Open |
| 8 | M | Compliance sections (environmental, branding, gender actions) have no input route; the field-report importer finds about one topic and its "Add confirmed to report" failed with "unexpected response shape". Putting the facts in the story answers worked | Open (docs updated) |
| 9 | M | Files dropped on the activity form are type "Other" with no indicator link; "Suggest links" found nothing; the file page has no link control; evidence cannot be verified in bulk | Open (docs corrected) |
| 10 | M | Section regeneration is silent and slow to show; the stale-summary warning persists after regeneration; executive summary exceeded the template's 250-word limit | Open |
| 11 | M | Closing page step "Sign-offs assigned" stayed "To do" with a PM and an M&E officer assigned; setup said "Team assignment: Todo" with three members | Open |
| 12 | M | Create/extract/upload forms often do not redirect after saving (4 of 17 uploads in one month) | Open (as demo 4 finding 13) |
| 13 | L | "0 participants" shown when none was entered; unlabeled selects on the evidence form; garbled en dash in the PDF header; indicator table columns too narrow in the PDF; "1 item still need attention"; Final template became the project default | Open |

## Outcome

Final report (Activity Completion Report, 14 sections, all approved): every life-of-project figure is correct (122 health workers, 14 facilities equipped, 220 CHVs, ANC4+ 46%, skilled delivery
61%, Penta3 81%, danger signs 61%, KHIS 92%, 3,940 first ANC visits, 1,800 skilled deliveries, 17,500 reached, 8,800 screened, 625 referred, finance 1,150,000 / 1,102,500 / 95.9%). The count
targets that were missed are explained from the records (floods, nurses' strike, cold-chain failure). One highly sensitive file (maternal death summary) stayed out of the exports.

**Attested by the demo, not by a person:** the final checklist items (sign-off, sensitive data handling, procurement records, 30-day submission rule, AI content reviewed) were resolved in bulk
with a note by the project-manager account; a procurement register was uploaded to support one of them. The M&E-officer sign-off was not exercised from the second account.

## Support docs corrected

Story questions (five, not four, plus a tip for compliance facts), reporting month, auto-create and the closing block, export copy choice and the evidence-ZIP ticks, checklist refresh (scan),
evidence linking, the "Written without AI" banner. The support pages are served from these files, so they need a deploy to go live.
