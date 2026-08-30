# Product Recovery Plan — Implementation Record

**Date:** 2026-08-30
**Status:** IMPLEMENTED (P0 + P1) and DEPLOYED — release `20260829160000` on Contabo
**Audit basis:** end-to-end realistic user audit of donordesk.online (Programme
Manager / MEAL / Reporting Officer persona) across
Logframe → Indicators → Activities → Data → Evidence → Compliance → AI Report →
Review → Approval, plus code-traced root-cause reconciliation.

---

## 1. Executive diagnosis (verified in code)

The core architecture was sound; the failure was entirely at the boundary
between **AI writing**, **deterministic verification**, and **human review**:

1. **The AI writer and the verifier were incompatible by construction.**
   The narrator prompt (`packages/infrastructure/src/llm/llm-report-draft-generator.ts`)
   instructed "describe each indicator by its name and code" and "describe
   progress against the target", both of which produced prose the deterministic
   assertion extractor/verifier rejects. The system prompt's own worked example
   demonstrated the exact pattern that fails verification ("reached 85% of its
   target of 1,000").
2. **The number extractor mis-parsed normal English.**
   `extractNumericAtoms` (`packages/domain/src/contexts/reporting/numeric-atom.ts`)
   used `/-?\d+(?:\.\d+)?/g`. "3,251 children" became atoms `3, 251, 4, 215`;
   "(OUT-1)" became atom `-1` (hyphen + digit); "at 6 months" became atom `6`.
   Every extra atom fails binding, so entire sentences failed with
   `VALUE_MISMATCH`.
3. **Percentage findings were unverifiable as entered.**
   `indicator-calculator.ts` computes PERCENTAGE/RATIO indicators as `0` with
   `MISSING_DENOMINATOR`/`NEEDS_REVIEW` unless a denominator indicator is linked.
   A user entering "78%" in the grid got a finding of `0`; no claim about it
   could ever verify, and nothing warned the user at data-entry time.
4. **One failed assertion → one HIGH checklist item.**
   `report-assurance-service.ts` projected every failed material claim and
   `checklist-projector.ts` created a HIGH `UNSUPPORTED_REPORT_CLAIM` item per
   fingerprint — 400–500 items from a single draft when the writer/verifier
   mismatched.
5. **Editing a report recreated resolved issues.**
   Every edit/regenerate ran `deleteBySection` then recreated claims fresh
   (`report-assurance-service.ts`), and `checklist-projector.ts` deduped only
   against OPEN/IN_PROGRESS items — so an accepted/resolved item was recreated
   whenever the same failing sentence reappeared.
6. **Approval blockers were invisible.**
   `canApproveAssurance` allows only CURRENT revision state; the workspace
   surfaced block reasons as a single generic error line, and the only way to
   reassess was to edit (which wiped claim resolutions).
7. **Claim resolution was buried in the export wizard.**
   `report.resolve-claim` actions existed only in `features/exports/ExportWizard.tsx`
   preflight; the report review flow had no per-claim Accept/Exclude actions.
8. **Draft clutter.** `generate-report-draft.ts` created a brand-new draft on
   every regeneration with no supersede/cleanup — one period accumulated 9 drafts.
9. **Evidence-period linkage was invisible and scored unfairly.**
   Readiness's "Evidence" score counted only `EvidenceFile.reportingPeriodId`
   (`calculate-readiness.ts`), with no UI to tag evidence to a period, so the
   score could be 0% even when evidence existed and supported the report.
10. **Stub fallback was silent.**
    Per-section deterministic fallback was written only to audit logs; users saw
    no per-section "drafted without AI" indicator.

**Conclusion:** no architecture rebuild was required. The recovery was a set of
contained fixes: parser corrections, writer-prompt alignment, checklist
deduplication, human-readable verification detail, workspace claim resolution,
actionable approval blockers, draft lifecycle management, evidence-period
tagging, and a tolerant-but-honest verifier. No STORM/LangGraph/agents/RAG
changes were introduced beyond what already existed.

---

## 2. Implemented changes (P0 + P1)

### P0-1a — Numeric parser fixed (`packages/domain/src/contexts/reporting/numeric-atom.ts`)
- `extractNumericAtoms` now:
  - normalizes thousands separators ("3,251" → one atom `3251`; "1,234,567.89" → `1234567.89`),
  - ignores digits embedded in words/codes/identifiers (`OUT-1`, `OUT1`, `Stage-2` — no spurious `-1`),
  - treats a leading `-` only as a sign at token boundaries (standalone negatives still parse),
  - rejects ambiguous tokens ("12,5") rather than misreading them.
- Tests: `packages/domain/test/professional-reporting.test.mjs` (thousands,
  embedded-digit, negative-sign, ambiguous-token cases).

### P0-1b — Writer prompt aligned (temporary, factual-accuracy rules)
(`packages/infrastructure/src/llm/llm-report-draft-generator.ts`)
- Fixed the system prompt's worked example (it taught the exact pattern the
  verifier rejects).
