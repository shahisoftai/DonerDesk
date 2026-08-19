# ADR-0009: Donor-native rendering behind the export builder

**Status:** Accepted  
**Date:** 2026-08-19  
**Related:** PROFESSIONAL-REPORTING-IMPLEMENTATION-PLAN (Phase 8)

## Context

Exports produced a generic document approximation, not the donor's required
artifact. The `DONOR_TEMPLATE` export type existed but was placeholder-aware
only, and there was no binding between an approved template mapping and the
final artifact.

## Decision

Extend the existing `IExportBuilder` rather than adding a parallel export
workflow:

- `CreateExportHandler` accepts an explicit `exportIntent` and an optional
  `submissionSnapshotId`; `DONOR_SUBMISSION` requires a sealed snapshot, and
  internal previews are watermarked.
- The builder validates intent invariants itself (donor submissions are never
  watermarked and must reference a snapshot; internal previews must be
  watermarked).
- `DONOR_TEMPLATE` rendering stays worker-backed (`docxtpl` in Python
  workers); the TypeScript-side builder emits a placeholder-aware DOCX so the
  export pipeline and preflight continue to function, and the snapshot records
  renderer/template/mapping versions plus artifact hashes.

## Consequences

- Internal versus donor-submission exports are enforced on every path.
- The export builder is the single export workflow; no second export system.
- Real donor templates render behind the same interface with approved
  versioned mappings.
