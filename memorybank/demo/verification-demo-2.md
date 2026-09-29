# Verification demo 2 — real EU Nutrition annual template, month-1 AI donor report (2026-09-28)

End-to-end verification that DonorDesk can take a **real, unmodified donor-supplied
DOCX** — `DonorDesk_EU_Nutrition_Annual_Report_Template.docx` (14 numbered sections,
sub-sections, an annual results-framework table, a suggested nutrition indicator
bank, an EU visibility/disclaimer section, and two structured annexes) — and turn
it into a fully-populated, section-numbered AI-generated month-1 report against a
brand-new EU-funded nutrition project, built from scratch through the real
production HTTP API on `donordesk.online` (tenant `mnpiracha@gmail.com`), never by
writing to the database directly.

Run against production, monitored live in a visible Chromium window (Playwright,
`headless: false`) logged into the tenant so progress could be watched in the UI
while the script ran. The API itself is loopback-only on the Contabo host
(`127.0.0.1:4001`, per `contabo-ops.md`), so the script and the template DOCX were
copied to the host over `ssh contabo` and executed there against the production
database — the same execution pattern as `verification-demo-1.md`, just triggered
from the server side because there is no public `/v1/*` proxy on `donordesk.online`
(the domain serves only the Next.js web app).

Reusable script: `scripts/demo-eu-nutrition.mjs`.

## What was built

**Project:** "Nutrition Resilience and Community-Based Nutrition Services"
(`EU-NUT-…`), Niger / Maradi region / Guidan Roumdji department, sector
`NUTRITION`, 12-month action, EUR 1,850,000 budget, monthly reporting,
project id `445e8a22-2b28-49f8-9c80-18bb82273e9d`.

**Logframe:** 1 goal → 2 outcomes (early identification/treatment of wasting;
improved IYCF practices) → 3 outputs (community screening/referral/treatment;
IYCF counselling; worker training and supervision) — matching the template's own
"Objectives, outcomes and outputs" table structure (§2.2).

**6 indicators**, chosen directly from the template's §3.1 "suggested nutrition
indicator bank" so the demo exercises every domain the template calls out:
unique people reached, children screened for wasting (MUAC/oedema), children
treated/referred, caregivers receiving IYCF counselling, workers trained and
assessed competent, and a treatment-quality indicator (Sphere recovery-rate
standard, ≥75%).

**Donor template:** the actual `.docx` file uploaded and parsed through
`POST /v1/templates/parse-file` (not pasted text, unlike pass 1 of
verification-demo-1), then created via `POST /v1/templates` with the parsed
text and `originalFileKey`. Extraction went through the **LLM path** (not the
heuristic fallback) and produced **41 sections**, correctly reconstructing the
template's numbering hierarchy (`1` … `14`, `2.1`–`2.3`, `4.1`–`4.3`,
`5.1`–`5.4`, `6.1`–`6.4`, `7.1`–`7.3`, `12.1`–`12.2`, `13.1`–`13.3`, plus
Annex A and Annex B). All 41 sections were accepted and the template reviewed
and approved (version 3).

**Month-1 data:** 6 verified indicator updates, 4 detailed activities (community
MUAC screening across 12 villages, OTP/SC admission and treatment at 6
facilities, mother-support-group IYCF sessions, a CMAM/IYCF refresher training),
each with participant sex breakdowns, challenges, lessons learned and next
steps; 6 verified evidence files (screening registers, admission registers,
attendance sheets, competency-assessment results, CMAM cohort-exit monitoring,
and a commodity/stock log) — deliberately covering every evidence type the
template's Annex A checklist asks for. A compliance-detection pass and a
readiness check were run before generation, matching the gates a real user
goes through.

**Report generation:** `POST /v1/reporting-periods/:id/generate-draft` produced
a draft with **38 sections** (one fewer than the 41 template sections — the
writer collapses/excludes non-generative rows) and ran the full section-wise
draft → critique → refine pipeline to completion (all 38 sections left
`NOT_STARTED`/`GENERATING`; final state: 35 `NEEDS_REVIEW`, 3 `DRAFTED`, **zero
unsupported/flagged claims across every section**). Generation of this
14-section, sub-sectioned annual template took roughly 25–30 minutes end to
end (38 sections × draft+critique+refine each), noticeably longer than the
8-section monthly template in verification-demo-1 — expected, given the
proportional section count, and not a sign of a stall (confirmed by polling
`/draft` directly rather than trusting the script's own capped poll loop,
which timed out at 60×3s=180s while generation was still legitimately running
server-side).

