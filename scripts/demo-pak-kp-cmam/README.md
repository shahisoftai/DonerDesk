# Demo 17 — Pakistan KP CMAM + IYCF (Upper Dir and Mardan), 1 Nov 2026 to 30 Apr 2027

Built on production (donordesk.online, tenant "Global Care Initiative") on 2026-11-16 as a user would. All organisations, people, sites and figures are **fictional**. Indicator and disaggregation design follows the 2021 Pakistan nutrition reporting sheet (`2021-pak-header.csv`: boys/girls splits, OTP / SFP / SC admissions and exits, PLW screening and SFP, IYCF sessions and counselling, MNP / IFA / MMN, supplies received / consumed / left over).

## What exists now

| | |
|---|---|
| Project | `[DEMO-17] CMAM and IYCF in Upper Dir and Mardan, Khyber Pakhtunkhwa, Pakistan`, code `PAK-KP-CMAM-2026`, id `f2a96a79-148d-4ec6-86d8-8bc58aeb90cb`, UNICEF, Nutrition, USD 660,000 (8 budget lines), active |
| Results | 1 goal, 3 outcomes, 9 outputs, 11 activities (24 results) |
| Indicators | 55: 11 OTP/SFP/SC rates (cure, death, default, non-response, lower is better where it should be), 44 counts, most with a **Sex** breakdown; recorded by place at launch |
| Places | Pakistan › K.P. › **Upper Dir** (Dir, Wari, Sheringal + DHQ Hospital Dir, RHC Wari, BHU Sheringal) and **Mardan** (Mardan City, Takht Bhai, Katlang + Mardan Medical Complex, RHC Takht Bhai, BHU Katlang): 6 places per district, facilities pinned and typed (OTP site, SFP site, Stabilisation centre) |
| Work plan | 25 rows for November, plus 110 monthly rows for December to April (135 planned activities), leads and places set |
| Reporting | Monthly (due 15 days after month end) + Final report (30 days); entry window opens 5 days before, closes 10 days after; **Full** review |
| Team | 9 people, all joined (demo password `Demo#Pak2026kp`): project manager, M&E officer, grants officer, compliance officer, 4 field officers (2 per district), 1 viewer (UNICEF focal point); indicator owners and plan leads assigned |
| Field forms | 7 published forms (OTP, SFP, SC, community MUAC screening, PLW + IYCF + micronutrients, supplies, district report) each mapped to indicators and to the reporting month. 44 older single-indicator **draft** forms from the wizard are left unpublished (no delete button for drafts) |
| Dashboard | From the template "Nutrition: screening and treatment" |
| Risks | 6 risks and 2 assumptions |

Nothing has been entered as data yet: it is ready for the first reporting month.

## Rebuild a similar project (clean script)

```bash
cd scripts/demo-pak-kp-cmam
python3 mk_inputs.py inputs                      # sheets + Word proposal. Edit the lists at the top for another project.
# one visible browser, remote debugging on (any Chromium):
chromium --remote-debugging-port=9333 --user-data-dir=/tmp/demo-profile https://donordesk.online/login &
export DD_EMAIL=you@example.org DD_PASS='...'     # never commit these
export PAUSE=1500                                 # ms between steps, slow enough to film
export DD_CODE=PAK-KP-CMAM-2027 DD_NAME='My demo project'   # a project code must be unique
node run-demo.mjs 0 1 2 3 4 5 6 7 8 9 10          # sign in, then the ten wizard slides and launch
node run-demo.mjs 11 12 13 14 15 16 17 18         # places, areas, plan repeats, forms, team, setup, dashboard
```

Phases can be run one at a time (`node run-demo.mjs 4`). State (draft and project ids) is kept in `state.json`. `scratch/` holds the one-off probes used while learning the screens.

**Before you film:** Google Drive must be connected (Settings → Storage; the wizard refuses to read documents without it), "Set up projects from a document" must be on in Settings, and the Starter plan must have a free project slot.

## Recording script (what to say and click)

