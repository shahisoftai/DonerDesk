# Verification demo 15 — Ethiopia WASH (USAID), Jan-Jul 2026, Excel monthly upload + final report only

**DonorDesk Version 3.007+** — production, tenant "Global Care Initiative" (plan Enterprise, manual), run 2026-11-09 in one visible Chromium (CDP 9360). All organisations, people and figures are **fictional**.

## Project
- `[DEMO-15] Safe Water, Sanitation and Hygiene for Drought-Affected Communities in Somali Region, Ethiopia (SWASH-ET)`, ET-WASH-20260101, donor USAID, 1 Jan - 31 Jul 2026, USD 1,200,000 (7 lines), implementer HWSA (fictional), woredas Gode, Mustahil, Kebri Dahar, Warder, Dolo Ado. Id `cd291c72-ebc9-4f16-8633-b7c9007507ed`.
- 20 results, 23 indicators (Sphere-based: 15 l/p/d, 20 people per toilet; FRC >= 0.2 mg/L; CLTS/ODF; hygiene kits; cholera preparedness), 14 planned activities, 6 risks + 2 assumptions, 5 team members. Inputs: `scripts/demo-wash-et/mk_inputs.py`.

## Done
1. Wizard from 5 documents (all 10 slides, launch). Periods Jan-Jun created by launch, July created by hand and converted with "Make this the final report".
2. **Monthly data by Excel**: for each of the 7 months `xlmonth.mjs` downloads the period sheet (`/api/reporting-periods/<id>/indicator-sheet/export`), fills "Period achievement / Cumulative / Data source" (`fillsheet.py`, values in `vals.json`), uploads it with **Import Excel**, clicks **Apply N to grid**, **Save all**, **Submit for review**, **Verify all**: 23 values verified every month (quarterly ones in Mar, Jun, Jul). Verification was not blocked by "0 evidence files".
3. **Activity records by Excel**: one workbook (67 rows, 7 months, `mk_activities.py`) imported through Activities > Import: 67 created in one step, each placed in the month of its date; all accepted in one action. No evidence files were attached.
4. Final report (July): story answers entered, AI wrote all sections.
5. Dashboard from the WASH template: `/dashboards/8b7f95d8-0695-4582-a065-fb652002b497`. Infographics: "Coverage by location" `/visuals/d7674da5-34c8-4fa7-a984-41fb2481a933` and "Project Closure" `/visuals/f1dc6691-0aff-43e9-be8e-75b1eb2ca3a7`.

## Findings
- F1 The Excel export lists quarterly indicators as "Not due" months; importing a sheet with empty cells there is fine, but the preview says "Apply 23 to grid" even when only 18 rows carry values.
- F2 "Verify all" accepts values with no evidence at all (0 evidence files); in demo 14 the guidance suggested a file was needed. The rule should be stated on screen.
- F3 Imported activity records are not linked to planned activities, so the infographic says "0 / 4 done · 4 late" for every place and Project Closure shows "People reached 0".
- F4 "Results by place" in the infographic is empty: the Excel period sheet has no LOCATION breakdown columns, so results by place cannot be entered through it.
- F5 Wizard again read each indicator twice (46 proposed) and left the type unset for most; places list is the old zone/region tree (Somali region ticked as a whole); monthly cadence had to be re-selected (starting answers set "every three months"); the July period and the final report are not created by launch.
- F6 Jan report deadline is 2 Mar 2026 while the other months are 30 days after period end (first period offset differs).
- F7 "Create the dashboard" confirms only with a link at the bottom of a very long page.
- Not done: map pins, finance entries, exports, flags on the final report not resolved.