## What the generated content proves

- **Numbers are grounded, not invented.** The Executive Summary states exact
  seeded figures (1,840 people reached = 7.7% of the 24,000 target; 1,510
  screened = 8.4% of target; 168 treated = 7.6%; 612 IYCF = 6.8%; 38 trained =
  23.8%) and explicitly flags derived figures ("requires verification",
  "disaggregated data was not recorded") rather than fabricating
  disaggregation that wasn't seeded. Where a value genuinely can't be computed
  (the recovery-rate denominator), the writer says so instead of guessing.
- **Donor-template instructions extracted from the real DOCX reach the
  writer**, the core claim this whole demo series exists to verify — same as
  verification-demo-1, now proven with a second, structurally different real
  donor document. The Communication and EU Visibility section (§10)
  reproduces the template's own suggested EU disclaimer verbatim ("The
  contents of this publication are the sole responsibility of [implementing
  partner]…") **and** distinguishes it from the actual narrative wording used
  elsewhere in the report, while correctly reporting zero compliance evidence
  for a communication plan, URLs, reach figures or EU-emblem use that were
  never seeded — it does not invent a compliant-looking answer just because
  the section exists.
- **Safeguarding (§6.2)** correctly reports "no compliance conclusion" for a
  status that was never seeded, while still surfacing the one protection
  measure that genuinely exists in the data (the same-day referral pathway)
  and the real sex-disaggregation figures from the activity records — showing
  the writer distinguishes evidenced facts from absent ones at the level of
  individual claims within a single section, not just section-by-section.
- **Section hierarchy from Donor Template Manager v2 survives all the way to
  the generated report**: the draft's 38 sections carry the same numbering
  (`5.4`, `12.1`, `13.3`, `Annex A`, `Annex B`, …) the source DOCX uses,
  confirming `planHierarchy`/`ReportSection.level/numbering` (per
  `Features/05-Donor-Template-Manager-Plan.md`) round-trips correctly for a
  real, complex, deeply-nested donor document.

## Outstanding state (expected, not a bug)

- 252 compliance checklist items remain `OPEN` and all 38 sections sit at
  `NEEDS_REVIEW`/`DRAFTED` rather than `APPROVED` — this demo's scope was
  "generate the AI report," not the reviewer cleanup pass. `readiness.overall`
  is correspondingly low (0, driven by the `sectionsScore`/`approvalScore`/
  `checklistScore` weights all being 0 pre-approval) even though
  `indicatorsScore` and `evidenceScore` are both 100. A follow-up cleanup pass
  (same pattern as `scripts/cleanup-and-export-report.mjs` from
  verification-demo-1's pass 4) would resolve the open checklist items and
  section reviews and is the natural next step if a downloadable donor-ready
  export is wanted.

## Execution note: no Playwright/browser tool wired into this session

This Claude Code session has no MCP browser-automation tool registered, so a
locally-installed Playwright (found via `npm ls -g` — Chromium already cached
at `~/.cache/ms-playwright`, matched to version 1246 for the npx-cached
`@playwright/mcp`'s bundled Playwright build) was driven directly from a
one-off Node script (`chromium.launch({ headless: false })`) purely to (a) let
the user watch a real, visible browser log into `donordesk.online` and (b)
capture the `dd_session` cookie as a bearer token for the API script — the
actual data creation and report generation still went through the real HTTP
API on the Contabo host, exactly as in verification-demo-1, not through
browser UI automation.

## Ids for reference

| Item | Id |
|---|---|
| Project | `445e8a22-2b28-49f8-9c80-18bb82273e9d` |
| Donor template | `553d7e14-e918-49ef-bbb7-1c8645cfc665` |
| Reporting period (month 1) | `8e4ff5da-fbf6-48bc-b842-b7f6d2080590` |
| Draft | `8fb455ca-7948-4bf9-9e74-230286f6851e` |

Project: `https://donordesk.online/projects/445e8a22-2b28-49f8-9c80-18bb82273e9d`
Report: `https://donordesk.online/projects/445e8a22-2b28-49f8-9c80-18bb82273e9d/reports/8e4ff5da-fbf6-48bc-b842-b7f6d2080590`

## Script added

| Script | What it does |
|---|---|
| `demo-eu-nutrition.mjs` | 12-month EU nutrition project, real DOCX donor template upload+parse+extract, 6 indicators from the template's own indicator bank, month-1 activities/evidence/indicator data, generates the month-1 report. Takes `API_URL`/`TOKEN`/`TEMPLATE_PATH` as environment variables. |
