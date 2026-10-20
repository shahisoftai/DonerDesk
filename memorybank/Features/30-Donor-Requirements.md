# Feature 30: Donor requirements — what the report must contain, and what must be explained

**DonorDesk Version 2.006**

**Author:** Claude (agent) · **Date:** 2026-10-21
**Status:** Built, tested and deployed 2026-10-20 (batch 3, audit findings H-8, H-9, H-10). Browser check of the authoring page and the variance item pending. Builds on [Feature 05](05-Donor-Template-Manager.md), [Feature 12](12-Missing-Evidence-And-Compliance-Checklist.md) and [Feature 13](13-Review-And-Approval-Workflow.md).

## 1. What a user gets

| In plain words | Where it shows |
|---|---|
| **Required annexes** of a reviewed donor template must appear as a section of the report. A missing one blocks approval and says which one | Approval gate, readiness, and the report's requirement list |
| **Requirement packs**: an administrator lists what a donor requires of a report, one line each, and activates the pack | Settings → **Donor requirements** (`/settings/requirement-packs`) |
| **Donor-required tables** that are missing their columns are named as a warning in the drafted section | Report section, as a warning (not a blocker) |
| **A result far from its target must be explained.** On the closing report, an indicator more than 20% unfavourably off its target raises a checklist item until the story explains it | Compliance checklist → "Result to explain"; cleared by filling "Why were important targets over or under achieved?" in *Tell the story* |

## 2. Rules that matter

- **Annexes block; tables warn.** A required annex is a section a person can write, so it blocks. A donor table is built deterministically from verified figures, so a retry cannot add a table; the warning tells the reviewer which one is still missing.
- **Only required, named annexes** from the pinned template become requirements. Compliance statements and indicator wording stay checklist items, because they cannot be matched to a section by title and would block with nothing a person could do.
- **A requirement pack** is written as lines: `SECTION: Executive summary`, `ANNEX: Indicator table`, `QUESTION: Safeguarding statement`. A trailing `?` makes a line advisory. Blank lines and lines starting with `#` are ignored. A bad line is named by number; the good lines still count.
- **Only administrators** (`template.edit`) write and activate packs.
- **Variance** applies to the closing report only (earlier reports have no phased target to miss), to indicators that are not rates and have a resolved direction, and only when both a life-of-project value and a target exist. Exactly 20% short is within tolerance.
- **A missing value is never a miss.** An indicator with no figure is not judged.

## 3. Where it lives

| Layer | Path |
|---|---|
| Domain | `contexts/reporting/template-requirement-layer.ts` (annex → requirement), `pack-authoring.ts` (line reader), `variance.ts` (`offTargetFindings`); `contexts/compliance/checklist-state-rules.ts` (`VARIANCE_UNEXPLAINED`) |
| Application | `services/report-type-checklist.ts` (`varianceItems`), `use-cases/compliance/detect-missing-evidence.ts`, `use-cases/reporting/requirement-pack-handlers.ts` (`ListRequirementPacksHandler`) |
| Infrastructure | `llm/requirement-resolver.ts` (TEMPLATE layer), `llm/ai-reporter-draft-generator.ts` (table options), `ai/artifact-validators.ts`, `apps/workers/app/ai_reporter/artifact_validators.py` (`assert_required_tables_present`, `missing_required_tables`) |
| API | `GET /v1/reporting-requirement-packs` (`routes/reporting.ts`) |
| Web | `app/(portal)/settings/requirement-packs/page.tsx`, `features/requirement-packs/presentation/RequirementPackManager.tsx`, `lib/actions/requirement-packs.ts` |

## 4. Limits

- Donor indicator requirements are not yet mapped to the project's indicators (AI-04 open).
- Requirement packs have no review step beyond activation.
- The variance threshold is fixed at 20% for every indicator.
