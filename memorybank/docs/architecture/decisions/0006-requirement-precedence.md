# ADR-0006: Reporting requirement precedence

**Status:** Accepted  
**Date:** 2026-08-19  
**Related:** PROFESSIONAL-REPORTING-IMPLEMENTATION-PLAN (Phase 5)

## Context

There is no universal donor standard. Reporting requirements differ per donor,
mechanism, report type, agreement/template version, and language, and two
awards from the same donor can have different deadlines, questions, annexes,
and approval rules. Requirements must therefore be modeled per award, never as
a broad label like "USAID" or "UN".

## Decision

Model requirements at `donor + mechanism + report type + agreement/template
version + language`:

- `ReportingRequirementPack`: versioned, typed reusable requirements keyed by
  a specific donor mechanism.
- `AwardReportingOverride`: award-specific differences with effective dates
  and a source document hash.
- `ResolvedReportingRequirements`: an immutable per-period snapshot plus the
  provenance trace of every resolved rule.

A deterministic `resolveRequirements` function merges layers in precedence
order: signed award/amendment → award reporting schedule/template → mechanism
rules → donor/report-type pack → organization profile → conservative baseline.
For each semantic `key`, the highest-precedence layer wins and lower layers
fill gaps; lower layers never silently override a higher layer. Every resolved
requirement records the `RequirementSourceReference` that supplied it.

## Consequences

- Award-specific requirements demonstrably win over donor defaults.
- Requirement/instruction version changes require human review and produce a
  new snapshot.
- The `REQUIREMENT_UNSATISFIED` gate consumes resolved coverage so approval
  and submission stay consistent.
