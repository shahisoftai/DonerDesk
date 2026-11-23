# KP health facilities detailed assessment 2026 — the project as built (2026-11-23)

**Tenant:** AGRC (admin Dr Mohammad Najeeb). **Project:** "KP Health Facilities Detailed Assessment 2026", code `KPHF-HFA-2026`, id `6fec7b72-ced7-477e-a103-30b6964f618e`, donor Khyber Pakhtunkhwa Health Foundation, country Pakistan, sector Health, 23 Nov to 11 Dec 2026, one final report, **ACTIVE**. Built through the API (not the wizard); the generators are in `scripts/kp-hf-assessment/` (README there).

## What exists
| | |
|---|---|
| Places | 60: Pakistan, K.P., 21 districts and the 37 facilities (typed by category: `CAT_B`, `CAT_C`, `CAT_D`, `RHC`, `CIVIL`; marked as facilities). Source list: `list of hospitals` (37 facilities, **21 districts**) |
| Logframe | Goal G; Outcome OC1 (a verified baseline on infrastructure, equipment, utilities, services and staff); Output 1.1 (37 assessments done); Output 1.2 (data checked and reported); activities A1.1.1 (prepare), A1.1.2 (assess each facility), A1.2.1 (verify), A1.2.2 (consolidated report) |
| Indicators | 6: OC1-1 facilities with a completed assessment (target 37; the form's one count mapping feeds it, `latestPerFacility`), OC1-2 signed assessments, 1.1-1 facilities assessed, 1.1-2 districts covered (21), 1.2-1 assessments verified, 1.2-2 report done |
| Work plan | 41 planned activities, each linked to its facility: pre-test 23 Nov, assessor training 24 Nov, the 37 visits 25 Nov to 8 Dec (grouped by district, 3 to 5 a day; North Waziristan and Mahsud Belt two days), verification 9 to 10 Dec, report 9 to 11 Dec. A proposed schedule: change it as the teams need |
| Form | "Health Facility Assessment (HFA Tool Nov 2025)", id `eeb8a00f-9cc0-4faf-bab4-6512f0a29d3e`, **published**, about a facility; 240 top-level questions in 32 sections, 64 tables with 1,388 rows (843 equipment rows, 440 checklist and count items); a department gate per lab, radiology, five wards, labour room, theatre, ICU, dental and staff residences. Built from the Nov 2025 tool, not from the older built-in kit; no scoring (the tool defines none) |
| People | Admin najeebpiracha@msn.com; field officer **Pasha Piracha** (mnajeebgec@gmail.com, invited 2026-11-23, joined). Three facilities were given to Pasha on the form's Facilities tab (Chakdara Cat-B, Lakki Marwat Cat-C, Madyan Cat-C, due 28 Nov). **The older AGRC entry mnpiracha@gmail.com (field officer) should be removed in Team**: the same address also exists in the demo organisation and sign-in opens that one |

## Pins on the map
29 of 37 are pinned from OpenStreetMap searches (`scripts/kp-hf-assessment/geo.json`): **4 at the hospital itself** (Lachi, Rustam, Besham, Madyan) and **25 at the village or town** (some only a road, a dam or a chowk; Tiarza is the tehsil; the two Lakki Marwat hospitals share one point). **8 have no pin**: Pacha Kallay, Kanpur, Thathi Nasrathi, Titter Khel, Ghallanai, Daboori, Mathani, Manglore. Nothing marks a pin as approximate in the product, and names were left unchanged so the form and plan links hold. Replace them with the GPS question (Section 1) captured at each visit, or with coordinates from the Health Foundation.

## How an assessor works
`https://donordesk.online/field` on the phone: sign in, **Download or refresh** for the project (the pack holds the form, the places and what was assigned), open the form under **On this phone**, **Start** a given facility, fill section by section (a draft is kept on the phone), take photos, sign, **Send** (or **Save on this phone** offline). Home shows **Given to you**; see `Features/72-Field-Officer-Access-Phase-63.md`.

## Open items
- Assign the other 34 facilities (Facilities tab) and remove the old mnpiracha entry.
- Real GPS to replace the rough pins; the 8 unpinned places.
- No reporting period exists yet (the final report period); create it from Reports when the visits are done so OC1-1 can be applied.
- The tool's score, if the Foundation wants one, is a decision for them (`ScoreRules` can be added to the form: it is frozen once published, so a new version of the form would be needed).
