# 68 — Simpler setup (Phase 58)

**DonerDesk Version 4.01.** Plan, batches and backlog: [`../imp/phase58-simpler-for-everyone.md`](../imp/phase58-simpler-for-everyone.md). Invariants: `AGENTS.md` → "Phase 58 invariants".

## What a user sees
- **Project wizard, Indicators slide:** *Use suggested settings for all (n)* fills the kind of number, which way is better and the owner for every card with a gap, each with a reason, never over a choice already made. An indicator sheet's **Type** and **Break down by** columns are read.
- **Project wizard, Work plan slide:** a sheet's **Repeats** column (Weekly / Monthly) is kept; the row says "Repeats every month until the project ends" and the launch plans every month.
- **Project wizard, Start slide:** several files in one read are allowed (100 s limit); a work-plan sheet is read as a sheet even though its lead emails are redacted (a lead is chosen on the slide, never read from a document).
- **Data → Forms:** *Delete this draft* for a form that was never published (a published form is closed, not deleted).
- **Settings → Setup:** "44 reportable of 55. 11 need a starting value." names what is missing.
- **Dashboards from a template:** the "Your dashboard is ready" note scrolls into view and its link is a button.

## Where it lives
Domain `suggestIndicatorSetup` (`contexts/project-setup/pcw/suggesters/indicator-defaults.ts`), web `suggestIndicatorSettings` (`features/project-setup/pcw/domain/results-view.ts`), `PlannedActivityDef.repeats` + `workPlanSheet` (Repeats column), `withoutLeadColumn` (`infrastructure/src/project-setup/sheet-readers.ts`), `DeleteDraftCollectionFormHandler`, `ProjectReadinessSnapshot.indicators.missing`, `UPLOAD_TIMEOUT_MS` (`apps/web/src/lib/actions/project-setup.ts`).

## Support articles
`how-to-create-a-project`, `how-to-collect-answers-with-a-form`, `how-to-import-your-plan`, `how-to-project-walkthrough`, `troubleshooting-project-setup` (timed out, repeats, "reportable of").

## Deploy
No migration, no env. Released 2026-11-16 (`20261116144334`, `20261116160744`, `20261116163416`); checked live on the demo tenant (suggestions applied to 52 of 55 indicators, a draft form deleted, five files read in one go, 22 repeating plan rows).