- Added "Number discipline (mandatory)" instruction tail: quote every figure
  exactly as given in the Verified Findings; never compute/derive/round a number;
  never quote target/baseline figures as numbers; no incidental numbers (dates,
  years, time spans); NEVER substitute `periodAchievement` when a finding is
  NOT_CALCULABLE/MISSING_DENOMINATOR.
- These are factual-accuracy rules, not style rules (commas, indicator codes,
  and combined sentences remain allowed after the parser fix).

### P0-2 — Checklist projector idempotent (`packages/infrastructure/src/llm/checklist-projector.ts`)
- Dedup now spans **all** `UNSUPPORTED_REPORT_CLAIM` items ever created for the
  period (open or resolved), so accepting a claim is a permanent decision and
  edits/regenerations never recreate resolved items.
- Test: `packages/infrastructure/test/professional-reporting-gaps.test.mjs`
  ("never recreates an item the user resolved").

### P0-3 — Human-readable verification failures (`packages/infrastructure/src/llm/verifier-strategies.ts`)
- `describeAtomFailure` produces plain-language detail with expected/actual
  context, e.g. "78% could not be verified because the percentage could not be
  calculated: the denominator was not recorded (OUT-7, OUT-9)".
- Mismatch explanations are per-atom (period/unit/entity/needs-review).
- Tests: denominator explanation + unmatched-value plain-language cases.

### P0-4 — Actionable approval blockers
(`packages/application/src/use-cases/reporting/approve-report-section.ts`,
`approve-report.ts`, `apps/web/.../ReportWorkspace.tsx`)
- Gate messages are remedy-oriented and human-language (no
  CURRENT/FAILED/STALE/UNASSESSED vocabulary in the UI).
- The workspace renders the section-approval failure inline under the Approve
  button with a clear path to the fix.

### P0-5 — Claim resolution in the workspace
(`apps/web/src/features/reporting/presentation/ClaimResolutionActions.tsx`,
`ReportWorkspace.tsx`)
- Per-failed-statement **Accept with note** (ACCEPTED_WITH_LIMITATION) and
  **Exclude** (EXCLUDED) inline actions in the workspace claim list, reusing the
  existing resolve endpoint + `report.resolve-claim` capability checks. Resolved
  claims display their note. No new endpoints.

### P0-6 — One working draft per period
(`packages/domain/src/contexts/reporting/report-draft.ts`,
`packages/application/src/use-cases/reporting/generate-report-draft.ts`,
`get-report-draft.ts`, `activate-report-draft.ts`, `PrismaReportingPeriodRepository`)
- New additive column `ReportDraft.supersededAt` (migration
  `20260829140000_report_draft_superseded`) + `ReportDraft_supersededAt_idx`.
- Domain `supersede()` / `activate()`; generation supersedes prior working
  drafts; `get-report-draft` surfaces only the active draft.
- **Versions archive UI** (`DraftVersionsPanel.tsx`): lists superseded drafts
  with status/dates and a "Make current" restore action
  (`POST /v1/report-drafts/:id/activate`).
- `findByReportingPeriod` orders superseded last so all existing `[0]` consumers
  keep returning the current draft.

### P0-7 — Evidence readiness fixed + period tagging
(`packages/application/src/use-cases/compliance/calculate-readiness.ts`,
`use-cases/evidence/set-evidence-period.ts`, `EvidencePeriodPicker.tsx`)
- The "Evidence" readiness score now counts the **union** of evidence tagged to
  the period + evidence attached to its indicator updates + its activity updates
  — the same set the generation run consumes.
- New endpoint `POST /v1/evidence/:id/period` + inline "Reporting period"
  selector in the evidence library (server-rendered page + client picker).
  Cross-project period assignment is rejected.

