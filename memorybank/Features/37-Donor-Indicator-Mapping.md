# Feature 37: Donor indicator mapping

**DonorDesk Version 2.007** · **Shipped:** 2026-10-21, release `20261021054800` · **Audit:** AI-04 (§16)

## 1. What a person gets

On a donor template's page, an "Indicators the donor asks for" panel lists each indicator requirement from the template and the project indicator that answers it.

| Status | Meaning | What the person does |
|---|---|---|
| Matched | The donor's text names the indicator's code, or someone confirmed it | Nothing, or "Undo" |
| Please confirm | The wording is close to one indicator's name | "Confirm this match" or choose another |
| No match yet | Nothing in the project fits | Choose an indicator, or "Will not be reported" |
| Will not be reported | The project decided not to report it | "Undo" |

Export preflight shows a non-blocking warning, `DONOR_INDICATORS_UNMAPPED`, when requirements are still matched only by suggestion or not at all.

## 2. Rules that matter

- **Automatic matches are not stored.** Only people's decisions are saved (`DonorIndicatorMapping`, one per template and requirement).
- **Code beats wording.** A code named as a whole token (`IND-W-001`, not `IND-W-0011`) matches; wording only suggests, and a suggestion needs at least 60% of the indicator name's meaningful words and a clear lead over the next best.
- **Two equally close indicators are never guessed between.**
- **"Will not be reported" is an answer, not a gap:** it does not raise the warning.
- **A decision that names a removed indicator is ignored** and the requirement is open again.
- **Nothing here changes an indicator or a value.** Every decision is audited (`template.indicator_mapping.set`).

## 3. Code map

| Layer | File |
|---|---|
| Matcher (pure) | `packages/domain/src/contexts/templates/donor-indicator-mapping.ts` |
| Handlers | `packages/application/src/use-cases/templates/donor-indicator-mapping.ts` |
| Port and repository | `packages/application/src/ports/donor-indicator-mapping.ts`, `packages/infrastructure/src/repositories/donor-indicator-mapping.ts` |
| Routes | `GET/PUT /v1/templates/:id/indicator-mapping[/:requirementId]` (`apps/api/src/routes/templates.ts`) |
| Panel | `apps/web/src/features/templates/presentation/DonorIndicatorMappingPanel.tsx` |
| Preflight warning | `packages/application/src/use-cases/exports/get-export-preflight.ts` |

Tests: `packages/domain/test/donor-indicator-mapping.test.mjs`, `packages/application/test/donor-indicator-mapping.test.mjs`.

## 4. Left over

- The writer is not told the mapping: a section still writes from the donor's wording, not from the mapped indicator's values (AI-04 remainder).
- No bulk confirm for many suggestions.
- Requirements come from the template's extracted list only; a requirement pack has no mapping screen.
