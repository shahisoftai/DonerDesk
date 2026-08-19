# ADR-0005: Report revisions and revision-bound assurance

**Status:** Accepted  
**Date:** 2026-08-19  
**Related:** PROFESSIONAL-REPORTING-IMPLEMENTATION-PLAN (Phase 1)

## Context

`ReportSection.content` was mutable in place and claims were not bound to a
specific content snapshot, so an edit could leave verification results that no
longer described the current text. Approval could bind to a section whose
content had already changed since verification.

## Decision

Introduce an explicit immutable `ReportRevision` aggregate:

- Every content mutation (generation, manual edit, rewrite, shorten, auto-fix,
  merge) goes through one application service (`IReportRevisionService`) that
  creates a new `UNASSESSED` revision and repoints the section at it.
- Each revision stores a SHA-256 `contentHash` of normalized content (computed
  by `IHashService` in infrastructure; the domain validates the digest).
- `ReportClaim` becomes revision-bound: claims record `revisionId`,
  `revisionHash`, character span, numeric atoms, and a structured
  `VerificationReasonCode`.
- Section approval requires the current revision to have `CURRENT` assurance.
- Assurance transitions (`UNASSESSED → ASSESSING → CURRENT | FAILED`,
  `CURRENT → STALE`) are enforced by the domain.

## Consequences

- Stale verification can no longer survive an edit.
- Rewrites create child generation runs with exact prompt/response hashes.
- Approval, readiness, preflight, and submission decisions all consume the same
  assurance state.
- Existing sections are backfilled to a baseline revision; assurance is only
  `CURRENT` when the content hash can be safely associated with the existing
  claim set.
