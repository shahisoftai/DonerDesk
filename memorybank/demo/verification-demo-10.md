# Verification demo 10 — the 2026-10-21 gap-closure features, checked on production

**Date:** 2026-10-21 · **Where:** `donordesk.online`, the demo/test tenant (GEC, mnpiracha@gmail.com), releases `20261021054800`, `…061014`, `…062305` · **How:** a visible browser (Playwright over CDP) logged in as the tenant admin, plus the host over SSH for the parts a browser cannot see. Everything created was in the test tenant; throwaway rows I made directly in the database (a test programme and grant) were removed by exact id.

## Result in one table

| # | Feature (audit item) | What was done | Result |
|---|---|---|---|
| 1 | Two-step sign-in (H-12) | Set up in Settings → Security with a real authenticator code computed from the shown key; recovery codes shown once; signed in from a **fresh private window** (password step asks for a code; a recovery code completed it); turned off with password + recovery code | ✅ whole cycle |
| 2 | Evidence before verified (ME-05/09) | Turned the project setting on; "Submit & verify" on a value with no file → "Attach a file that proves this value before it is verified…", value stays Draft; setting turned off again | ✅ |
| 3 | Target schedule + variance (ME-02/11) | Indicator editor: a bad line is refused with its line number; a three-step schedule saved and shown on the indicator page; value 4 recorded for a month whose scheduled target is 5; Data Center "Variance from scheduled target" reads **-1 (-20%)** | ✅ |
| 4 | Portfolio dashboard (PM-08) | `/portfolio`: 22 projects, 7 behind, open problems/risks, overdue reports, most pressing first, each row links to the project | ✅ |
| 5 | Double-count guard (ME-07) | `/portfolio/indicators` flags groups of projects in one country with overlapping dates; ticked "another project also counts these" on one indicator → group total fell **130 → 70** and the project reads "counted by another project, not added" | ✅ |
| 6 | Donor indicator mapping (AI-04) | Template page "Indicators the donor asks for": no match → "Will not be reported" → undo → matched to IND-1 ("Confirmed by a person") → undo | ✅ |
| 7 | OCR for scans (AI-03) | Worker on the host read a generated image in 2 s at 0.986 confidence; through the **activities import screen** the text appeared with the note "check names and numbers" | ✅ after one fix (below) |
| 8 | Model, writing-rules version and change summary (AI-14/15) | Report section → History: "Written by the AI · model ai-reporter, writing rules v4" | ✅ (model/version; the change sentence needs a second version of a section to show) |
| 9 | Demo project with a first quarter (UX-03) | Deleted the tenant's old demo project, started the tour: new demo has a quarterly report period (Jul–Oct 2026, 14 days left), two accepted activities (640 and 24 participants) | ✅ after one fix (below) |
| 10 | Sales and privacy mail (MK-10, SE-09) | Contact-sales inquiry through the live endpoint → delivered to support@donordesk.online through the host's own Exim (earlier in the session) | ✅ |
| 11 | Off-host backup to Google Drive (SE-06) | Nightly backup copied 4 files / 23.8 MB to Drive, size matched; run again before the deploy | ✅ |
| 12 | Help articles inside the app (UX-10) | Support Center lists the articles on production | ✅ |
| 13 | Encryption at rest (SE-03) | **Not switched on.** Dry run on the real storage: `622 encrypted, 0 failed` with a throwaway key | ◐ needs a key decision |
| 14 | PDF indicator lines (RP-08) | Shared column definition, covered by tests; PDF not downloaded in the browser | ◐ tests only |
| 15 | Portfolio / org export omits MFA secrets | Covered by the H-11 test (it failed before the fix) | ✅ test |

## Problems found while verifying (all fixed and redeployed)

1. **The web build broke** after the target-schedule field: a client component imported the whole domain package, which pulled `node:crypto` into the browser bundle. It now imports the one pure module (`@donordesk/domain/contexts/logframe/target-schedule.js`). Caught by the full build before deploy.
2. **OCR text was refused.** The API's rule `assessTextExtraction` rejected any image by file extension, even when recognition had returned words. It now accepts words read by OCR (`readByOcr`), with tests.
3. **Deleting a demo project failed** with `ReportRevision_sectionId_fkey` once the demo had a generated report: the hand-kept delete list missed tables. The delete now follows the database's foreign keys, children first, in one transaction; real-stack test creates a demo, generates a draft, deletes, recreates.
4. (Earlier the same day) the two-step sign-in routes returned 500 because they sit outside the authenticated scope; fixed with a regression test.

## Left in the test tenant

The WASH project's plan (6 planned activities, one done), a closed problem, a signed-off framework version, a three-step target schedule on IND-W-001 and IND-W-005 and a recorded value for IND-W-005, one indicator marked "counted by another project" (Education), a new demo project, and a recreated tour.

## Not verified / still open

- **Encryption at rest** is built and tested but off in production until the master key has a copy outside the host (`docs/runbooks/evidence-encryption.md`).
- Not clicked in the browser: Timeline dragging, My week offline, requests and reminders, milestones and dependencies, "Suggested from your plan", placing a project under a grant, the outside-partner invite (those need extra people or records), PDF download.
- The section "what changed" sentence needs a section with two versions.
