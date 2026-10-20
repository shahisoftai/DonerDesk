# Feature 26: Logframe versioning — the framework has a memory

**DonorDesk Version 2.006**

**Author:** Claude (agent) · **Date:** 2026-10-21
**Status:** Built, tested and deployed 2026-10-20 (batch 3, audit finding H-1). Browser check of the history page is pending. Builds on [Feature 06](06-Logframe-And-Indicator-Manager.md).

## 1. What a user gets

| In plain words | Where it shows |
|---|---|
| Every change to outputs, outcomes, indicators, targets and definitions is kept as a version | Logframe page → **Framework history** |
| Each version reads as a sentence: "Indicator IND-1: target changed from 100 to 120" | Framework history, newest first (15 shown, the rest counted) |
| A manager can **sign off** the framework as it stands ("the one the donor approved") | Framework history → **Sign off the framework as it is now** |
| An approved report records which framework version it was approved against | The report's audit trail (`report.approved`, `logframeVersion`, `logframeApproved`) |

Saving without a real change writes no version. The first version of an empty framework is not kept.

## 2. Rules that matter

- **Append-only, whole snapshots.** A version holds every item and indicator definition (targets, baselines, semantics, group targets, retired state) in one canonical JSON text. Two snapshots of the same framework are byte-identical, so a no-op save is detected by a content hash.
- **The change and its version are written by a decorator** (`withLogframeVersioning`, wired in `packages/infrastructure/src/container.ts`). The project is found *before* the call (a delete would remove the record it is found by). Versioning never fails the change: a failure is logged as `logframe.version_failed` and the change stands.
- **Reordering alone is not a change.** The diff compares titles, codes, parents, levels, definitions and retired state.
- **Sign-off needs project edit rights** (`project.edit`) and records who and when on the version. It captures the current framework first, so the signed version is what the framework is now.
- **Viewers can read the history** (`project.view`), not sign it off.

## 3. Where it lives

| Layer | Path |
|---|---|
| Domain | `packages/domain/src/contexts/logframe/logframe-snapshot.ts` (snapshot, canonical JSON, diff, sentence and title) |
| Application | `services/logframe-versioning.ts` (`LogframeVersioner`, `withLogframeVersioning`); `use-cases/logframe/logframe-version-handlers.ts` (list, changes, approve) |
| Infrastructure | `repositories/logframe-versions.ts`; table `LogframeVersion` (migration `20261021180000_logframe_versions`, forced RLS) |
| API | `GET /v1/projects/:projectId/logframe/versions`, `GET …/versions/:version/changes?from=`, `POST …/versions/approve` (`routes/logframe.ts`) |
| Web | `app/(portal)/projects/[id]/logframe/history/page.tsx`, `features/logframe/presentation/ApproveFrameworkButton.tsx`, `lib/actions/logframe-versions.ts` |

## 4. Limits

- The history shows what changed in the framework, not who typed each field (the audit trail has the actor of each save).
- Versions are not restored from the history page; a past target is set again by editing the indicator.
- Reports approved before this release have no version recorded on their approval.
