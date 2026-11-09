# Verification demo 16 — Kenya Education (EU), Mar-Aug 2026, Excel monthly upload + final report only

**DonorDesk Version 3.007+** — production, tenant "Global Care Initiative", run 2026-11-09 in one visible Chromium (CDP 9360). All organisations, people and figures are **fictional**.

## Project
- `[DEMO-16] Inclusive Quality Education for Out-of-School and Marginalised Children in Kenya's Arid Counties (IQE-KE)`, KE-EDU-20260301, donor European Union, 1 Mar - 31 Aug 2026, EUR 1,450,000 (7 lines), implementer ALP (fictional), counties Turkana, Garissa, Marsabit, Wajir, Mandera. Id `8e20556a-115e-48a7-be9b-bb1bfe14bf70`.
- 22 results, 24 indicators, 15 planned activities, 6 risks + 2 assumptions, 5 team members. Inputs: `scripts/demo-edu-ke/mk_inputs.py`.

## Done
1. Wizard from 5 documents, all 10 slides, launch. Periods Mar-Jul created by launch, August created by hand then converted with "Make this the final report".
2. Monthly data by Excel: `xlmonth.mjs` for 6 months (24 values verified each month; quarterly ones in May and Aug).
3. 66 activity records by Excel, all accepted; all 15 planned activities set to Done.
4. Final report (Aug): story answers entered, AI wrote 12 sections; 38 flagged statements not resolved.
5. Dashboard `/dashboards/7453e12b-f79b-439c-9f65-2f6ef791f207` (Education template + "Activities by place" and "Places compared" blocks); infographics `/visuals/5460ed7a-4bc3-4ae7-9a1c-19a83ebe95bd` (Coverage by location) and `/visuals/d76775f7-089b-4a74-9695-402c9ebe8fd1` (Project Closure).
6. Places: Kenya's 272 districts added from the built-in boundaries, five county areas (aliases so typed county names resolve) and four pinned sites (Balambala, Karare, Habaswein, Rhamu).

## Follow-up fixes (same day)
- **Finance:** 3 EU tranches (EUR 1,305,000 received) and 27 expenses (EUR 1,180,000) imported from one CSV, then approved; spending by budget line B1-B5.
- **Evidence:** 23 PDFs uploaded (4 kinds a month), each linked to an activity and an indicator, assigned to its period and verified.
- **Results by place:** each additive indicator carries a by-county split (pasted in the entry sheet's "By place" panel after "Reopen verified", then saved, handed in and verified again for all 6 months); "Places compared" on the dashboard now shows all five counties. The split is equal per county (a demo simplification).
- **Plan:** every planned activity now has its logframe activity and places (the wizard had not saved them), Turkana items also got Lodwar (pinned) so the plan map places all 6 sites; leads set to the account owner (added to the team as Project Manager) because the invited fictional people cannot join.
- **Activity records:** 66 records sent back, linked to their planned activity ("Save link") and resubmitted, then accepted again in bulk.
- **Report flags:** 38 reduced to 0 (26 by "This matches a verified indicator", 12 with "Keep with a note"); the final report is not approved.

## Findings
- F1 Leads chosen in the wizard's plan cards were not saved: every planned activity shows "No lead yet" and the bulk lead picker offers no people, because invited team members have not joined.
- F2 Same as demo 15: Verify all passes with 0 evidence files; imported activities are not linked to planned activities (marked the plan items Done instead).
- F3 Places: a county added as an area has no pin, so plan locations naming it are "not placed on the map" (Turkana); a pinned site named "<County> Town" made the county word ambiguous (stripped suffix); "Add a country's places" skipped provinces for Kenya.
- F4 "Places compared"/"Results by place" are empty: the Excel period sheet has no location breakdown.
- F5 Wizard again read every indicator twice (48) and left types unset; Kenya's place tree in the wizard is the old provinces/districts, not counties.
- F6 Tooling: shell-command safety service failed for a few minutes (transient); a `pkill -f` pattern closed the demo browser (relaunched with the same profile); screenshots hang on a relaunched window (made non-fatal in `demo-ui/lib.mjs`).
- F7 The wizard does not save the lead, the logframe activity or the places of a planned activity (only text in its location); fixing them needs 15 pages of manual edits. The by-place panel only offers the first 300 places (counties beyond that need the paste route).
- F8 "This matches a verified indicator" leaves the banner count stale until a reload.
- Not done: approving the final report; invited team members (fictional) cannot become leads.
