# ADR-0008: Immutable submission snapshots

**Status:** Accepted  
**Date:** 2026-08-19  
**Related:** PROFESSIONAL-REPORTING-IMPLEMENTATION-PLAN (Phase 7)

## Context

Internal working documents and authorized donor submissions are different
things, and direct API calls could bypass the preflight checks that the UI
showed. Without a frozen artifact boundary, an export could reference content
that changed after review, and there was no way to reproduce a final artifact.

## Decision

Introduce a `SubmissionSnapshot` as the immutable donor-submission boundary:

- A snapshot freezes the approved revision IDs and hashes, the resolved
  requirement snapshot and coverage, the assertion-verification manifest, the
  evidence/annex manifests with confidentiality decisions, approval records,
  authorized overrides, renderer version, and final artifact hashes.
- Creation requires: every section pointing at a `CURRENT`-assurance revision,
  sections approved, the aggregate gate passing, and resolved requirements
  with no unmet mandatory requirements.
- Every donor-facing export must reference a sealed snapshot
  (`exportIntent: "DONOR_SUBMISSION"`), enforced in the export builder itself.
  Internal previews are allowed without one but must be visibly watermarked.
- Snapshots are idempotently created, fully audited, and never mutated after
  sealing (artifact hashes can be appended until void).

## Consequences

- Unapproved donor submissions are impossible through any path.
- Direct API calls cannot bypass preflight.
- Final artifacts reproduce from the same snapshot.
- Internal previews are unmistakably marked.
