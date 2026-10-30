# Phase 36: easier data entry and compilation

**DonorDesk Version 3.007**

**Status:** built, tested and deployed to production on 2026-10-30 (`releaseId=20261030110007`, commit `4726a4ac`, branch `0015-compitition`). Verified on the host (routes 401 unauthenticated, `/ready` 200, no error logs). **Not yet tried in a signed-in browser or in the usability test below.**

## Why

Entering a value against an indicator meant knowing that values live in a **reporting period**: Reports, then the period, then Indicators, then a grid or sheet, then Save, then "Submit for review", then a reviewer verifies. DevResults and ActivityInfo give one obvious place to type and compile the totals for you. Eight changes were agreed to close that gap; this record says what each became, what was deliberately not done, and how to check that it helped.

## What was built, change by change

| # | Change | Where it lives | Notes |
|---|---|---|---|
| 1 | **Enter data**: one indicator, one value, one day | page `/projects/:id/enter`; header button on every project; "Enter a value" on the indicator page; `QuickEnterIndicatorValueHandler`, `POST /v1/indicator-updates/quick`; `quick-entry.ts` (domain) | The period is derived from the day (`periodForDate`), shown before saving, and never assigned to a neighbour. The running total is suggested for a summing indicator only (`suggestRunningTotal`), otherwise left empty. The save goes through the ordinary `CreateIndicatorUpdateHandler`, so locks, the entry window, value checks and breakdown checks all still apply. No connection: the value waits in the existing `indicator-values` outbox. |
| 2 | **Entry Sheet as the one entry screen** | no change needed | The sheet was already the default on a wide screen. The form view stays: it is what a narrow screen uses and it carries the breakdown dialogs. Nothing was retired. |
| 3 | **Simple review** (project setting) | `ReportingProfile.simpleReview`, Setup, Reporting profile, "Hand values in as soon as they are saved"; `SetSimpleReviewHandler`; `AutoReviewService` | Off by default. See the rules below. |
| 4 | **Enter small, compile automatically** | indicator page, "Collect this with a form"; `formFromIndicator` (domain), `CreateFormFromIndicatorHandler`, `POST /v1/indicators/:id/collection-form` | Drafts a collection form (date, number, where, note) mapped as SUM by its date. Only an indicator whose period value is a sum of records gets one; a rate, ratio, latest reading or calculated value is refused with the reason. The form is a DRAFT: a person reviews it and publishes it. |
| 5 | **Enter where the work is listed** | project Overview, "Needs you", overdue values; `InlineValueEntry`, `needsYouItems` | Up to five overdue values can be typed in the row. Same quick-entry save with the period named. Only for people holding `indicator.update`. |
| 6 | **Warnings instead of blocks** (where the product's own rules allow) | quick entry and Save under simple review | A missing file, a suggested running total and a value left as a draft are **notices**, never refusals. The entry window and period locks are deliberate controls and still refuse. |
| 7 | **Bring in data**: one place to start any import | page `/projects/:id/import`; `import-guide.ts` | Paste the first rows or open a CSV/TSV and the screens that could read it are suggested, with the matched header words. It only points: each import keeps its own checks. |
| 8 | **Measure it** | audit event `logframe.indicator.quick_entered`; protocol below | Counts adoption. The usability protocol is the real measure. |

## Simple review: the exact rules

`reviewDecision` (domain, `contexts/logframe/quick-entry.ts`) is the one place that decides.

- **Full workflow (default):** nothing happens by itself. A save is a draft.
- **Simple review on:** a saved value that holds a figure (or is marked not applicable) is **handed in** at once. It is also **verified** only when the person saving holds `indicator.verify` **and** a file is attached behind the value. Otherwise it stays SUBMITTED and the person is told why in one sentence.
- A value already handed in is not submitted twice; a verified value is never moved.
- **Autosave never hands in.** The Entry Sheet's autosave keeps drafts exactly as before (an existing invariant). Only the explicit **Save** (`handIn: true` on the bulk save) hands values in, and the button reads "Save and hand in" when the setting is on.
- Same transitions and same audit events as the manual steps (`logframe.indicator.submitted` / `.verified`); only the system note says "automatically (simple review)". Evidence-required projects are covered because verification needs a file anyway.

## Deliberately not done

- **Retiring the form view** of the indicator grid (change 2): it is still the narrow-screen view and holds the breakdown editor.
- **Breakdown entry in Enter data.** A required breakdown is flagged with a link to the period's sheet; the total can be saved now. Adding a breakdown dialog here would be a second implementation of `DisaggregationEditor`.
- **Making the entry window a warning.** It is a manager's explicit control; reviewers are already exempt.
- **"Entering by place rows"** as a new input. Place is a question on the generated form (a PLACE field), which feeds results by place. No new grid.
- **Detecting an .xlsx's contents in Bring in data.** Only the first rows of a text file can be read in the browser without adding a parser; an Excel file is directed to "choose from the list".
- **Translations.** The new screens are English only (like the finance screens); the catalogue keys are not added.

## Rules for future changes

- A new way to save one value goes through `CreateIndicatorUpdateHandler` (or the bulk handler). Do not write a third path.
- The review step after a save is `AutoReviewService.afterSave`; add a rule to `reviewDecision`, do not branch in a handler.
- A new "enter it here" surface calls `quickEnterValueAction`; it names the period if it knows it.
- `needsYouItems` parses `INDICATOR_VALUE:<indicatorId>:<periodId>` keys with `parseValueKey`; change the key and that function together.

## Deploy

1. Migration `20261101090000_simple_review` (additive: `ReportingProfile.simpleReview BOOLEAN NOT NULL DEFAULT false`), applied with `prisma migrate deploy` as `DATABASE_ADMIN_URL` **before** the code, after a fresh backup.
2. `/ready` requires `ReportingProfile.simpleReview` (added to `REQUIRED_PRISMA_FIELDS`).
3. Ship api and web together (`SCOPE=both`). No env, no RLS change (no new table).
4. New routes, all in `RULES`: `POST /v1/indicator-updates/quick` (`indicator.update`, also on the partner allow-list), `PUT /v1/projects/:id/simple-review` (`project.edit`), `POST /v1/indicators/:id/collection-form` (`project.edit`).

## How to check it helped (change 8)

Not a dashboard: a short test with real people, before and after.

1. Pick two people who did not build this: a **field officer** and an **M&E officer**. Give each a project with three indicators and one open period.
2. Task: "Record 40 for indicator A for 12 March, then confirm it is in the report." No help, no hints. Time them.
3. Write down where they stop: (a) can they find the entry point, (b) do they understand which period it went into, (c) do they know whether the value counts yet.
4. Repeat with simple review **on** and **off** for the same person on different projects.
5. Target to beat: first value saved in under 90 seconds without help, and "yes, it counts / it is waiting for X" answered correctly.
6. Adoption, from the audit trail: `logframe.indicator.quick_entered` events per week against `logframe.indicator.updated` events from the sheet.

## Tests

- Domain: `packages/domain/test/quick-entry.test.mjs` (11), `form-from-indicator.test.mjs` (4).
- Application: `packages/application/test/quick-entry.test.mjs` (7).
- Web: `apps/web/tests/unit/quick-entry-view.test.mts` (7), `import-guide.test.mts` (7), plus two cases in `overview-derive.test.mts`.
- Not run: a signed-in browser pass; the four API tests that need database access (see below).
- The API suite had 4 failures on the machine used to build this, all "User `test` was denied access on the database `donordesk.public`" (the local Postgres on 5432 rejects the test user). They are environmental, not from this change; `authorization-coverage.test.mjs` (which this change touches) passes.