### P0-8 — Fallback surfaced + generation ETA/cancel
(`get-report-draft.ts`, `ReportWorkspace.tsx`,
`use-cases/reporting/cancel-report-generation.ts`)
- Per-section `generatedWithAi` (derived from the current revision's `modelId`);
  workspace shows a "drafted without AI — review carefully" banner for
  stub/manual content.
- Generation button shows a live ETA while drafting.
- **Stop generation** button → `POST /v1/reporting-periods/:id/cancel-generation`
  supersedes the working draft; the background loop checks the superseded flag
  between sections and stops. Approved/exported/submitted drafts return
  `{cancelled:false}` instead of erroring.

### P0-9 — Data-entry guard for denominator-less percentages
(`list-period-indicators.ts`, `IndicatorEntryGrid.tsx`)
- The indicator grid warns on PERCENTAGE/RATIO indicators without a configured
  denominator indicator that their result cannot be independently verified in
  the report.

### P1-1 — Tolerant verifier (natural professional prose)
(`packages/infrastructure/src/llm/verifier-strategies.ts`)
- **Target/baseline reference atoms**: once a sentence binds a real value, a
  co-occurring target/baseline figure ("8 learning centres, reaching 6.67% of
  the 120-centre target") is tolerated as a reference — but ONLY alongside a
  matched value (a bare "0" never passes against a finding of 1).
- **Derived percentages**: value/target and value/baseline derivations accept
  both 1- and 2-decimal rounding ("6.7%" and "6.67%" both match 8/120).
- Combined indicators in one sentence verify naturally (each atom binds).
- Tests: natural-prose corpus (derived percent + target, combined indicators)
  + negative guards (bare target figure, contradictory baseline).

### P1-2 — Prompt relaxed now that the verifier is tolerant
(`llm-report-draft-generator.ts`)
- Derived percentages and target figures are allowed again ("reached 6.67% of
  its 120-centre target"); restored the natural worked example.
- Kept as permanent rules: never invent/round numbers, no incidental numbers,
  NOT_CALCULABLE findings get no number.

### P1-3 — Core UX recovery (`ReportWorkspace.tsx` + new panels)
- **"What to do next"** card in the right sidebar: numbered, plain-language next
  step computed live (verify indicators → generate draft → review statements →
  approve sections → submit → approve), each linking to the exact fix location.
- **Review view** (`ReportReviewPanel.tsx`): aggregates every statement needing a
  decision across all sections with inline Accept/Exclude actions; resolved
  statements listed as a record.
- **Preview view** (`ReportPreviewPanel.tsx`): read-only rendered report — what
  the donor receives.
- Tab bar: Edit sections / Review (n) / Preview report / Versions (n).

---

## 3. Deploy (`scripts/deploy-fast.sh` fixes)

Two deploy-script defects surfaced during the 2026-08-29 deploy and were fixed
in the script (see `contabo-ops.md`):

1. **Unbound `BASE`** in the snapshot step — the script now defaults
   `BASE="${BASE:-${REMOTE_BASE}}"`.
2. **Web standalone extract path** — the web tar's root IS the Next.js standalone
   output (contains `apps/web/server.js` at top level), so it must extract into
   `apps/web/.next/standalone/`, not `apps/web/`. The extract step now does that,
   matching the systemd unit's `ExecStart=node .next/standalone/apps/web/server.js`.

The migration was applied **before** the code shipped
(`prisma migrate deploy` as `donordesk_migrator` with `DATABASE_ADMIN_URL`),
satisfying expand/migrate/contract. `apps/api/src/routes/health.ts`
`REQUIRED_PRISMA_FIELDS` now asserts `ReportDraft.supersededAt`, so the `/ready`
gate blocks deploys that forget the migration.

## 4. Verification

- `pnpm -r typecheck` — all 9 projects pass.
- `pnpm -r build` — web, api, infrastructure, application, contracts, domain,
  superadmin, workers all build.
- Domain tests 96/96; infrastructure tests 143 pass / 0 fail (1 pre-existing
  DB-dependent skip); `reporting:eval` exit 0 (all 25 cases correct).
- Live on donordesk.online: `/health` ok, `/ready` 200
  (`database` + `prismaClient` checks), web serves, workers active.
- Live feature checks: draft versions (9), activate guard, cancel-generation
  graceful on approved, evidence-period link, evidence picker, versions archive,
  report workspace tabs (Edit/Review/Preview/Versions), Readiness 100%.

## 5. Not in scope (deferred, P2+)

Previous-period comparison, donor DOCX template mapping, reviewer
assignment/request-changes, Excel/Kobo import, mobile/offline field capture,
and the AI Reporter v2 frontend artifact renderers + controlled rollout
(tracked in `pending.md`).
