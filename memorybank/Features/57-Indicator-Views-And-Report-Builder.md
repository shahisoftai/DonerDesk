# Feature 57: Indicator views and the saved report builder

**DonorDesk Version 3.007 (Phase 34.5)**
**Status:** built, tested and deployed 2026-10-28 (migration `20261030120000_saved_reports`; the group split rides on the data sheet and needs none). Harness: `pnpm --filter @donordesk/web test:report-builder` (7 checks). Not yet tried by a person in the signed-in app.
**Rules:** `AGENTS.md` → "Phase 34 saved reports" and "Breakdown in reports".

## What a person gets

- **Views of an indicator**, on the indicator's page: **against target**, **over time**, **by place**, **by group** (a pie of the recorded split) and **table**. Each is an ordinary chart specification, so "Open the Chart Studio" refines it. A view that the data cannot support says why in a sentence.
- **The report builder** at `/projects/:id/report-builder`: ask for results across indicators as one sentence — *Showing results for [indicators] from [period] to [period]; display [value for each period | cumulative to date | percent of target] by [indicator, broken down by period | period, broken down by indicator | indicator, broken down by group]* — and **Run report**. The sentence reads back your choices.
- **Broken down by group**: sex, age group, disability, location or other group. The groups run across the columns for the last period in the range, with the **recorded total** beside them (never a sum of the groups).
- The result is a table with "Not measured" for a gap (a real 0 stays 0); notes say how many figures are not verified yet. **Download CSV** (gaps stay empty; a leading `=`, `+`, `-` or `@` is defused).
- **Keep** a report for yourself or share it with the project (sharing needs `project.edit`). A saved report stores the question, never the figures; opening it runs it again.
- **Add a report to a dashboard** as a table; the dashboard runs the question each time it opens.
- Labels in English, French, Spanish and Arabic.

## Rules

- Nothing is added across indicators (units differ, rates cannot be combined); percent of target leaves a rate out.
- A pie is drawn only when the parts add up: a count or an amount, at least two groups, none at zero; a rate is refused with a sentence.
- A breakdown needs the period value measure and indicators as rows (`validateReportQuery`).
- A report keeps the scope and project it was made with; a save over someone else's change is refused.

## Not built

Linked forms (joining collection data on a common field); subtotal rows and grouping by logframe level; a place breakdown (use the Data Center "By place" tab or the Maps screen); a separate Documents tab (the indicator page already lists the evidence behind it); the notes written under a report are still English only.