1. **Sign in**, open **Projects → New project**. *Say:* nothing is created until the last slide; the answers are kept as a draft.
2. **Slide 1 Start.** Donor UNICEF, Country Pakistan, Main sector Nutrition. **Choose files**: `logframe.csv`, `indicators.csv`, `workplan.csv` (three together read in about a minute; five at once time out) and **Read my documents**. *Say:* the AI reads the sheets; a blank part stays blank.
3. **Confirm what was read.** Slides 3, 4, 6: **Confirm all 24 / 55 / 25**. *Say:* check each item; you are responsible for what you accept.
4. **Slide 2 Project and team.** Name, code `PAK-KP-CMAM-2026`, dates 1 Nov 2026 to 30 Apr 2027, currency USD, summary. Add the nine people (name, email, role, **Invite later**), tick **There are no outside partners**.
5. **Slide 4 Indicators.** For each card: **Responsible**, **Better when** (Lower for death, default, non-response, deaths and defaulters), starting value (tick *No starting value* for rates), **Kind of number** = Number for counts. *Say:* the reading of the sheet did not carry these, so we set them here (known gap, see below).
6. **Slide 5 Places.** Country Pakistan, search **Upper Dir** → *Tick this area*, then **Mardan**.
7. **Slide 6 Work plan.** **Accept all** suggested links; give each row a lead and a place; tick the OTP / SFP / SC rate indicators on their treatment rows ("Feeds indicators").
8. **Slide 7 Data entry.** Counts → *A form in the field*; rates → *Typed in*. Review **Full**; window opens 5 days before, closes 10 after.
9. **Slide 8 Reporting.** Every month, standard layout, due 15 days; add **Final report**, due 30.
10. **Slide 9 Budget.** Funding UNICEF 660000 USD; eight budget lines (plain numbers, no thousands separator); *Use USD*; tie each line to an activity or "A cost of the whole project".
11. **Slide 10 Review and launch.** Six risks and two assumptions, starting dashboard *Nutrition*, **Sign off**, **Start the project**. Every step shows Done.
12. **Where we work → Manage places** (left menu Home → Where we work): upload `places.csv` → **Check the sheet** → **Add these places** (12 places; facilities with pins). *Say:* one list of places for the whole organisation.
13. **Project → Plan → Where we work:** tick **Upper Dir** and **Mardan** as this project's areas.
14. **Project → Plan → Work plan → Import a sheet:** `workplan-dec.csv` (Repeats = Monthly) → **Create planned activities** (110 rows). *Say:* the wizard only keeps the first month.
15. **Project → Data → Forms:** build the seven forms (**New form**, questions, **Add an indicator** → *Add up a number*, the reporting-month date question), **Save the draft**, **Publish**. `forms.json` has every question and mapping.
16. **Team → Invite member:** email, role, tick the project, **Send invite**. Each person opens their link, enters name and password and accepts the terms (email is not delivered, the link is shown). Responsibilities named in the wizard attach on joining.
17. **Project → Settings → Setup:** **Review** → **Confirm all** (how each indicator is read), then **Mark setup complete**.
18. **Dashboards and infographics → Start from a template → Nutrition: screening and treatment → Use this template:** choose the project, *Everyone on the project*, map the five roles, **Create the dashboard**, **Open it**.

## Things found while building (tell the viewer or fix before filming)

1. **Five files at once time out** ("The request timed out", about 20 s); one or three files work. The next slide cannot add more files after the first read.
2. A **.docx proposal** read in one file found only 3 indicators and no results; the CSV sheets read fully. Use sheets for the structured parts.
3. **Indicator cards read from a sheet** arrive without Responsible, Better when, starting value or Kind of number (NUMBER not applied; the sheet's "Better when" column is ignored).
4. **Monthly repeats in a work-plan sheet are dropped** by the wizard (only the first month is created); the sheet import after launch skips exact repeats, so the later months need their own sheet.
5. **Work-plan rows located in "Mardan" stayed unlinked** ("could be more than one place") because Mardan exists as district and as a boundary sub-area; "Khyber Pakhtunkhwa" typed in the wizard became a second province beside the boundary's "K.P." (3 plan items still point at it). Use the boundary names ("K.P.") everywhere.
6. **"Starting dashboard: Done" at launch creates no dashboard**; making it from the template shows "Your dashboard is ready" at the very bottom of a long page and the first click created a dashboard that is not listed under Your designs, so a second one was made (the map page's dashboard picker lists three "Nutrition: screening and treatment" entries; check and remove extras).
7. **Setup says "44 reportable of 55"**: the 11 rate indicators are not counted as reportable (cause not investigated).
8. The automation browser has **no WebGL**, so the map page shows the table version ("This device cannot draw maps"). Film the map on a normal Chrome. No data exists yet, so maps are empty.
9. React error #310 appears once when the wizard first opens (the page recovers).
10. Planned leads typed in a sheet fail the import until the people have joined ("not an active member of this project").
