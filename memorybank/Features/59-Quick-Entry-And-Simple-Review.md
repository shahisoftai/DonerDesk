# Feature 59: Enter data, simple review and bring in data

**DonorDesk Version 3.007**

Built 2026-10-30 (Phase 36). Plan and decisions: [`../imp/phase36-easy-data-entry.md`](../imp/phase36-easy-data-entry.md). Not deployed.

## What a person gets

- **Enter data** (button on every project): choose an indicator, type the value and the day it is for. The page says which reporting period the day falls in before you save. After a save the next indicator is selected for you, with the same day.
- **A suggested running total** for an indicator that adds up, taken from the previous period's total; the result tells you what it used.
- **Offline**: with no connection the value is kept on the device and sent when the connection returns.
- **Simple review** (Setup, Reporting profile): for a small team, a saved value is handed in at once, and verified when you may verify and a file is attached. Off by default.
- **Overdue values on the project Overview** can be typed in the row.
- **Collect this with a form** (indicator page): drafts a collection form for an indicator that is a total of records; staff record each event and the total is worked out for each period.
- **Bring in data** (project, More tabs): paste the top of a table or open a CSV and be pointed at the right import.

## Rules

- One save path: the period-derived save is the ordinary create (all locks, the entry window and value checks apply).
- Simple review is decided by `reviewDecision`; autosave in the sheet never hands in.
- A notice is never a refusal: a missing file, a suggested total or a draft left behind are sentences, not errors.
- A date no period covers is explained and links to Reporting; it is never given to a neighbouring period.
- A calculated indicator cannot be typed into; a rate cannot get a generated form.

## Where it lives

Domain: `packages/domain/src/contexts/logframe/quick-entry.ts`, `contexts/collection/form-from-indicator.ts`. Application: `use-cases/logframe/quick-enter-indicator-value.ts`, `services/auto-review.ts`, `use-cases/setup/profile-preferences.ts` (`SetSimpleReviewHandler`), `use-cases/collection/collection-handlers.ts` (`CreateFormFromIndicatorHandler`). Web: `features/reporting/presentation/QuickEntryForm.tsx`, `features/reporting/domain/quick-entry-view.ts`, `features/projects/presentation/overview/InlineValueEntry.tsx`, `features/imports/`, `features/collection/presentation/CreateFormFromIndicatorButton.tsx`.

## Not built

Breakdowns inside Enter data (link to the sheet instead); translations of the new screens; an .xlsx reader in Bring in data.
