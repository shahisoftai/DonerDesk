# Verification demo 9 (Ethiopia CMAM-IYCF) — setup run log, month 0 (started and stopped 2026-10-20)

**DonorDesk Version 2.005** (branch `0013-programme-management`). Scenario: [`verification-demo-9.md`](verification-demo-9.md).
Run on production `https://donordesk.online`, tenant GEC, account `mnpiracha@gmail.com`, one visible Chromium (CDP port 9340, profile in the session scratchpad). The password was given in chat and used only as an environment variable for the login command; it is not written to any file.

**Stopped for review after month 0 setup.** Nothing has been done for November activity records, evidence, reports or money.

**Naming:** the project is `[DEMO-9-ET]`, because a Nepal CMAM project already on production is `[DEMO-9] … Nepal` (the Phase 28 demo 9 run). Both exist.

**Project:** `838994c4-3761-4aad-9b89-ea3b32fa99d2`, code `ETH-CMAM-IYCF-OR-20261020`. Status **DRAFT** (not activated; see decision D-1).

## What is set up

| Area | Result |
| --- | --- |
| Project (wizard) | Created. Sector NUTRITION, country Ethiopia, 2026-11-01 → 2027-04-30, USD 610,000, monthly reporting, description and primary contact set |
| Logframe | 24 items pasted in one go: goal G, outcomes OC1/OC2, outputs 1.1–1.5 and 2.1–2.3, thirteen activities A1.1.1–A2.3.2 |
| Indicators | 17 created from a CSV (rates as Percentage, counts as Number), each linked to its logframe item |
| Indicator calculation | Set on all 17: survey and assessment rates "Reported directly"; counts "Sum of period values"; OP1.4 stock-out days "Average"; OP1.6 "Highest"; direction Higher or Lower per indicator (lower is better: GI-1, OC1b, OC1c, OC1d, OP1.4); basis "This period's value". Spot-checked OP1.4 and OC1a |
| Donor templates | Monthly ("HACNF Monthly Progress Report", 7 sections) and Final ("HACNF Final Report", 12 sections incl. nested) uploaded, extracted, all sections accepted, both **Approved**. Setup shows 12 reviewed required sections |
| Reporting profile | English, Formal tone, writing style, audience notes, 6 formatting rules, 4 special requirements, deadline offset 15 days, **second approver on**, financial figures "Type them in". Saved; reloaded and confirmed |
| Team | 8 members on the project (see mapping below) |
| Work plan | "Start from my logframe" created 33 planned items (13 logframe activities; 4 monthly series expanded). Added 5 single items and 2 recurring series: OTP follow-up visits (weekly, 26 rows) and the monthly data review (6 rows). Overview: **70 planned activities** |
| Reporting calendar | **November 2026 Monthly period created** (1–30 Nov, deadline 15 Dec, template = Monthly). December to March and the April closing report are not created yet, by choice |
| Setup checklist | **READY**: workspace not required (non-Drive), donor template done, indicators 17 of 17 reportable, reporting profile done, no blockers |

### Team mapping (existing organisation accounts stand in for the scenario roles)
The scenario names are fictional people. No new accounts were created. Mapping:

| Scenario role | Account on the project | Project role |
| --- | --- | --- |
| Project Manager (Hiwot Tesfaye) | Amara Okafor | Project Manager |
| M&E Officer (Dawit Mekonnen) | Anita Gurung | M&E Officer |
| Nutrition Officer / second approver (Selam Worku) | Zainab Lawan | Project Manager (not the author of the reports) |
| Field Officer, Woreda A (Abdi Hassan) | Ram Bahadur Chaudhary | Field Officer |
| Field Officer, Woreda B (Tigist Alemu) | Grace Achieng | Field Officer |
| Field Officer, Woreda C (Yonas Bekele) | P25 Check Field Officer (test account) | Field Officer |
| Logistics (Mulugeta Addis) | Ingrid Solberg | Grants Officer |
| Finance/grants (Genet Dessie) | Najeeb Piracha (own account) | Grants Officer |

