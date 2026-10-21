# Feature 39: Evidence review and evidence filters

**DonorDesk Version 2.007** · **Shipped:** 2026-10-21, release `20261021075101` · **Audit:** EV-06, RP-06 (§17)

## 1. Evidence review

A reviewer's decision on a file, on the evidence page's Verification panel:

| Decision | From | Goes to | Reason needed | Refused when |
|---|---|---|---|---|
| Verify evidence | uploaded, AI-tagged, pending review, needs correction | Verified | no | — |
| Ask for a correction | uploaded, AI-tagged, pending review, verified | Needs correction | **yes** | — |
| Reject | open states, verified | Rejected | **yes** | an approved, exported or submitted report cites the file (named in the message) |
| Archive | open states, verified, rejected | Archived | no | same report check as reject |
| Bring back for review | rejected, archived | Pending review | no | — |

- The uploader sees the reviewer's reason on the file ("Reviewer: …"). Verifying or bringing back clears it.
- **Re-pointing a verified file** to another reporting period sends it back to pending review; it is not a silent edit.
- Every decision is audited with its reason (`evidence.<action>`).

Rules live in one table: `packages/domain/src/contexts/evidence/evidence-review.ts` (`checkEvidenceReview`). Handler `packages/application/src/use-cases/evidence/review-evidence.ts`; route `POST /v1/evidence/:id/review` (permission `evidence.verify`); panel `apps/web/src/features/evidence/presentation/EvidenceVerificationPanel.tsx`.

## 2. Evidence filters

The evidence library (across projects) and each project's evidence page filter by:

| Filter | Library | Project page |
|---|---|---|
| Search text | yes | yes |
| Project | yes | — (fixed) |
| Donor and country | yes (keeps files of matching projects) | — |
| Reporting period | — | yes |
| Collected in (where) | yes | yes |
| Verification, confidentiality, type | yes | yes |

Filters are kept in the link (`/evidence?donor=…`), so a filtered view can be shared. Projects also filter by donor and country on the project list.

Code: `apps/web/src/lib/shared/evidence-filters.ts`, `apps/web/src/features/evidence/presentation/EvidenceFilterBar.tsx`, `apps/web/src/app/(portal)/evidence/page.tsx`. Tests: `apps/web/tests/unit/evidence-filters.test.mts`, `project-portfolio.test.mts`.

## 3. Left over

- Donor and country filters on the library are applied after the search, so a very large library shows "the most recent 200" with the filter applied to those.
- No bulk review (verify many at once from the library); `bulk-verify` exists in the API only.
- Still absent (EV-06 remainder): the file's version history (EV-07), retention and deletion (EV-10).
