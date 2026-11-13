# 64 — Results framework and logframe: one set of results, two ways to read it

**DonorDesk Version 3.007 (Phase 52)**
**Status:** built and deployed 2026-11-13 (`20261113100000`, fixes `20261113130000`); checked in a signed-in browser on production (DEMO-15 read-only, plus a throwaway project, now archived).
**Plan:** `../imp/phase52-results-framework-and-logframe.md` (§12 is the build record). **Rules:** `AGENTS.md` → "Phase 52 invariants — one backbone, two lenses". Builds on [06](06-Logframe-And-Indicator-Manager.md) and [26](26-Logframe-Versioning.md).

## What a person gets

| Where | What |
|---|---|
| Logframe page | A switch: **Edit**, **Results framework** (the chain of results with why each leads to the next), **Logframe** (every level with indicators, baselines, targets, means of verification and assumptions). Both views download as Word or PDF. A gap is a dash, never 0. |
| Each result | **Why this leads to the result above it** and **Assumptions**, written when the result is added ("Logic") or with **Edit**; shown under the result in the tree. |
| Setup → Reporting profile | **Results framework wording**: DonorDesk, USAID, FCDO, European Union, United Nations or your own words. Used in the tree, headings, both views, downloads, the Entry sheet, the library picker, the Overview counts and the canvas results-chain block. |
| Framework history | Each version marked **Results or reasoning changed** and/or **Measurement changed**; the sign-off button names what changed since the last sign-off. |
| After sign-off | An indicator's code is fixed; a baseline or target an approved report used asks **Why are you changing this?** (kept in the history and audit). |
| Exports | An approved report's indicator table shows the targets of the framework in force when it was approved. |
| Problems and risks | **Which result does it affect?**; the list says "Affects: …". |
| Project wizard | Donor wording on the Start step (saved at launch); per-result logic on the Results slide; a non-blocking note for outcomes and outputs without reasoning; the library's suggested results arrive with a starting assumption. |
| Reports | A section named in the donor's own words ("Intermediate Result 2") shows only that result's indicators. |

## Where it lives

| Concern | Code |
|---|---|
| Wording | `packages/domain/src/contexts/logframe/framework-vocabulary.ts`; `ReportingProfile.vocabularyJson`; web `FrameworkVocabularyProvider` (`useLevelName`, `useDonorLevelWord`) |
| Lenses and files | `framework-lenses.ts` (`FRAMEWORK_LENSES`, `renderFramework`); `GetFrameworkDocumentHandler`; `infrastructure/src/exports/framework-document-files.ts`; routes `GET /v1/projects/:id/framework[/export]` |
| Logic on results | `LogframeItem.assumptions/rationale`; `UpdateLogframeItemHandler`, `PATCH /v1/logframe-items/:id`; import columns in `header-vocab.ts` |
| Change kinds and rules | `framework-change-classifier.ts`, `framework-change-rules.ts`, `FrameworkApprovalReader`, `LogframeVersion.changeKinds` |
| Approved-report pin | `framework-pin.ts` (`versionInForce`, `indicatorAsApproved`) in `CreateExportHandler` |
| Wizard | `SetupStart.wording`, `WordingStep`, `EDIT_NODE_LOGIC`, advisory requirement `results.reasoning`; library `data/assumptions.ts` |

## Not done
- Native review of the French, Spanish and Arabic wording; sector review of the 34 sectors' starting assumptions.
- Versions saved before 2026-11-13 carry no change kind (no chip on the history page).