Planned-activity leads follow these accounts (screening and training leads, OTP and supply leads, survey lead Anita Gurung).

## Deviations from the scenario document (corrected in `verification-demo-9.md`)
- Logframe has **24 items** (8 outputs), not 26 with eleven outputs.
- Indicator file has **17 indicators**, not 22.
- Logframe output codes are `1.1`…`2.3` in the file, with the activity codes `A1.1.1`…; the indicators link by those codes. The scenario's `OP` prefix is only a naming convention in the document.
- The wizard created one continuous row per logframe activity. The weekly OTP visits and the monthly review were then added as recurring series, so **A1.2.1 "Operate six OTP sites" and "OTP follow-up visits" overlap** (see finding F-5).
- Survey and assessment rates use "Reported directly"; the cure, defaulter, death and non-response rates are entered as cohort rates, so the calculation "Numerator ÷ denominator" was not used.
- Indicator group targets (by sex or age) were not set; the disaggregation flag is set from the file only.

## Findings (run log format: Sev, Step, What happened, Status)

| # | Sev | Step | What happened | Status |
| --- | --- | --- | --- | --- |
| F-1 | **H** | Planned activities list | After the wizard created 33 planned items, the planned list (`/activities?view=planned`) shows **"This part of the page could not be loaded … Try again"**. The project Overview counts them correctly ("0 of 33 planned activities done", later 70). The work-plan API returns 200 for the same project (checked in the API log). The web journal shows no matching error (only a recurring image-cache write error, F-9). The plan cannot be reviewed in list form. | Open. Needs a browser error boundary detail or a server-side reproduction |
| F-2 | M | Plan wizard entry | Clicking the link "Start from my logframe" on the planned tab lands on a **404 Page not found** (client navigation). The same URL loads when opened directly | Open |
| F-3 | M | Plan wizard, step 3 | The last button is "Finish" and leads to a summary whose button is "Create". The summary line says "33 activities, 4 repeating monthly" only after leads are set. The order of the buttons is easy to misread | Open (UX) |
| F-4 | L | Plan form, repeats | Choosing **Every week** or **Every month** reveals an **Until** date. Without it the form does nothing and no error is shown. "Ends" means the end of each occurrence, not of the series. Neither is explained next to the field | Open (UX) |
| F-5 | L | Plan content | The wizard row "Operate six OTP sites" (continuous) and the added "OTP follow-up visits" (weekly) describe the same work. Duplicate planned items are not reported | Decision needed (D-3) |
| F-6 | M | Organisation time zone | Reminders go out at 07:00 in the **organisation's** time zone. The organisation is shared by all demo projects on this tenant, so changing it to Africa/Addis_Ababa would change the reminder time for every project in GEC | Not changed (D-2) |
| F-7 | L | Indicator calculation | Each of the 17 indicators needs its own calculation, direction and basis (17 page visits). No bulk setting. Rates arrive as "Calculation needs review" | Info (demo 8 finding 2 again) |
| F-8 | L | Reporting profile | The first save attempt raised an error in my script; the second attempt saved and reloading showed every value. Not reproduced by hand | Info |
| F-9 | L | Production web journal | Recurring `ENOENT … apps/web/.next/standalone/apps/web/.next/cache` for image caching (about every minute). Looks like a deployment path issue. Not related to the plan list | Open (ops) |
| F-10 | Info | Team invites | Email invitations are not used in this run; the seven scenario people are represented by existing accounts (table above). Expired invitations from earlier demos are still listed under "Invited, not joined" | Info |
| F-11 | Info | Scenario naming | A Nepal `[DEMO-9]` project already exists; this one is `[DEMO-9-ET]` | Info |

