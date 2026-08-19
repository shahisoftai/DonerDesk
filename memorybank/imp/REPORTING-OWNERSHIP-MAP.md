# Professional Reporting — Component Ownership Map

**Date:** 2026-08-19  
**Status:** IMPLEMENTED (with PROFESSIONAL-REPORTING-IMPLEMENTATION-PLAN Phases 1-9)

Every concept in the plan extends an existing owner. No second claim, checklist,
readiness, audit, cost, export, or job system was introduced.

## Ownership map

| Concern | Single source of truth | Extension implemented |
|---|---|---|
| Indicator mathematics | `computeIndicator` / `IIndicatorAnalyticsService` (`services/indicator-analytics-service.ts`) | Unchanged — findings feed the numeric verifier |
| Report structure | `ReportPlan` | Unchanged; requirement coverage keys match plan section titles |
| Evidence chunks | `EvidencePackageBuilder` (`ai/evidence-package-builder.ts`) | Consumed by `IEvidenceIntegrityVerifier` for exact chunk/hash validation |
| Claims/assertions | `ReportClaim` (domain) | Evolved into revision-bound assertions: `revisionId`, `revisionHash`, `charStart/charEnd`, `numericAtoms`, `verificationReasonCode`, `assertionType`, `materiality` |
| Revision integrity | `ReportRevision` (new domain aggregate + `PrismaReportRevisionRepository`) | Single mutation pipeline via `IReportRevisionService` |
| Verification policy | `IClaimVerifier` + `gate-rules.ts` | Composed strategies: `DeterministicClaimVerifier` orchestrates integrity, numeric atoms, entailment, causal policy; `VerificationReasonCode` enums replace prose gate matching |
| Assertion extraction | `IAssertionExtractor` → `DeterministicAssertionExtractor` | Re-extracts from final content; reconciles writer claims by fingerprint |
| Compliance exceptions | `ChecklistItem` | Unchanged — `REQUIREMENT_UNSATISFIED` projects into the gate |
| Readiness | existing readiness composition | Unchanged |
| Template mapping | `DonorTemplateMapping` | Unchanged (identity keys used by requirement packs) |
| Generation audit | `ReportGenerationRun` + `LlmRun` | Extended snapshot with `parentRunId`, `sectionId`, `promptHash`, `responseHash` for child rewrite runs |
| Approval | section/report handlers | Approval now requires `CURRENT` revision assurance and revision-hash binding |
| Export | `IExportBuilder` / `CreateExportHandler` | Added `exportIntent`, `submissionSnapshotId`, watermark enforcement |
| Cost | usage ledger + `LlmRun` | Unchanged — same ledger for all AI calls |
| Workflow | application handlers + Kestra | No parallel BullMQ report workflow |
| Requirements | `ReportingRequirementPack`, `AwardReportingOverride`, `ResolvedReportingRequirements` (new) | Deterministic precedence resolver (`resolveRequirements`), per-period immutable snapshots |
| Submission | `SubmissionSnapshot` (new) | Sealed before donor-native rendering; exports reference it |

## New ports (all narrow, behind existing facades)

`IReportRevisionRepository`, `IReportRevisionService`, `IReportAssuranceService`,
`IAssertionExtractor`, `IEvidenceIntegrityVerifier`, `IEntailmentVerifier`,
`ICausalReviewPolicy`, `IRequirementResolver`, `IRequirementPackRepository`,
`IAwardOverrideRepository`, `IResolvedRequirementsRepository`,
`ISubmissionSnapshotRepository`, `IHashService`.

No port exposes Prisma rows, provider response types, or document-library
objects.
