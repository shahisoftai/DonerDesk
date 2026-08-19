# ADR-0007: Verification composition and structured reason codes

**Status:** Accepted  
**Date:** 2026-08-19  
**Related:** PROFESSIONAL-REPORTING-IMPLEMENTATION-PLAN (Phases 2-4)

## Context

The previous verifier matched only the first number in a claim, counted
evidence sources instead of proving support, classified gate outcomes from
human-readable detail strings, and never required human review for causal
claims. A failed verification could not be distinguished from "not yet
checked".

## Decision

Compose narrow verification strategies behind the existing `IClaimVerifier`
facade (SOLID open/closed and single responsibility):

1. `IEvidenceIntegrityVerifier` — every cited source must still match the
   snapshotted evidence bytes (chunk exists, source text matches, hash
   matches, evidence verified, confidentiality authorized).
2. `NumericAssertionVerifier` — every numeric atom is bound to indicator,
   unit, period, and semantic role; matching one number never validates a
   sentence; domain decimal math only.
3. `DeterministicEntailmentVerifier` — cited chunks must actually support the
   assertion (`SUPPORTED | CONTRADICTED | INSUFFICIENT | UNCERTAIN`).
4. `CausalReviewPolicy` — causality is never auto-approved.

All outcomes carry structured `VerificationReasonCode` enums; human-readable
detail is presentation only. `gateKindForReason` maps reason codes to the
single gate policy so approval, readiness, preflight, and submission make
identical decisions. The `IAssertionExtractor` extracts assertions from final
content so an empty or incomplete writer `claims` array can never bypass
verification.

## Consequences

- Evidence count alone never proves support.
- Stale/mutated evidence and wrong unit/period/entity fail deterministically.
- Causal claims always require an authorized human decision.
- Gate logic no longer string-matches prose.
