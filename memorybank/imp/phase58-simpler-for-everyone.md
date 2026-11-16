# Phase 58 — simpler for every level of user (2026-11-16, branch `0025-place-tree`)

**Why.** Building the Pakistan KP CMAM demo (`scripts/demo-pak-kp-cmam/`, `memorybank/demo/verification-demo-17.md`) as a user showed where the product asks for what it could work out, says "Done" without showing the result, or hides the reason behind a number. This phase fixes the ones that are small, safe and testable now, and records the rest as the backlog.

**Rules kept.** A suggestion carries its reason and never overwrites a choice a person made. A missing value is never 0. One rule per decision (a domain function, not a copy in a component). Additive only: no migration, no env.

## Batches

| Batch | What | Status |
|---|---|---|
| 58.1 Smart defaults | `suggestIndicatorSetup` (domain, pure): the kind of number from the unit/target, which way is better from the words of the title (deaths, defaulting, stock-outs = lower; screened, received, functional = higher; unknown = nothing), each with a reason. The sheet reader keeps a **Type** column and a **Break down by** column and infers the type from a plain numeric target. Wizard slide 4 gets **Use suggested settings for all (n)**: fills only empty type / direction / owner (the single M&E officer), never over a choice (`suggestIndicatorSettings`). Four languages. | built, tested |
| 58.2 Done means done | The template apply note ("Your dashboard is ready. Open it") scrolls into view and is a button (it used to sit below a very long page, so people clicked Create again). | built |
| 58.3 Drafts can go | `DELETE /v1/collection-forms/:id` (`DeleteDraftCollectionFormHandler`, `project.edit`, audited `collection.form.deleted`, conditional on DRAFT in the repository); **Delete this draft** on a draft form. A published form can only be closed (it keeps its records). | built, tested |
| 58.5 Say why | Setup's "44 reportable of 55" now says why: `ProjectReadinessSnapshot.indicators.missing` (baseline / target / unit / frequency counts) and the sentence "11 need a starting value." | built, tested |
| 58.7 Plan repeats | A work-plan sheet's **Repeats** column (Weekly / Monthly) is carried: `PlannedActivityDef.repeats` (domain + contract), set by the sheet reader, written back as the Repeats column of `workPlanSheet`, so the launch's `ImportWorkPlanHandler` plans every month to the project end. The plan slide shows "Repeats every month until the project ends". Four languages. | built, tested. **Found live:** the sheet reached the reader with lead emails redacted, so the importer refused every row ("lead must be an email address") and the model read the plan instead, without Repeats; `withoutLeadColumn` blanks the lead column before parsing (a lead is never read from a document) |
| 58.8 Five files | A start with several files has a 100 s gateway limit (`UPLOAD_TIMEOUT_MS`) instead of the shared 15 s; each file is staged to Drive in turn (4-8 s each). | built |
| 58.6 Docs and support | Plan, AGENTS.md invariants, feature doc, support articles (create a project, collect answers with a form, project walkthrough), demo 17 record. | done |

## Not built (decided, with reasons)

1. ~~Monthly repeats~~ and ~~five-file timeout~~: built (58.7, 58.8). Still open: a person cannot yet set or remove a repeat on a plan row in the wizard (only a sheet gives it), and staging the files in parallel with progress would cut the wait.
2. **Read honesty report** ("Read 24 results, 55 indicators; not found: owners, direction") and **adding files after the first read**: needs the read run to return per-field coverage and the Start slide to keep its uploader. Batch 58.13.
4. **Places**: asking "district or sub-area?" the first time a word is ambiguous, and treating "Khyber Pakhtunkhwa" and the boundary's "K.P." as one place, change the places resolver and the merge rules. Batch 58.9.
5. **Forms**: computed totals (boys + girls = total) and ready-made sector forms need a new field kind and a form library. Batch 58.10. Editing a published form with versions: 58.11.
6. **Dashboards**: a dashboard made at launch or from a template that has never been opened is not listed under Your designs or Older dashboards (only the opened one is). Needs a look at `/v1/dashboards` listing; Batch 58.12.
7. **Role-based screens** (field officer sees only today's work) and **simple wizard mode** (four slides): product decisions first, then a batch each.
8. **Plain-language labels** (recorded by place, calculation confirmed, entry window): a wording pass across four languages with native review; not done here.

## Verification

Domain `indicator-defaults.test.mjs` (5), infrastructure `indicator-sheet-defaults.test.mjs` (2), web `pcw-results-view.test.mts` (+3), application `collection-handlers.test.mjs` (+1) and `feature18-setup.test.mjs` (+1), API `authorization-coverage.test.mjs`. Deploy: `SCOPE=both` (domain, infrastructure and api changed with the web). Browser check on production after the deploy: see the record at the end of `verification-demo-17.md`.
