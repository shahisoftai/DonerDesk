# Verification demo 17 — Pakistan KP CMAM + IYCF (UNICEF), Upper Dir and Mardan

**DonerDesk Version 4.01** — production, tenant "Global Care Initiative", `mnpiracha@gmail.com`, built 2026-11-16 in one visible Chromium (CDP 9333). Everything is **fictional**. Scripts, inputs and the recording script: `scripts/demo-pak-kp-cmam/` (`README.md`, `run-demo.mjs`, `mk_inputs.py`).

## Project
`[DEMO-17] CMAM and IYCF in Upper Dir and Mardan, Khyber Pakhtunkhwa, Pakistan`, code PAK-KP-CMAM-2026, id `f2a96a79-148d-4ec6-86d8-8bc58aeb90cb`, UNICEF, 1 Nov 2026 - 30 Apr 2027, USD 660,000 (8 lines). 24 results, 55 indicators (11 rates + 44 counts, boys/girls breakdown from the 2021 Pakistan sheet), 135 planned activities, 12 places (6 per district), 7 published forms, 9 team members joined, Nutrition dashboard, 6 risks + 2 assumptions. No data entered.

## Findings (each became a Phase 58 batch or backlog item)
1. Five files in one read time out; one or three work (58.8).
2. A .docx read found 3 indicators; CSV sheets read fully.
3. Indicator cards arrive without owner, direction, starting value or kind (fixed in part: 58.1 suggestions and sheet Type column).
4. Work-plan Repeats dropped by the wizard (58.7).
5. "Mardan" ambiguous; "Khyber Pakhtunkhwa" vs boundary "K.P." became two provinces (58.9).
6. Launch "starting dashboard: Done" and template-created dashboards are not listed until opened; the success note was below a long page (58.2 scroll fix; listing 58.12).
7. Setup "44 reportable of 55" had no reason (fixed: 58.5).
8. 44 single-indicator draft forms could not be deleted (fixed: 58.3).
9. The automation browser has no WebGL (maps show as tables).
10. React #310 once when the wizard first opens.

## Status after Phase 58 (2026-11-16)
Fixed and checked live: 1 (several files, 100 s), 4 (work-plan Repeats reach the launch; the cause was redacted lead emails making the sheet reader give up), 3 in part (suggested settings: 52 of 55 directions, the type from the sheet), 7 (Setup says why), 8 (draft forms can be deleted), 6 in part (the ready note scrolls into view). Still open: 2, 5, 6 (listing), 9, 10 and the backlog items in the plan. Feature doc: `memorybank/Features/68-Simpler-Setup-Phase-58.md`.