## Decisions for you (D)
- **D-1 Activate the project?** Left as DRAFT. Activation is the "ready to report" step. I did not activate it.
- **D-2 Organisation time zone.** Left as it was (not Africa/Addis_Ababa). Changing it changes the reminder time for every project in GEC. Confirm whether you want it changed, or a separate tenant for this demo.
- **D-3 Duplicate OTP visits.** Keep the continuous A1.2.1 row and the weekly series, or delete the continuous row. Deletion is not done.
- **D-4 Remaining calendar.** December to March and the April closing report are not created. They are created as each month is reached, as the scenario says.
- **D-5 Team.** Are the existing accounts an acceptable stand-in, or should the scenario people be invited (email is not delivered in this build, so they would need the invite link copied)?

## Not done in month 0 (by design)
Activity records, evidence files, indicator values (including the November baseline values, which come from the indicator definitions), story answers, compliance statements, finance, reports, approvals, exports. The December to April calendar. Activation. Indicator group targets.

## Next step when you say go
Activate (if D-1 yes), then November: activity records from scenario §10, evidence from §9, the monthly grid from §11.1 for November (OP1.1 1,920 screened; OP1.2 30 SAM; OP1.3 70 MAM; OP2.1 480 caregivers; OP2.2 0 sessions; OP2.3 78 counsellors trained), story answers, then generate the November report.

## Files
- Scenario: `memorybank/demo/verification-demo-9.md`
- This log: `memorybank/demo/verification-demo-9-et-run.md`
- Generated inputs (not in the repo): `/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/3bcaeee6-cfc0-4e5d-81ac-e57bb68eb0ba/scratchpad/dd9/` (`logframe.csv`, `indicators.csv`, `mk_templates.py`, `HACNF-*.docx`, `plan-items.json`, scripts)

---

## Fixes made after the first report (2026-10-20, tested, **deployed as release `20261020041457`**)

The first deploy attempt was refused by the permission classifier; after your go-ahead the migration `20261021100000_project_time_zone` was applied as the migrator and the release shipped (`SCOPE=both`). Verified on production: `/ready` ok, the planned list and the Timeline render with no console errors, the plan wizard page loads, the project time zone saves and reads back (Africa/Addis_Ababa). Gates run locally: `pnpm -r typecheck` clean; contracts 14, domain 695, application 622, infrastructure 345 (71 DB tests skipped), web unit 345 all pass.

| Finding | Cause | Fix |
| --- | --- | --- |
| F-1 planned list "could not be loaded" | React error #185 (endless re-render) in `PlanTimeline`: `range` was rebuilt on every render, which rebuilt the layout and links, and the arrows layout effect then set a **new array every pass**. A plan with no "comes after" links (this project) set a new empty array forever. Admins, PMs and M&E open the Timeline first, so they saw it; a Field Officer (List first) would not | `range` is memoised; arrows are only set when they changed (`PlanTimeline.tsx`) |
| F-2 404 on "Start from my logframe" | The `@panel/(.)plan/[itemId]` interception caught `plan/start` as an activity id (API log showed `/v1/work-plan/start/...` 404s) | The links to `plan/start`, `plan/new` and `plan/import` are plain anchors (hard navigation), with a comment saying why |
| F-3 wizard buttons | Step 3 said "Finish" and led to a summary with "Create" | Step 3 button is "Review"; "Create" saves |
| F-4 repeat fields | "Until" appeared only after choosing a repeat; "Ends" meant each repeat | Helper text on Repeats and Ends; label "Until (last repeat)" |
| F-6 time zone | The zone was only on the organisation (shared by every project) | **Optional per-project time zone**: `Project.timeZone` (migration `20261021100000_project_time_zone`, additive), set in project Settings ("Time zone (optional)", empty clears it), validated as an IANA name in `UpdateProjectHandler`, `/ready` checks the column. The plan list reads "today" in the project's zone, else the organisation's, else UTC (`ListWorkPlanHandler` via `IPlanContextReader.timeZoneFor`; web `todayInZone`). **Reminders still run in the organisation's 07:00 hour** |
| F-9 web image cache error | `donordesk-web.service` has `ProtectSystem=strict` and no writable path for Next's `.next/cache` | `infra/systemd/donordesk-web.service` (new, mirrors the host unit) adds `ReadWritePaths=-…/.next/cache` and creates the directory. **Not installed on the host** |
| F-5 duplicate OTP rows, F-7 per-indicator calculation | Not code defects: a plan-content decision (D-3) and a known cost | Unchanged |

