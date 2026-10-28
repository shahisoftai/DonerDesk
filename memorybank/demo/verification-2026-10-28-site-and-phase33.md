# Browser verification, 2026-10-28: Phase 33 and the programme-management site

**DonorDesk Version 3.007.** Driven in one visible Chromium (CDP, port 9333) on https://donordesk.online as the demo tenant `mnpiracha@gmail.com` (GEC), against release `20261028073924`. Scripts: `scripts/demo-ui/login.mjs`, `smoke.mjs`, `links.mjs`. Test rows made: dashboard, collection form, form link, two form records, API key (all removed or switched off; the two records and the closed form remain, labelled "ZZ TEST").

## Check list and result

| # | Check | Result |
|---|---|---|
| 1 | Smoke crawl: 50 signed-in pages (global, settings, every project tab, plan views, `/field`) | **Pass**: all 200, no console errors, no error text |
| 2 | Website: home, `/features`, support articles and the four reference pages answer; new titles live | **Pass** |
| 3 | Language switcher, French and Arabic | **Pass with a gap**: navigation, field app and collection page change; Arabic sets `dir=rtl`. Project, plan and settings screens stay English. Copy was corrected to say so |
| 4 | Plan: List / Timeline / Map views, Timeline bars, status colours | **Pass** (Timeline and legend render) |
| 5 | Map view and Overview "Where we work" on a project with locations (DEMO-8) | **Pass**: canvas drawn, "5 sites · 2 late · 3 done". A project with no locations says "No location to map yet" |
| 6 | Ask DonorDesk on the real model (switched on in Settings) | **Pass, see below** |
| 7 | Dashboards: create, add a chart from the Data Center, share link opened signed-out, embed link | **Pass** |
| 8 | Collection form: build (number + photo question, indicator mapping), validation message, publish, public link with a photo, record shows in Records | **Pass** |
| 9 | Field app `/field`: download a project, reload with the connection off, send a record with a photo | **Partly**: the page reloads from the phone's copy and the record arrived (by the signed-in user, photo attached). Emulated offline did not flip the browser's online flag, so a **real airplane-mode test on a phone is still owed** |
| 10 | Integrations: create a read-only key, `GET /api/v1/projects`, no key = 401, MCP `tools/list` | **Pass** |
| 11 | Infographic Studio: open a design, live preview with map, Design check, Publish panel (approval gate "Get it approved first") | **Pass** (nothing published) |
| 12 | Security page: "Require two-step sign-in for everyone" card and counts | **Seen** ("23 of 23 people have not set it up"); **not switched on** |

### Ask golden set (DEMO-8, 8 questions)
7 answered with cited records, 1 timed out. Figures matched the data (22,900 people reached; 585 of 600 latrines; 16 of 20 water points). "Budget in dollars" and "project manager's phone" were refused as not stated, and one sentence was dropped as ungrounded. Times 12 to 62 s; the broad "summarise outcome 1" question hit the 60 s limit ("The request timed out"). One answer called WS-IMP1 "21 against a target of 18, not yet met"; check whether that indicator is lower-is-better before accepting that wording.

## Findings

1. **Languages cover the shell only** (copy corrected on the site and in three articles).
2. **Ask timeout** on broad questions (about 60 s).
3. **Settings checkbox for Ask** saves on click but the box did not show the new state until reload.
4. **`/field` shows "You are online." and gives no "saved on this phone" confirmation** after Send while the emulated connection was off; it only clears the form. Confirm on a real phone.
5. `forms/new` highlights the Overview tab instead of Data; `?view=timeline|map` in the plan URL is ignored (the last-used view wins).

## Not checked (still owed)
Dragging and resizing on the dashboard canvas; KoboToolbox / SurveyCTO against real servers; a real phone in airplane mode; publishing an infographic and its share link; requiring two-step sign-in and signing in as a second account; "Enter as drafts" totals from accepted records; native review of the translations; Arabic layout on older screens.