New tests: `today-in-zone.test.mts` (web), and in `workplan-handlers.test.mjs` the list reading today in a project zone and the project time zone update (valid, invalid, cleared).

### What I did on the host (read-only except one file)
- Read the API and web journals and the web unit.
- Wrote a database backup: `/opt/donordesk/backups/db-pre-20261021-timezone.dump` (7.8 MB), as the deploy runbook asks before a migration. Nothing else on the host changed.

### Still to finish on the host (not done)
1. `rsync --relative` the schema and the migration dir, `prisma migrate deploy` as `donordesk_migrator` (additive column), then `RELEASE_ID=… SCOPE=both scripts/deploy-fast.sh` (the project's documented order).
2. Install `infra/systemd/donordesk-web.service` over `/etc/systemd/system/donordesk-web.service` (keep the `api-url.conf` drop-in), `daemon-reload`, restart web, and confirm the `.next/cache` errors stop.
3. Open the planned list as the project admin and confirm it renders (F-1), open "Start from my logframe" from the planned tab (F-2), and set the project time zone to Africa/Addis_Ababa.


## Gantt chart (Timeline) audit and rebuild (2026-10-20)

**Audit of the old Timeline** (screenshot on production, `activities?view=planned`, Timeline):
1. **No activity names beside the rows.** A name existed only inside its bar and was cut off ("IYCF counsellor trai…"); one-day bars showed only "◆". The output heading sat above its bars.
2. **Scrolling did not pan the plan.** Bars were drawn as percentages of a window the width of the page, so a sideways scroll only slid a fixed picture; there was no way to reach other months.
3. **A window, not the plan.** "Quarter" showed the quarter containing today (Oct to Dec), so 41 of the 70 activities were "planned outside this period" and unreachable; no next or previous.
4. **A repeating series drew 26 rows** (the weekly OTP visits) and pushed everything else off the screen.
5. No way to find an activity, see only mine or only the late ones, collapse an output, or jump to today.

**Rebuilt** (`PlanTimeline.tsx`, pure parts in `timeline-layout.ts`, `timeline-rows.ts`):
- **Name column on the left stays in view** (sticky): a status dot, the activity name (opens the activity), its lead and dates; a series shows "26 repeats". Output headers show how many activities, % done and how many are late, and collapse.
- **The chart is as wide as the plan** and scrolls sideways as one: the months and weeks header (sticky at the top), every bar, the grid, today and the report deadlines move together. Drag the empty chart to pan; the ◀ Today ▶ buttons jump; the toolbar says which dates are in view.
- **Scale, not window:** Week, Month, Quarter, Whole project. Changing the scale keeps the middle of what you were looking at; first open centres today (or the start when today is outside the plan). The saved zoom is remembered.
- **Repeats share one line** (a series of 26 weekly visits is one row of 26 small bars); the name column counts them.
- **Filters:** find by activity or person, Mine, Late, Hide done, Clear, Collapse all or Expand all; filters never change the dates the chart spans.
- Bars carry their dates inside when wide enough; short ones are named in the left column and by tooltip. Dependencies (arrows), drag to move or change dates, the confirm bar and the keyboard moves are kept. A legend explains the symbols.

Tests: `timeline.test.mts` (full range, chart width, month bands, series lanes, bar fields) and `timeline-rows.test.mts` (flat row list, collapse, filters). Web unit 353 pass, typecheck clean.
