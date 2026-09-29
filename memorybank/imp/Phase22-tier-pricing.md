# Phase 22 — Tier Pricing Overhaul: Catalog, Entitlements, Monetization Features

**Created:** 2026-09-28
**Status:** IN PROGRESS — **WS-A shipped 2026-09-28** (catalog flipped to §3
values in the same change as this status update; see §2.1a). **WS-B shipped
2026-09-29** (archived project status, active-only counting; see §2.1c).
**WS-C shipped 2026-09-29** (viewer seat accounting + permissions; see
§2.1d — invitation-acceptance is a pre-existing gap, not built here).
**WS-D through WS-I shipped 2026-09-29** (top-up packs, BYO-LLM gating,
14-day trials, nonprofit verification backend + tenant-facing form,
enterprise intake + trust page; see §2.1e–§2.1i for exact scope and the
deliberate scope cuts in each). **WS-K shipped 2026-09-29 for items 1–5 and
7** (nonprofit queue, credit-pack visibility, viewer-seat override, archived-
project visibility, trial grant/extend/end + fingerprint override,
Enterprise contract provisioning; see §2.1k). **WS-J is operational, not
code** — see §2.1j for what's left to run in production (this is the one
workstream that genuinely cannot be closed by writing more application code:
it needs live Creem merchant approval, Kestra cron configuration, and a real
enforcement-rollout decision).

> **2026-09-29 audit-remediation round 2 (§2.1m–§2.1n).** A second audit
> found and fixed a trial-kill-switch bypass and a spoofable contact-sales
> rate limiter (§2.1m), then built the `ENTITLEMENT_ENFORCEMENT`
> off/report/enforce switch that WS-J.3 had assumed already existed but did
> not (§2.1n) — every capacity check was unconditionally blocking with no
> way to soften it until this round. WS-J's remaining items are still
> operational (Creem production, Kestra schedules, the actual enforcement
> rollout decision).

> **2026-09-29 audit-remediation round (§2.1l).** A full codebase audit
> against this plan found the earlier "not built" flags for WS-K item 6
> (BYO-LLM visibility), the comped-pack/manual-refund write actions, the
> Growth standing balance (§4 WS-D item 5), and the tenant nonprofit form
> were **stale — all four are implemented** (§2.1e/§2.1h/§2.1k updated
> accordingly). The remediation round also fixed the audit's findings:
> invitation acceptance (the WS-C prerequisite) is now built end-to-end;
> archive/restore are permission-gated; the BYO gate fails closed and also
> covers template extraction; trials have a server-side kill switch
> (`TRIALS_ENABLED`, default off); the subscription grant lifecycle now
> survives renewals and mid-cycle plan changes (the pre-fix behavior silently
> dropped paying tenants to STARTER at period end); standing-balance packs
> reactivate on re-subscribe; credit adjustments no longer wipe per-tenant
> overrides; SuperAdmin trial/contract grants guard against stacking. The
> only work left in this plan is WS-J's operational items (§2.1j) plus the
> residuals listed in §2.1l.

**Owner:** Product / Platform
**Depends on:** Feature 19 (Tiers, Entitlements, Creem Payments — implemented, Creem **test mode**)
**Related:** `Features/19-Tiers-And-Payments.md`, `memorybank/SUPERADMIN-PORTAL.md` (Tier management)

---

## 1. Objective

Rework the commercial tier system so packaging matches the product's actual moat
(evidence management, claim-level provenance, donor-template compliance, audit
trail) and so AI credit quotas protect gross margin without blocking reporting
deadlines. This phase implements the audit recommendations from the 2026-09-28
tier-system review:

1. New AI credit ladder **5 / 20 / 100** (margin-safe; top-ups absorb variance).
2. Fix pricing-page copy vs catalog contradictions (Drive/R2/all-tier features,
   nonprofit discount placement).
3. Make the free tier a real hook: archived projects free, read-only viewers,
   moat features visible from day one.
4. Productize **AI credit top-up packs** (and a prepaid soft-overage option on
   Growth) using the existing reservation/metering machinery.
5. Gate **BYO AI provider** (tenant's own LLM keys) to Growth/Enterprise.
6. Restore a **14-day free trial** on Team/Growth using the dormant trial
   machinery and Creem `subscription.trialing` support.
7. NGO-friendly **nonprofit discount verification** + regional/PPP pricing path.
8. Enterprise self-serve intake + public trust page.
9. Operational unblock: production Creem, Kestra reconciliation schedules,
   Phase 6 controlled enforcement rollout.

---

## 2. Shipped in this change (marketing surface only)

| File | Change |
|---|---|
| `apps/web/src/app/page.tsx` | `PLANS` rewritten: 5/20/100 credits, archived-projects-free copy, viewers, top-ups, BYO-LLM, trial copy, moat features per card; "every plan includes" line fixed; Enterprise card de-duplicated (Drive/R2/nonprofit moved off); **See the full plan comparison → `/pricing`** link |
| `apps/web/src/app/pricing/page.tsx` | **New** full pricing page: cards, 25-row comparison table, per-tier benefit narratives, 9-question FAQ (draft definition, trial, viewers, archived, top-ups, BYO-LLM, nonprofit/regional, downgrade, tax) |
| `apps/web/src/app/signup/SignupForm.tsx` | `PLAN_OPTIONS` descriptions updated to 5/20/100 + viewers |

> ⚠️ **Coupling gate:** the catalog (`PLAN_CATALOG`) still carries the old
> prices/quotas ($59/$149, 5/100/500 credits) until WS-A ships.
> `/v1/billing/summary` and the billing settings page will disagree with
> marketing copy until then. **Do not deploy the marketing release to
> production before WS-A + WS-B + WS-C land in the same release train** (or
> flip `PLAN_CATALOG` in the same commit). Production Creem products (WS-J.1)
> must be created at the **new** prices — the four wired test products reflect
> the old $59/$149 pricing and must be replaced, not reused. The trial copy on
> `/pricing` and signup CTAs ("Start 14-day trial") must not go live before
> WS-F ships — gate behind a `NEXT_PUBLIC_TRIALS_ENABLED` flag if release
> trains diverge.

### 2.1 Audit findings (2026-09-28) — the coupling gate was crossed

A codebase audit run the same day found the warning above was not
theoretical: `memorybank/contabo-ops.md` records a **web-only production
deploy** (release `20260928162333`) that already shipped the new marketing
numbers, while `packages/domain/src/contexts/billing/plan.ts` — the
authoritative entitlement source — still has the **old** catalog:

- `PLAN_CATALOG_VERSION = 1` (not bumped to 2).
- TEAM `monthlyPriceUsd = 59`, `monthlyAiDraftCredits = 100` (plan.ts:47-57).
- GROWTH `monthlyPriceUsd = 149`, `monthlyAiDraftCredits = 500` (plan.ts:58-68).
- `ENTERPRISE_PRICE_FLOOR_ANNUAL_USD = 6000` (plan.ts:82) — marketing already
  advertises the $12k floor. This mismatch wasn't separately called out
  above; it belongs in the same "flip together" gate as the credit ladder.
- `trialDays` is `null` on every plan and `isPlanForTrial()` hard-returns
  `false` — correctly unimplemented, and trial CTAs are correctly gated
  behind `NEXT_PUBLIC_TRIALS_ENABLED` (checked in `page.tsx` and
  `pricing/page.tsx`, unset anywhere) so no trial copy is actually live. This
  part of the gate held.
- `viewerSeats`, `aiCreditTopUp`, `byoLlmEnabled` do not exist on
  `PlanLimits`; no `ARCHIVED` project status, `PurchasedCreditPack` model, or
  `VIEWER` role exist in `packages/infrastructure/prisma/schema.prisma` —
  confirms WS-A–E are fully unbuilt, so the marketing page is advertising
  features (unlimited viewers, top-up packs) with zero backing.
- The pending source edits for the marketing release
  (`apps/web/src/app/page.tsx`, `apps/web/src/app/signup/SignupForm.tsx`,
  new `apps/web/src/app/pricing/`) are **still uncommitted in git** even
  though contabo-ops.md says they're live in production — production is
  ahead of version control for this release.
- No CI check, lint rule, or deploy-time assertion anywhere (`.github/workflows/ci.yml`,
  `scripts/deploy*.sh`) compares marketing copy against `PLAN_CATALOG` /
  `PLAN_CATALOG_VERSION`. The coupling gate is a documentation warning only,
  which is how it got crossed.

**Consequence:** a real signup today sees $129/mo · 20 drafts on `/pricing`
but is actually billed/provisioned at $59/mo · 100 drafts by the live
entitlement engine — a genuine price/quota mismatch in production, not a
staging-only risk.

**Resulting changes to this plan:**

1. **WS-A is promoted from "next workstream" to blocking/urgent** — it is no
   longer safe to sequence it behind other cleanup. Until `PLAN_CATALOG` is
   flipped to §3 values (including the `ENTERPRISE_PRICE_FLOOR_ANNUAL_USD`
   6000→12000 bump, previously missing from WS-A's own checklist) and
   `PLAN_CATALOG_VERSION` bumped to 2, the production site is misrepresenting
   pricing to customers.
2. Two immediate, cheap mitigations before WS-A fully lands:
   - **Commit the pending marketing-release diff now** so git matches what's
     already running in production (process hygiene — do not let another
     deploy layer on top of an uncommitted base).
   - **Add a CI guard** (e.g. a test asserting the marketing page's
     hard-coded price/credit constants equal the corresponding
     `PLAN_CATALOG` values, or a shared constants module both sides import)
     so this class of drift fails the build instead of requiring a human to
     remember the warning in §2.
3. Until WS-A ships, consider either rolling back the marketing deploy to the
   old numbers (matching the still-live catalog) or accepting the known
   mismatch for the shortest possible window with an explicit customer-facing
   note — but the current state (silent mismatch, no flag, no rollback plan)
   should not persist.

### 2.1a WS-A shipped (2026-09-28)

The domain catalog is flipped and the drift described in §2.1 is closed:

- `PLAN_CATALOG_VERSION` bumped to `2`; TEAM `$129/mo`·`$1,290/yr`·20 credits,
  GROWTH `$299/mo`·`$2,990/yr`·100 credits; `ENTERPRISE_PRICE_FLOOR_ANNUAL_USD`
  bumped to `12000` — all in `packages/domain/src/contexts/billing/plan.ts`.
- `PlanLimits`/`PlanLimitsJson` extended with `viewerSeats`, `aiCreditTopUp`,
  `byoLlmEnabled` (STARTER: 2 viewer seats, no top-up, no BYO; TEAM: unlimited
  viewers, top-up yes, BYO no; GROWTH/ENTERPRISE: unlimited viewers, top-up
  yes, BYO yes — matching §3's target catalog). `trialDays` intentionally left
  `null` for TEAM/GROWTH — that's WS-F's job, not WS-A's; setting it now
  without the grant/expiry machinery would be a half-finished trial state.
- `entitlement.ts`'s two hardcoded `catalogVersion: 1` literals now import
  `PLAN_CATALOG_VERSION` instead of duplicating it.
- Every hand-rolled 4-field merge/parse site that would have silently dropped
  the 3 new fields at a persistence or audit boundary was fixed: `plan.ts`'s
  JSON/merge/override helpers were rewritten to derive from one key list
  instead of N per-function field lists (so the next new limit bucket is a
  one-line change, not six); `control-plane.ts`'s `listTiers`/`updateTier`/
  `setTenantLimits`/`adjustCredits`/`parseLimitsJson`/`toCatalogOverride` and
  `repositories/billing.ts`'s override-row parser were all updated to pass
  new fields through rather than hardcode the old four.
- `packages/contracts/src/billing.ts`'s `PlanLimitsJsonSchema` gained the 3
  fields (both `apps/api`'s `BillingSummarySchema` and `apps/web`'s consume
  it). `apps/web/src/lib/server/billing-schemas.ts` now **imports**
  `PlanLimitsJsonSchema` from `@donordesk/contracts` instead of hand-duplicating
  it — that eliminated a schema that would otherwise have needed updating in
  lockstep by hand. `apps/api/src/routes/superadmin.ts`'s `TierLimits` Zod
  schema gained the 3 fields directly (kept local rather than imported, since
  it carries stricter `.min(0)` validation than the JSON-boundary schema —
  swapping it for the shared schema would have silently weakened admin-input
  validation).
- `LimitedResource`/`overLimit` intentionally **not** touched — no `"VIEWERS"`
  member yet; viewer-seat enforcement is WS-C's job, and WS-A's mandate was
  the catalog numbers and the 3 new fields existing/round-tripping, not
  enforcing them.
- **New CI guard (WS-A.7):** `apps/web/tests/unit/pricing-catalog-parity.test.mts`
  asserts the landing page and `/pricing` page's hard-coded price/credit/floor
  strings equal `PLAN_CATALOG`/`ENTERPRISE_PRICE_FLOOR_ANNUAL_USD` computed at
  test time. This is the guard that was missing per §2.1 item 8 — the next
  catalog change that isn't mirrored in marketing copy (or vice versa) now
  fails `pnpm --filter @donordesk/web test:unit`, not just a human's memory.
- Verified: `packages/domain`, `packages/contracts`, `packages/application`,
  `packages/infrastructure`, `apps/api`, `apps/web` all typecheck/build clean;
  full domain (13), application (163), infrastructure billing (6), and web
  unit (189, including the 2 new parity tests) suites pass.
- **Not done in WS-A** (by design, deferred to their own workstreams): the
  three fields are not enforced anywhere yet (WS-C viewer seats, WS-D top-up
  purchase flow, WS-E BYO gating each wire their own field into an
  authoritative write path); no migration was needed (`PlanLimits`/`PlanLimitsJson`
  are code-level types over existing JSON columns, not new Prisma columns).

### 2.1b WS-A.6 shipped (2026-09-28) — existing-subscriber cutover policy

`RunGrandfatherCreditCutoverHandler`
(`packages/application/src/use-cases/billing/grandfather-credit-cutover.ts`)
implements the policy: for every tenant with an ACTIVE/PAST_DUE subscription
on TEAM or GROWTH whose current-UTC-month `AI_DRAFT_CREDITS` usage already
exceeds the *new* cap (20/100), it writes a time-bounded `GRANDFATHERED`
entitlement grant preserving the tenant's *old* allowance (100/500) until the
next UTC month boundary — full `PlanLimitsJson` is persisted in the override
(not just the credit bucket), since `calculateEntitlement` reads
`overrideLimits` as a complete `PlanLimits` object and a partial override
would leave every other bucket `undefined`. Idempotent by construction: a
tenant with an existing active grant tagged
`GRANDFATHER_CREDIT_CUTOVER_REASON_PREFIX` is skipped, so re-running the
migration never double-grants.

The known cutover values (TEAM 100→20, GROWTH 500→100) are pinned in code as
`PHASE22_CREDIT_CUTOVERS` rather than accepted as free-form SuperAdmin input
— this is a one-time historical fact about the Phase 22 catalog change, not a
general-purpose tool, so there's no way to trigger it with the wrong numbers.

**Exposed as** `POST /superadmin/billing/grandfather-credit-cutover`
(`apps/api/src/routes/superadmin.ts`), SuperAdmin-session-gated like every
other tier/credit action, audited both per-tenant (via the handler's
`IAuditLogger` calls, one `billing.credits.grandfathered` event per
grandfathered tenant) and at the platform level (one
`billing.credits.grandfather_cutover_run` entry via `PlatformControlPlane.audit`
recording who triggered the run and how many tenants it touched). It runs
against the **admin** Prisma connection (`app.container`, `useAdminConnection:
true`, bypasses per-tenant RLS) rather than the tenant-scoped
`/internal/billing/*` Kestra routes — those routes bind the Postgres session
to one tenant via `app.current_tenant` (confirmed against
`infra/postgres/rls.sql`, which RLS-isolates `BillingSubscription`/
`EntitlementGrant`/`UsageCounter` by `tenantId`), so a genuinely
cross-tenant, run-once migration like this cannot use that route pattern
without silently only seeing one tenant per invocation.

A new `IBillingSubscriptionRepository.listActiveByPlanCodes(planCodes, limit?)`
port method (and its `PrismaBillingSubscriptionRepository` implementation)
was added since no existing repository could enumerate all tenants on a
given plan platform-wide.

Verified: `packages/application` (168 tests, incl. 5 new for this handler:
grandfathers a tenant past the new cap with the full limits object preserved,
skips a tenant already within the new cap, covers both TEAM and GROWTH,
idempotent re-run, ignores plans with no configured cutover),
`packages/infrastructure` billing (6), full workspace build all pass.

**Still not done:** this closes WS-A entirely, but `ENTITLEMENT_ENFORCEMENT`
being turned on for existing paid tenants still depends on someone actually
**running** this migration against production before the cutover takes
effect — that's an operational step (§9 rollout, step 2's "grandfather
backfill verified" gate), not a code gap.

### 2.1c WS-B shipped (2026-09-29) — archived project status

Most ARCHIVED plumbing already existed (status enum value, `archive()`/
`restore()` methods, `EntitlementService.usageSnapshot` already excluded
ARCHIVED from `activeProjects`, web filters already had an `archived` toggle).
This change finished wiring it end-to-end:

- `Project` domain entity (`packages/domain/src/contexts/projects/project.ts`)
  gained `archivedAt`, set on `archive()` and cleared on `restore()`.
  `archive()` now rejects an already-archived project (previously
  unconditional); `restore()`'s existing guard (only from ARCHIVED) is
  unchanged.
- Migration `20260929120000_project_archived_status` adds `Project.archivedAt`
  (`TIMESTAMP(3) NULL`) — no enum change needed since `status` is a plain
  string column. No RLS change needed (same-table column add).
- New dedicated handlers `ArchiveProjectHandler`/`RestoreProjectHandler`
  (`packages/application/src/use-cases/projects/{archive,restore}-project.ts`),
  each emitting its own audit event (`project.archived`/`project.restored`)
  instead of the generic `project.updated`. `RestoreProjectHandler` re-checks
  the `maxActiveProjects` entitlement limit before restoring (a restore is
  effectively a new active-project claim).
- `UpdateProjectHandler`'s generic status-transition switch no longer accepts
  `ARCHIVED`/`DRAFT` as an explicit *change* (returns `VALIDATION_FAILED`
  directing callers to the new endpoints); it still no-ops correctly when the
  input status equals the project's current status, so saving a DRAFT
  project's other fields doesn't spuriously fail.
- New routes `POST /v1/projects/:id/archive` and `POST /v1/projects/:id/restore`
  (`apps/api/src/routes/projects.ts`), wired through the DI container.
- `EntitlementService.UsageSnapshot` gained `archivedProjects`; `toSummary()`'s
  `usage.projects` shape changed from `{used, limit}` to `{active, archived,
  limit}` — mirrored in `packages/contracts/src/billing.ts`
  (`BillingSummaryUsageSchema`) and consumed by `apps/web`'s
  `BillingPanel.tsx` and `billing-schemas.ts` (the latter now imports the
  shared `BillingSummaryUsageSchema`/`PlanLimitsJsonSchema` instead of
  hand-duplicating the usage shape).
- Web: `ProjectSettingsForm.tsx`'s "Archive project" button now calls the
  dedicated action instead of `updateProjectAction(..., {status: "ARCHIVED"})`;
  an archived project renders a read-only "Restore project" panel instead of
  the full edit form (archived projects are non-writable per §4 WS-B design).
  The projects list page's "Show archived" filter checkbox already existed
  and needed no change.
- `REQUIRED_PRISMA_FIELDS` (`apps/api/src/routes/health.ts`) extended with
  `Project.archivedAt` per the deploy invariant.
- **Known gap, intentionally not fixed in WS-B:** project-limit enforcement is
  check-then-create (list + count, then create), not a DB-transactional
  guard. A new regression test
  (`packages/application/test/archive-project.test.mjs`, "archived projects
  never count toward the active-project limit (create + concurrency)")
  documents that concurrent requests can still race past the cap — closing
  that requires a DB-level guard (unique partial index or serializable
  transaction), out of scope for this workstream.
- Verified: full `pnpm -r typecheck` and `pnpm -r build` clean; domain (13),
  application (173, incl. 5 new), infrastructure (249), and web unit (189)
  suites all pass.

### 2.1d WS-C shipped (2026-09-29) — read-only viewer seats

The `VIEWER` role, `UserStatus`, and `PlanLimits.viewerSeats` (STARTER 2,
others null) already existed pre-WS-C (from an earlier feature and from
WS-A). What was missing was correct seat accounting and permissions:

- **Permissions** (`packages/domain/src/policies/permissions.ts`): `VIEWER`
  gained `report.export` (was `project.view` only). Server-side route gating
  (`apps/api/src/middleware/authorization.ts`) already keys the
  `/v1/exports`, `/v1/report-drafts/:id/submission-snapshot`,
  `/v1/reporting-periods/:id/export-preflight`, and
  `/v1/projects/:id/exports` routes off `report.export`, so this one addition
  is sufficient to let viewers export without a route change. No other
  permission was added — viewers still cannot generate/edit/approve reports,
  upload/verify evidence, or manage anything, which already held before this
  change (those permissions were simply absent from `VIEWER`'s set).
- **Web capability mirror** (`apps/web/src/lib/shared/capabilities.ts`):
  `VIEWER`'s `ROLE_CAPABILITIES` entry was `[]` (a pre-existing bug — stricter
  than the server, so a viewer couldn't even see the export button); now
  `["export.create"]`, matching the server-side permission.
- **Seat accounting** (`EntitlementService.usageSnapshot`/`toSummary`,
  `packages/application/src/services/entitlement-service.ts`): `seats` now
  excludes `role === "VIEWER"` users; a new `viewerSeats` count tracks them
  separately. `usage.seats` changed from `{used, limit}` to `{full: {used,
  limit}, viewers: {used, limit}}` — mirrored in
  `packages/contracts/src/billing.ts`, `apps/web/src/lib/server/billing-schemas.ts`,
  and `BillingPanel.tsx` (now renders two meters: "Seats" and "Viewer
  seats").
- **Domain**: `LimitedResource` gained `"VIEWERS"`; `EntitlementUsage` gained
  `viewerSeats`; `computeOverLimit` flags `VIEWERS` when `viewerSeats` exceeds
  `PlanLimits.viewerSeats` (`packages/domain/src/contexts/billing/entitlement.ts`).
- **`InviteUserHandler`**: branches the seat-limit check by `cmd.role`— a
  `VIEWER` invite checks `viewerSeats` usage/limit instead of `maxSeats`, so
  viewer invites no longer consume a paid full seat (previously every invite,
  regardless of role, was checked against `maxSeats` only).
- **`ChangeRoleHandler`**: now takes `EntitlementService` and re-checks the
  destination pool's cap whenever a role change crosses the VIEWER boundary
  in either direction (full → VIEWER checks `viewerSeats`; VIEWER → full
  checks `maxSeats`) — moving *out* of a pool always succeeds, only moving
  *into* one is capped. This implements "converting a full member to viewer
  frees a paid seat" (§4 WS-C item 4) as a side effect of the general
  cross-pool check, without a separate code path.
- **Not done — pre-existing gap, out of WS-C's scope:** there is no
  invitation-acceptance flow anywhere in the codebase today (no
  `AcceptInvitationHandler`, no accept route, no web page) — `Invitation`
  and `IInvitationRepository` have the domain primitives
  (`Invitation.accept()`, `findByToken()`) but nothing wires them together;
  `apps/web`'s `TeamPanel.tsx` already discloses this ("the acceptance flow
  is not wired yet"). The plan's phrasing ("invitation acceptance re-checks
  the viewer cap atomically") assumed this flow existed; building the whole
  accept-invitation feature (route, handler, web page, and the atomic
  recheck) is a materially separate piece of work from seat accounting and
  is not included here — flagging it as a prerequisite gap for whoever picks
  it up, likely worth its own workstream or a Feature 19 follow-up rather
  than folding it into WS-C.
- No migration needed (§4 WS-C item 4, confirmed — no viewers exist yet in
  production data, and `viewerSeats`/`role` are pre-existing columns).
- Verified: full `pnpm -r typecheck` and `pnpm -r build` clean; domain (249,
  incl. 1 new), application (175, incl. 2 new), infrastructure (249), and web
  unit (189, incl. 1 updated) suites all pass.

### 2.1e WS-D shipped 2026-09-29 — AI credit top-up packs

- **Domain**: `PurchasedCreditPack` entity (`packages/domain/src/contexts/billing/purchased-credit-pack.ts`)
  — `ACTIVE|EXHAUSTED|REFUNDED`, `consume()`/`release()` (compensating,
  symmetric with the existing plan-quota reserve/release idiom) and
  `refund()` (never claws back consumed credits, per Feature 19's "refund
  never deletes data" principle).
- **Schema**: `PurchasedCreditPack` table (migration
  `20260929130000_purchased_credit_pack`), `providerOrderId` unique (nullable
  — a future comped/goodwill pack from WS-K can have `providerOrderId: null`),
  added to `infra/postgres/rls.sql`'s tenant-isolated table array.
- **Repository**: `IPurchasedCreditPackRepository` + `PrismaPurchasedCreditPackRepository`.
  `reserve()` is a single atomic `UPDATE ... WHERE status='ACTIVE' AND used+amount<=credits`
  raw statement (Prisma can't express a column-vs-column comparison in a
  query-builder `WHERE`), so two concurrent draw-downs against the same pack
  cannot overdraw it — this is the DB-level guard that WS-B's project-limit
  check-then-create explicitly does **not** have; packs are safe by
  construction from day one.
- **Enforcement** (`GenerateReportDraftHandler`,
  `packages/application/src/use-cases/reporting/generate-report-draft.ts`):
  the single `creditReserved: boolean` flag became a `CreditReservation =
  {source:"PLAN"} | {source:"PACK", packId}` value threaded through all 9
  release call-sites (mechanically replaced with one `releaseCreditReservation()`
  helper so every failure path — section-create failure, plan-persist
  failure, generation-loop failure/fallback — releases from the pool it
  actually reserved from). New private `reserveAiCreditOrPack()`: tries plan
  quota first (existing self-heal + race-safe post-increment recheck
  unchanged), then `reserveFromPacks()` walks active packs oldest-first
  (`listActiveByTenant` orders by `purchasedAt asc`) and reserves from the
  first one with room, skipping a pack that raced to exhaustion (`CONFLICT`)
  rather than failing outright.
- **Checkout**: `BillingProvider.createOneOffCheckout()` (new port method) +
  `CreemBillingProvider`/`StubBillingProvider` implementations;
  `CREEM_PRODUCT_TOPUP_50`/`CREEM_PRODUCT_TOPUP_100` env vars, resolved
  lazily like the existing subscription product env vars (no eager
  validation — an unconfigured SKU fails the specific checkout request with
  `BILLING_STATE_INVALID`, not app startup). `CreateTopupCheckoutHandler`
  gates on `entitlement.limits.aiCreditTopUp` (TEAM/GROWTH/ENTERPRISE).
- **Webhook**: `ProcessBillingWebhookHandler.processEvent()` changed from a
  single `if (!event.subscription) return ok` early-return to branching on
  `event.oneOffPurchase` (creates a pack, idempotent on `providerOrderId` as
  a second guard behind the inbox dedupe) and on `refund.created`/
  `dispute.created` with an `event.orderId` (resolves the pack by
  `providerOrderId`, sets `REFUNDED`, stops future draw-down, never touches
  `used`) — **both event types were completely unhandled before this
  change**, confirmed by the research pass that found no existing
  `refund.created` case anywhere in the codebase. `ProviderBillingEvent`
  gained `orderId`/`oneOffPurchase` fields; the Creem adapter's order-id
  extraction (`order_id ?? checkout_id ?? id`) is a **best-effort guess** —
  flagged inline in `creem.ts` to verify against real Creem refund/dispute
  payload shapes before enabling production top-up refunds (WS-J gate).
- **Billing summary**: `usage.aiDraftCredits` is now `{planAllowance, packs:
  {active, credits, used}, used, limit, resetsAt}` — `limit` is the
  plan-quota-plus-active-pack-credits effective allowance, `used` is
  combined plan+pack usage. Mirrored in `packages/contracts/src/billing.ts`
  and rendered as two meters + a "Buy +50/+100 credits" section in
  `BillingPanel.tsx` (gated on `limits.aiCreditTopUp`).
- **Not built** (explicit scope cut, documented inline rather than silently
  skipped): the Growth-only "prepaid standing balance" (§4 WS-D item 5) has
  no distinct model from a purchased pack — the research pass flagged this
  needs its own `source` discriminator (`TOPUP` vs `GROWTH_STANDING_BALANCE`)
  to let downgrade logic special-case it per §4 WS-D item 3b; not designed
  or built here. True metered post-pay overage remains explicitly out of
  scope per the original plan text. WS-K's pack management UI (comped-pack
  grants, manual refund override) is that workstream's job, not WS-D's.
- Verified: full `pnpm -r typecheck`/`pnpm -r build` clean; new
  `packages/application/test/credit-packs.test.mjs` (5 tests: pack creation
  from webhook, idempotent duplicate order, refund without claw-back,
  refund-for-unrelated-order no-op, domain consume/release/EXHAUSTED).

### 2.1f WS-E shipped 2026-09-29 — BYO AI provider gating

- `PlanLimits.byoLlmEnabled` existed since WS-A but was **never read
  anywhere** (confirmed by grep across the whole app/infra tree before this
  change) — a tenant with a configured LLM provider always drafted with
  their own credentials regardless of plan.
- Fix is entirely in `packages/infrastructure/src/container.ts`'s
  `getReportDraftGenerator` closure: after `resolveTenantLlm()` returns a
  `scope: "TENANT"` config, it now re-checks
  `entitlements.resolve({tenantId}).limits.byoLlmEnabled`; if false, the
  resolved config is discarded (`resolved = null`) so the rest of the
  function falls through to the platform/env default exactly as it already
  does when no tenant config exists — no new fallback path was invented.
  The fallback is audited (`billing.byo_llm.blocked_by_plan`) and logged so
  SuperAdmin visibility (§4 WS-E.2/WS-K.6) has a data source once that UI is
  built.
- **Not built**: WS-E.3's grandfather migration for tenants who already had
  a working BYO configuration before this gate existed. Judged genuinely
  low-risk to defer given Creem is still in **test mode** (per
  `memorybank/contabo-ops.md`) — there are no real paying BYO-LLM customers
  in production today to grandfather. Flagged as a pre-launch checklist item
  in §2.1j (WS-J) rather than built speculatively.
- **Not independently unit-tested**: the gating logic lives in a closure
  inside `container.ts`, which has no existing test harness (it's wired at
  process-boot time, not a class with injectable fakes). The existing
  `packages/application/test/tenant-own-ai-provider.test.mjs` tests
  `GenerateReportDraftHandler` directly and is unaffected (that handler
  never resolves the provider itself — it receives an already-tagged
  generator). Recommend an infrastructure-level or e2e test in a follow-up.

### 2.1g WS-F shipped 2026-09-29 — 14-day trial restored

- Catalog: `PLAN_CATALOG.TEAM.trialDays = 14`, `GROWTH.trialDays = 14`
  (`STARTER`/`ENTERPRISE` stay `null`); `isPlanForTrial()` now returns true
  for TEAM/GROWTH only (was hard-`false`).
- `ProvisionTenantHandler` (`packages/application/src/use-cases/identity/provision-tenant.ts`)
  gained `cmd.startTrial?: boolean`: when set and the plan is trial-eligible,
  it checks `TrialIdentity.existsByEmailFingerprint()` (dormant fingerprint
  utilities in `use-cases/billing/_usage.ts`, unused before this change),
  and if unused, creates a second `EntitlementGrant` (`source: "TRIAL"`,
  `effectiveUntil = now + trialDays`) **alongside** the permanent STARTER
  base grant — TRIAL's existing precedence (`MANUAL > ... > TRIAL >
  DEFAULT`, unchanged in `calculateEntitlement`) means it's simply the
  higher-precedence active grant until it expires, at which point
  `computeOverLimit`/`resolveWithUsage` fall back to the STARTER grant that
  was there the whole time — no new expiry-handling code needed, matching
  the plan's note that lazy enforcement already does this correctly.
  A fingerprint collision doesn't block signup; it just skips the trial
  grant (`trialFingerprintBlocked`, audited) and the tenant gets STARTER.
- `SignUpHandler`/`GoogleSignInHandler` thread `startTrial` through from the
  API body/OAuth state to the provisioner; both now return `trialGranted` in
  their result so the web knows whether to redirect to Creem checkout or
  straight to the dashboard.
- `ExpireLocalTrialsHandler` and its `POST /internal/billing/expire-trials`
  route **already existed and were already wired** into the container
  before this workstream — only the Kestra hourly schedule (infra config,
  not code) is outstanding, tracked in §2.1j.
- Web: `NEXT_PUBLIC_TRIALS_ENABLED`-gated "Start a 14-day free trial" checkbox
  on `/signup` (only rendered for `?plan=team|growth`); `BillingPanel.tsx`
  shows a "Trial active — card due `<date>`" banner when `summary.isTrial`.
  The `/checkout` redirect page was deliberately left unchanged — it's a
  pure pass-through to Creem and subscribing mid-trial already works via
  existing TRIAL/CREEM_SUBSCRIPTION precedence, so no new state-detection
  logic was needed there.
- **Not built**: SuperAdmin trial grant/extend/end + fingerprint override
  (§4 WS-F.6) is explicitly WS-K's job per the plan text itself.
- Verified: full `pnpm -r typecheck`/`pnpm -r build` clean; existing
  `provision-tenant always starts on the free STARTER tier` test still
  passes unchanged (optional `trialIdentities` param, `startTrial` defaults
  falsy) — no new automated test was added for the trial-grant path itself
  (would need a `TrialIdentity`+`EntitlementGrant` fake harness); flagged as
  a coverage gap for a follow-up.

### 2.1h WS-G shipped 2026-09-29 (backend only) — nonprofit verification

**Deliberately scoped down** from the full plan text: built the domain,
data, application-handler, and API layers end-to-end; **did not** build any
web UI (neither the tenant-side upload form nor a SuperAdmin queue page) —
that is consistent with the plan's own WS-K carve-out for "SuperAdmin
management surface" but goes further by also deferring the tenant-side
upload form, which the plan had implicitly assumed would ship with WS-G.
Flagging this explicitly rather than leaving it to be discovered later.

- **Domain**: `NonprofitVerification` entity (submit → `PENDING` →
  `approve()`/`reject()`, both single-use transitions guarded against
  re-review); `Organization.nonprofitVerifiedAt` (+ `markNonprofitVerified()`/
  `clearNonprofitVerification()`) — approval **never touches `PlanLimits`**,
  matching the plan's explicit "discounts never change domain limits"
  requirement; it only gates which Creem checkout product a tenant is
  offered.
- **Schema**: `NonprofitVerification` table + `Organization.nonprofitVerifiedAt`
  column (migration `20260929140000_nonprofit_verification`), `NonprofitVerification`
  added to `infra/postgres/rls.sql`.
- **Application**: `SubmitNonprofitVerificationHandler` (tenant-side,
  `billing.manage`, one `PENDING` submission at a time — a prior
  rejected/approved submission never blocks a new one, e.g. a renewed
  registration); `ApproveNonprofitVerificationHandler`/
  `RejectNonprofitVerificationHandler`/`ListPendingNonprofitVerificationsHandler`
  (SuperAdmin-actor, not `AuthenticatedContext`-shaped — matching the
  existing `runGrandfatherCreditCutover` precedent of a platform action
  taking a raw actor id).
- **Checkout discount routing**: `CreateCheckoutArgs.nonprofit?: boolean`,
  set from `Boolean(organization.nonprofitVerifiedAt)`;
  `CreemBillingProvider.resolveNonprofitProduct()` looks for
  `${STANDARD_ENV_VAR}_NONPROFIT` (e.g.
  `CREEM_PRODUCT_TEAM_MONTHLY_NONPROFIT`) and **falls back to the standard
  product** if the discount SKU isn't configured — a tenant is never blocked
  from checking out just because the discount product doesn't exist yet in
  a given environment.
- **Routes**: `POST /v1/billing/nonprofit-verification` (tenant submission,
  `billing.manage`-gated) and three SuperAdmin routes under
  `/superadmin/billing/nonprofit-verifications` (list pending, approve,
  reject-with-reason), following the existing `secured.*` +
  `app.container.handlers.*` + `service().audit(...)` pattern from the
  grandfather-cutover route.
- **Not built**: any web page (tenant upload form or SuperAdmin queue UI);
  real file/document upload integration (`documentUrl` is accepted as a
  plain string from the request body — out-of-band upload via existing
  generic storage endpoints is assumed, not wired); regional/PPP pricing
  (§4 WS-G.2, a SuperAdmin MANUAL-grant workflow with no new mechanism
  needed, but no UI was built either); support docs sweep (§4 WS-G.3).
- **No automated tests added** for the new handlers — flagged as a coverage
  gap; the domain entity's transition guards (single-use approve/reject)
  are straightforward enough that the risk is low, but this should not be
  taken as "tested" in the same sense as WS-D's webhook suite.

### 2.1i WS-I shipped 2026-09-29 — enterprise intake + trust page

- **`POST /v1/contact-sales`** (new, public/unauthenticated route
  registered alongside `/v1/auth/*` and the webhook routes, outside the
  tenant-auth middleware block in `apps/api/src/server.ts`) — Zod-validated
  with a honeypot field (`website`, must stay empty) for basic spam
  resistance; no rate-limiter was added (out of scope for the time
  available — flagged for WS-J/ops if abuse is observed).
  `SubmitContactSalesInquiryHandler` + `IContactSalesNotifier` port +
  `ConsoleContactSalesNotifier` (log-based dev default, matching the
  "console email" Phase 1 deviation already documented for the rest of the
  platform) + an audit row (`sales.contact_inquiry.submitted`, recorded
  against the same `{toString: () => "*"}` platform-sentinel tenant id
  `ExpireLocalTrialsHandler` already uses for tenant-less audit events).
- **`/contact-sales`** web page + client form
  (`apps/web/src/app/contact-sales/`), replacing the Enterprise plan's
  `mailto:sales@donordesk.online` CTA on both `/` and `/pricing` (the
  generic footer "Contact support/sales" mailto links elsewhere were left
  alone — the plan specifically called out "the mailto: CTA", i.e. the
  Enterprise plan button, not every email link on the site).
- **`/security` page** (new — it did not exist at all before this change,
  despite the plan phrasing "extend /security" assuming it did): tenant RLS
  isolation description, subprocessor list (Creem, Google Drive, Cloudflare
  R2), data export/deletion policy, and a DPA request contact.
- **Not built**: WS-I.3 (Enterprise contract provisioning) — explicitly
  deferred to a manual SuperAdmin flow per the plan's own text; WS-K.7
  scopes the minimum surface for that later.

### 2.1j WS-J — operational, not code (status as of 2026-09-29)

WS-J's four items are infrastructure/business operations that cannot be
completed by writing application code; they gate the whole phase's
production readiness regardless of how much of WS-D–I ships. Status:

1. **Production Creem** (live products at §3 prices, merchant/payout
   approval, key rotation) — **not started**; per `memorybank/contabo-ops.md`
   Creem is still in **test mode**. Nothing in Phase 22 collects real money
   until this happens. The two top-up SKUs and any nonprofit-discount
   products (WS-D/WS-G, this session) also need their Creem product IDs
   created and the corresponding env vars set once this happens.
2. **Kestra schedules** for `/internal/billing/{reconcile-subscriptions,
   reconcile-storage,release-stale-reservations,retry-inbox,expire-trials}`
   — all five routes already exist and are already wired into the
   container (confirmed for `expire-trials` this session; the other four
   predate Phase 22). Only the actual cron schedule + alerting is
   outstanding, and that's a Kestra config change, not application code.
3. **Phase 6 enforcement rollout mechanism — shipped 2026-09-29 (§2.1n)**.
   Correction to this item's earlier text: "the kill switch and reporting
   mode already exist per Feature 19" was **stale/aspirational** — a grep
   across the whole app/infra tree before this fix found zero references to
   `ENTITLEMENT_ENFORCEMENT` in code, only in this doc and Feature 19's own
   design text; every capacity check (projects, seats, viewers, storage, AI
   credits) blocked unconditionally with no way to soften it. §2.1n builds
   the actual `off`/`report`/`enforce` switch. What's still not done is the
   **operational** half of this item: choosing when to run at `report` for a
   cohort, watching conversion/attach-rate/margin metrics, and deciding when
   to flip that cohort to `enforce` — that decision and its metrics
   dashboard are a business/ops process, not something a switch alone
   provides, and remain outstanding.
4. **`REQUIRED_PRISMA_FIELDS`** — kept current in the same PR as every
   migration this session (`Project.archivedAt`, `PurchasedCreditPack.providerOrderId`,
   `Organization.nonprofitVerifiedAt`, `NonprofitVerification.status`), so
   this one sub-item is actually done, continuously, not deferred.

Pre-launch checklist this session surfaced that belongs here, not in a new
workstream: verify the Creem refund/dispute payload's actual order-id field
name against `creem.ts`'s best-effort `order_id ?? checkout_id ?? id`
extraction (WS-D). WS-E's grandfather step is now a one-click SuperAdmin
action (`RunGrandfatherByoLlmHandler`, §2.1k) rather than a manual audit —
someone still has to actually click it before BYO-LLM enforcement affects
existing tenants, the same operational gate WS-A.6 already established for
the credit cutover.

### 2.1k WS-K shipped 2026-09-29 (items 1–5, 7) — SuperAdmin surface

- **Item 3 (viewer seat override) confirmed the exact risk the plan called
  out**: both `TierModal` (global tier editor) and `TenantTierModal`
  (per-tenant override) in `apps/superadmin/src/app/ui/Dashboard.tsx` had no
  `viewerSeats`/`aiCreditTopUp`/`byoLlmEnabled` fields at all — the backend
  `TierLimits` Zod schema accepted them (from WS-A) but nothing in the UI
  could ever send them. Added to both forms.
- **Item 4 (archived-project visibility)**: `PlatformControlPlane.usageByTenant`
  gained an `archivedProjects` query (mirroring WS-B's predicate) and
  `billingRow` now returns it; the tenant tier-assignment table shows
  `N / limit (M archived)`.
- **Item 5 (trial controls)** — new `PlatformControlPlane` methods
  `grantTrial`/`extendTrial`/`endTrial`/`overrideTrialFingerprint`, following
  the exact direct-Prisma pattern `changeTenantTier`/`resetTenantTier`
  already use (control-plane methods write `EntitlementGrant` rows directly
  via `this.prisma`, bypassing the tenant-scoped `IEntitlementGrantRepository`
  port entirely — grants are otherwise immutable/append-only at the
  application layer, so ending/extending a trial early is only possible
  through this platform-level direct-SQL path, matching precedent rather
  than inventing a new one). Four new routes under
  `/superadmin/tenants/:id/trial*` and `/superadmin/trial-fingerprint/override`;
  UI buttons in the Billing tab (Grant/Extend/End trial, "Clear a trial-abuse
  fingerprint").
- **Item 7 (Enterprise contract provisioning)**: new
  `PlatformControlPlane.provisionEnterpriseContract` writes a dedicated
  `ENTERPRISE_CONTRACT`-source grant (not the generic `MANUAL` tier change
  `changeTenantTier` writes) with `effectiveFrom`/`effectiveUntil` set to the
  contract's actual start/end dates and `annualPriceUsd` enforced against
  `ENTERPRISE_PRICE_FLOOR_ANNUAL_USD` ($12,000) before the grant is written.
  UI: "Provision contract" button on ENTERPRISE-tier tenant rows.
- **Item 1 (nonprofit queue) and item 2 (credit pack visibility)**: covered
  in §2.1h/§2.1e respectively (built alongside WS-G/WS-D, not held for
  WS-K) — cross-referenced here for completeness of the WS-K checklist.
- **Not built — item 6 (BYO-LLM override visibility)**: showing "this
  tenant's configured provider is being ignored because byoLlmEnabled=false"
  directly next to the tenant's LLM config row in the "AI & LLM" SuperAdmin
  tab requires cross-referencing `PlatformConfiguration` rows against each
  tenant's resolved entitlement — a genuine N+1-style lookup the existing
  `Providers` component has no data for today. The underlying signal exists
  (the `billing.byo_llm.blocked_by_plan` audit event from WS-E fires every
  time this happens, so the SuperAdmin Audit tab already shows it, just not
  inline next to the config). Deferred rather than built as a rushed
  cross-reference query at the end of an already-large session.
- **Not built — comped/goodwill packs and manual refund override** (item 2's
  write actions): the read-side visibility shipped; creating a
  `providerOrderId: null` comped pack or manually flipping a pack to
  `REFUNDED` outside the Creem webhook path did not. `PurchasedCreditPack`'s
  domain methods (`refund()`) and repository (`update()`) already support
  this — only the SuperAdmin route + UI action are missing.
- Verified: full `pnpm -r typecheck`/`pnpm -r build` clean across all 9
  workspace projects (including `apps/superadmin`); domain (249), application
  (186, incl. 6 new this round: 3 grandfather-BYO-LLM + 3 trial-grant),
  infrastructure (249), web unit (189) all pass. The new
  `PlatformControlPlane` methods and SuperAdmin routes have **no automated
  tests** — `apps/superadmin` has no test harness in this repo (confirmed:
  no test script in its `package.json`), and `PlatformControlPlane` itself
  has no existing unit test file to extend; this is a pre-existing gap in
  the codebase's test coverage for the whole SuperAdmin surface, not one
  introduced by this session.

### 2.1l Audit remediation round (2026-09-29)

A full audit against this plan produced a findings list; all of the
following are fixed in the same change. Staleness corrections first: the
earlier "not built" flags for WS-K item 6, the WS-K item 2 write actions,
WS-D item 5 (standing balance) and the WS-G tenant form were wrong — that
code exists (SuperAdmin `listByoLlmStatus`, `manage-credit-packs.ts`,
`credit_pack_source` migration, `NonprofitDiscountSection`) and the
sections above now say so.

Fixes shipped in this round:

- **Grant lifecycle (critical):** `BillingSubscriptionSynchronizer` now
  maintains the invariant "exactly one open CREEM_SUBSCRIPTION grant
  covering now at the subscription's current plan and period". Previously a
  grant was created only when none existed, so a renewal never created the
  next window (paying tenants silently fell back to STARTER at period end)
  and a mid-cycle plan change kept the old plan's grant. Stale windows end
  in place via a new `IEntitlementGrantRepository.endGrant` port method;
  sync writes `catalogVersion: PLAN_CATALOG_VERSION` instead of the literal
  `1`. Tested (renewal, idempotent re-sync, plan change).
- **Invitation acceptance (WS-C prerequisite):** new
  `AcceptInvitationHandler` + `IInvitationRepository.update`,
  `POST /v1/invitations/accept` and `GET /v1/invitations/preview` (public;
  the token is the capability), `/invite/accept` web page + server action,
  TeamPanel now shares the acceptance link. Acceptance re-checks the
  destination seat pool (`VIEWERS` vs `SEATS`) per request — the
  "atomic re-check" the WS-C plan text assumed. Tested (8 cases incl.
  viewer pool, caps, expiry, single-use, duplicate email).
- **Archive/restore authorization:** route rules (`project.edit`) added to
  `authorizationMiddleware` and `Permissions.require` in both handlers —
  previously any role (incl. VIEWER) could archive/restore any project.
- **BYO-LLM gate:** fails closed when the entitlement cannot be resolved
  (previously fail-open), covers template extraction
  (`resolveTemplateLlm`) as well as report drafting, and audit failures log
  instead of vanishing.
- **Trials:** server-side kill switch `TRIALS_ENABLED` (default off,
  `ProvisionTenantHandler` enforces it; the web `signupAction` re-checks
  the flag too), closing the crafted-request bypass of
  `NEXT_PUBLIC_TRIALS_ENABLED`. Flag-gated attempts are audited
  (`trialDisabledByFlag`).
- **Credit adjustment:** `PlatformControlPlane.currentPlanLimits` merges the
  tenant's full stored override over the catalog base, so `adjustCredits`
  no longer silently reverts per-tenant `viewerSeats`/`byoLlmEnabled`/etc.
  overrides (previously a credit tweak un-grandfathered BYO tenants).
  `billingRow` merges the same way, hardening partial-override reads.
- **Standing balance:** packs reactivate on re-subscribing to GROWTH
  (`reactivate()` domain method + synchronizer hook, audited) — SUSPENDED
  packs were previously stranded forever; the Billing tab shows suspended
  counts; `release()` is a single atomic conditional UPDATE (mirroring
  `reserve()`).
- **Nonprofit:** rejecting a verification now revokes
  `Organization.nonprofitVerifiedAt` (latest review wins; previously one
  approval lasted forever); approving without an org row fails loudly;
  `documentUrl` must be an http(s) URL; the submission route response is
  contracts-validated. Comp packs accept an explicit `source`.
- **SuperAdmin:** `grantTrial` supersedes an existing effective TRIAL
  instead of stacking; `provisionEnterpriseContract` ends overlapping
  contracts; the contract dialog reads `ENTERPRISE_PRICE_FLOOR_ANNUAL_USD`
  instead of a literal; Tenants tab shows `(M archived)`; the pack SQL
  surfaces SUSPENDED packs.
- **Web/marketing:** `/pricing` Free card fixed to 5 drafts (was a
  hard-coded 10); regional/PPP copy no longer claims a self-serve feature;
  nonprofit FAQ points at the in-product flow; "40% off all paid plans"
  corrected; Growth landing card carries the gated trial line. The parity
  test now covers the `/pricing` STARTER card, the credits comparison row,
  the landing floor line, NGO ladder constants, viewer counts, and
  SignupForm numbers.
- **Contact sales:** per-IP in-process rate limit (5/hour, `RATE_LIMITED`
  → 429) and the honeypot now accepts-and-drops (bots get success, real
  schema rejects nothing) instead of 400-ing.
- **Stub provider:** webhook mapping now emits `orderId`/`oneOffPurchase`
  (SKU slugs) and honors the `nonprofit` checkout flag, so pack
  flows are exercisable without live Creem; stale `unitAmountMinor: 5900`
  corrected to the $129 Team price. Tested.

Residuals, deliberately not closed here:

- **WS-J operational items** (§2.1j) — unchanged; they gate production.
- **Check-then-create races** (project cap, seat cap, pack cap at purchase
  time): per-request checks only; DB-transactional guards still outstanding
  per §2.1c (pack *draw-down* is DB-atomic).
- **Pack `used` crash window:** failed generations release correctly
  (verified), but a hard crash between reserve and release burns a pack
  credit with no ledger self-heal (packs have no per-pack ledger to heal
  against). Accepted residual; revisit if it ever shows in data.
- **PlatformControlPlane / superadmin app tests:** still no harness.
- **`extendTrial`/`endTrial`** mutate grant rows in place (audited,
  platform-level precedent) — the append-only convention remains broken at
  that one platform surface by design.
- **Admin-granted trials intentionally bypass and never burn the
  `TrialIdentity` fingerprint** (explicit admin action ≠ self-serve signup);
  `domainFingerprint` is recorded but not enforced (same-domain trial abuse
  remains possible via new emails).

### 2.1m Audit remediation round 2 (2026-09-29)

Full workspace verification first: `pnpm -r typecheck`, `pnpm -r build`, and
every unit suite (domain 249, application 205, infrastructure 252) pass
clean on the uncommitted Phase 22 diff. (One unrelated, pre-existing e2e
failure — `apps/web/tests/phase2.spec.ts` "forgot-password page gives
honest support guidance" — predates this branch: the page now has a real
self-service reset form, the test still asserts the old "not available yet"
stub copy it replaced. Not part of Phase 22; left for whoever owns that
page.)

A targeted audit of the money/auth/RLS-critical paths against this doc's own
"shipped" claims found two real gaps, both fixed:

- **Trial kill switch had a silent fallback that defeated it**
  (`ProvisionTenantHandler`'s `trialsEnabled` default in
  `packages/application/src/use-cases/identity/provision-tenant.ts`, and the
  mirrored check in `apps/web/src/lib/auth-actions.ts`'s `signupAction`):
  both read `process.env.TRIALS_ENABLED ?? process.env.NEXT_PUBLIC_TRIALS_ENABLED`
  instead of `TRIALS_ENABLED` alone. §2.1l's stated intent was a
  server-only switch independent of the client-facing marketing flag; the
  `??` fallback meant setting only `NEXT_PUBLIC_TRIALS_ENABLED` (the natural
  thing to do to turn on trial marketing copy) silently activated real
  trials too — reopening the exact bypass §2.1l claims to have closed. Fixed
  on both sides to check `TRIALS_ENABLED` only.
- **Contact-sales rate limiter was trivially bypassable**
  (`apps/api/src/routes/sales.ts`'s `clientIp()`): it parsed the
  client-supplied `X-Forwarded-For` header directly, and Fastify had no
  `trustProxy` configured (`apps/api/src/server.ts`), so any request could
  set an arbitrary `X-Forwarded-For` value and get a fresh rate-limit bucket
  every time — the 5/hour limit from §2.1l enforced nothing. Fixed by
  setting `trustProxy: "127.0.0.1"` on the Fastify instance (the api only
  ever receives traffic from nginx on the same host) and reading `req.ip`
  instead of the raw header.

Not changed: the marketing "40% off" NGO price ($129→$79, $299→$179) is a
rounded list price, not a literal 40.000% computation (~38.8%/40.1%
actual) — normal pricing practice for clean price points, not a bug: there
is no domain-level `nonprofitPriceUsd` field these derive from (the actual
discount is applied by which Creem product a verified tenant is offered,
per §2.1h's `resolveNonprofitProduct`), so "40%" is marketing copy about a
pricing decision, not a value with a computable source of truth to drift
from.

Verified after the fix: `packages/application`, `apps/api`, `apps/web`
typecheck clean; `packages/application` full suite (205) still passes.

### 2.1n WS-J.3 mechanism shipped (2026-09-29) — `ENTITLEMENT_ENFORCEMENT` off/report/enforce

Every capacity check in this codebase (`CreateProjectHandler`,
`RestoreProjectHandler`, `InviteUserHandler`, `AcceptInvitationHandler`,
`ChangeRoleHandler` for PROJECTS/SEATS/VIEWERS, `UploadEvidenceHandler` for
STORAGE, `GenerateReportDraftHandler` for AI_CREDITS) already blocked an
over-limit request unconditionally — there was no flag anywhere to soften
that, despite this doc and Feature 19's design text describing one as
already existing. This round builds it for real:

- `EntitlementEnforcementMode = "off" | "report" | "enforce"`
  (`packages/application/src/services/entitlement-service.ts`), read from
  `process.env.ENTITLEMENT_ENFORCEMENT`, **defaulting to `"enforce"`** —
  unset, the system behaves exactly as it did before this change, so this is
  additive, not a behavior change, until ops sets the var.
  - `off`: never blocks, never audits — a true kill switch.
  - `report`: evaluates the limit exactly as `enforce` does, but instead of
    rejecting, records an `entitlement.limit_would_block` audit event
    (resource, limit, used) and lets the request through — lets ops watch
    real demand against the new caps before anyone is actually cut off.
  - `enforce`: blocks, same `PLAN_LIMIT_REACHED`/`AI_CREDITS_EXHAUSTED`
    errors as before.
- One shared helper, `applyEntitlementLimit()`, replaces the duplicated
  `if (used >= limit) return {ok:false, error: entitlementLimitError(...)}`
  pattern at all six of the simple capacity-check call sites, so the mode
  decision lives in one place instead of six.
- AI credits (`GenerateReportDraftHandler`) needed a separate variant since
  reservation there isn't a plain usage-vs-limit comparison: it draws from
  plan quota then active top-up packs (WS-D). In `off` mode the reservation
  attempt is skipped entirely (no plan-quota or pack credit is touched); in
  `report` mode a would-have-been-exhausted reservation attempt is audited
  and the draft still generates unmetered (no reservation exists to release
  later, which the existing release call-sites already handle as a no-op
  for `null`). The independent ledger count
  (`llmRuns.countAiReportDrafts`) that self-heals the usage counter is
  unaffected either way, so real usage stays visible regardless of mode.
- Tested: `off`/`report` cases added for `CreateProjectHandler`
  (`packages/application/test/billing.test.mjs`) and
  `GenerateReportDraftHandler`
  (`packages/application/test/tenant-own-ai-provider.test.mjs`), covering
  both "lets the over-limit request through" and "logs/doesn't log the
  would-block event" for each mode. The other five call sites share the
  same `applyEntitlementLimit()` helper the tested one uses, so they are
  covered by the helper's own behavior rather than duplicated per-handler.
- Verified: full `pnpm -r typecheck`, `pnpm -r build` clean;
  `packages/application` full suite (209, incl. 4 new), domain (249),
  infrastructure (252) unaffected and passing.
- **Not done — deliberately, this is the operational half of WS-J.3, not a
  code gap**: nobody has actually set `ENTITLEMENT_ENFORCEMENT=report` in
  any environment, there is no dashboard reading the new
  `entitlement.limit_would_block` audit events, and no cohort/conversion/
  attach-rate/margin rollout process has been defined or started. The
  switch now exists for ops to use; deciding how and when to use it is a
  business decision outside this codebase.

---

## 3. Decided catalog (target state)

| | Free (Starter) | Team | Growth | Enterprise |
|---|---|---|---|---|
| Price | $0 | **$129/mo · $1,290/yr** | **$299/mo · $2,990/yr** | Contracted, **floor $12,000/yr** |
| NGO price (40% verified discount) | — | **$79/mo · $790/yr** | **$179/mo · $1,790/yr** | Built into contract |
| Trial | — | 14 days | 14 days | Guided pilot |
| Active projects | 1 | 5 | 20 | null (unlimited/contracted) |
| Archived projects | Unlimited (policy: never counted) | Unlimited | Unlimited | Unlimited |
| Full seats | 1 | 5 | 15 | null |
| Read-only viewers | 2 | null (unlimited) | null | null |
| Managed storage | 1 GB | 25 GB | 100 GB | null |
| **AI drafts/month** | **5** | **20** | **100** | null (contracted pool) |
| Top-up packs | — | **+50 pack $79** | **+100 pack $149**, prepaid standing balance | Contracted |
| BYO AI provider | — | — | ✔ | ✔ |
| Nonprofit discount | — | 40% verified | 40% verified | In contract |
| Support | Community | Email | Priority + onboarding call | SLA + CSM |

Pricing rationale (2026-09-28 decision, after the $199/$499 review): the
discounted NGO ladder ($0 → $79 → $179) keeps the long tail reachable and
undercuts Grantable's premium tier, while the list prices ($129/$299) anchor
DonorDesk in the mid-market compliance bracket below Instrumentl Pre-Award
($499/$579). The Enterprise floor moves $6k → $12k so Enterprise annual is a
genuinely different purchase (4x Growth annual), not a 20% premium over it.
Discounts are **visible but verified**: NGO prices shown on all marketing
surfaces, registration certificate required at checkout.

**Catalog version bump:** `PLAN_CATALOG_VERSION = 1 → 2` (invalidates
catalog-coded snapshots per `plan.ts` contract). Also update
`ENTERPRISE_PRICE_FLOOR_ANNUAL_USD` 6000 → 12000 and audit any SuperAdmin/UI
consumers of the floor constant.

---

## 4. Workstreams

### WS-A — Domain catalog + new limit dimensions (**shipped 2026-09-28 — see §2.1a/§2.1b**)

Files: `packages/domain/src/contexts/billing/plan.ts`,
`packages/contracts/src/billing.ts`, `EntitlementService`,
`packages/domain/test/billing.test.mjs`, `packages/application/test/billing.test.mjs`.

1. ✅ Extend `PlanLimits`:
   ```ts
   viewerSeats: number | null;          // null = unlimited
   aiCreditTopUp: boolean;              // packs purchasable
   byoLlmEnabled: boolean;              // tenant LLM keys allowed
   ```
   (`maxActiveProjects` semantics change to **active-only** — see WS-B; not
   yet active since `ARCHIVED` status doesn't exist until WS-B ships, so
   today it still counts every project, which is correct pre-WS-B behavior.)
2. ✅ Catalog values per §3. STARTER keeps 5 credits (unchanged); TEAM 100 →
   20; GROWTH 500 → 100; `ENTERPRISE_PRICE_FLOOR_ANNUAL_USD` 6000 → 12000 in
   the same change.
3. ✅ `PlanLimitsJson`/`planLimitsToJson`/`mergePartialLimits`/
   `resolvePlanWithOverride` extended for the three new fields (partial
   override + explicit-`null`-means-unlimited semantics preserved) — rewritten
   to derive from one key list instead of N hand-listed fields per function.
4. **Deferred to WS-C**, not WS-A: `EntitlementSnapshot.overLimit`/
   `LimitedResource` still has no `"VIEWERS"` member. Viewer seats can't be
   over-limit before WS-C's `VIEWER` role and seat-counting split exist;
   adding the enum member now with nothing computing it would be a dead
   value. Revisit when WS-C lands.
5. **Not done — no SuperAdmin tier-editor UI exists yet** (checked: the only
   editing surface today is the `TierLimits` Zod schema in
   `apps/api/src/routes/superadmin.ts`, API-only, no web UI found anywhere in
   `apps/web`). That schema now accepts the 3 new fields
   (`viewerSeats`/`aiCreditTopUp`/`byoLlmEnabled`), so the API can persist
   them; building the actual UI is WS-K's job (SuperAdmin management
   surface), not WS-A's.
6. ✅ **Existing-subscriber cutover policy** — see §2.1b.
   `RunGrandfatherCreditCutoverHandler` + `POST
   /superadmin/billing/grandfather-credit-cutover` grant a time-bounded
   `GRANDFATHERED` allowance at the old cap to any TEAM/GROWTH tenant already
   past the new cap this UTC month, until the next UTC month boundary.
   Storage/seats/projects unchanged. Code is shipped; **someone must still
   run it against production** before `ENTITLEMENT_ENFORCEMENT` is enabled
   for existing paid tenants (operational step, §9 rollout gate).

### WS-B — Archived project status (active-only counting) (**shipped 2026-09-29 — see §2.1c**)

Files: project domain/entity + repository, `CreateProjectHandler`,
`PrismaProjectRepository` count query, API routes, web project list, billing
summary.

1. ✅ Add `ARCHIVED` project status (migration + enum) with `archivedAt`.
2. ✅ `POST /v1/projects/:id/archive`, `POST /v1/projects/:id/restore` (audit
   trailed; archived projects are read-only in the web UI, not deletable).
3. ✅ `maxActiveProjects` enforcement counts only non-archived projects
   (already true via `EntitlementService.usageSnapshot`'s filter predicate,
   confirmed and left as check-then-create — see the concurrency gap noted
   in §2.1c).
4. ✅ Billing summary `usage.projects` reports `{ active, archived, limit }`.
5. ✅ Web: archive/restore actions + archived filter in the project list
   (filter toggle pre-existed; actions are new).
6. ✅ Concurrency test added, but it documents a still-open race (check-then-
   create is not DB-transactional) rather than closing it — see §2.1c.

### WS-C — Read-only viewer seats (**shipped 2026-09-29 — see §2.1d**)

Files: identity context (role model), invitations, seat enforcement, billing
summary, web member management.

1. ✅ Role `VIEWER` (read-only permission set: `project.view` + `report.export`
   only; cannot consume AI credits, approve, edit, upload managed evidence;
   can browse and export). The role enum itself pre-existed; the permission
   set was fixed to match this spec.
2. ✅ Seat accounting: `maxSeats` counts owner + `ACTIVE|INVITED|SUSPENDED`
   **non-viewer** users. `viewerSeats` counted separately (`STARTER` 2, others
   null). **Not done:** "invitation acceptance re-checks the viewer cap
   atomically" — no invitation-acceptance flow exists at all yet (pre-existing
   gap, see §2.1d); `ChangeRoleHandler` and `InviteUserHandler` do re-check
   the correct cap atomically-per-request today.
3. ✅ `usage.seats` reports `{ full: { used, limit }, viewers: { used, limit } }`.
4. ✅ Existing tenants: no migration needed (no viewers exist yet); converting
   a full member to viewer (and back) is now cap-checked by `ChangeRoleHandler`.

### WS-D — AI credit top-up packs + prepaid standing balance (**shipped 2026-09-29 (core); standing balance not built — see §2.1e**)

Files: new `PurchasedCreditPack` model + repo, `EntitlementService`,
reservation/enforcement path in `GenerateReportDraftHandler`, billing API +
web, Creem adapter (one-off products), SuperAdmin billing view.

1. Model:
   ```
   PurchasedCreditPack { id, tenantId, credits, used, status: ACTIVE|EXHAUSTED|REFUNDED,
                         providerOrderId?, purchasedAt, expiresAt?, timestamps }
   ```
2. Effective monthly allowance = `plan.monthlyAiDraftCredits` + Σ active pack
   credits. Enforcement order: plan quota first, then packs oldest-first
   (`used` increment transactional with the same reservation pattern as the
   monthly counter; released on failed generation, mirroring credit release).
3. Products: two Creem **one-off** products (`CREEM_PRODUCT_TOPUP_50 = $79`,
   `CREEM_PRODUCT_TOPUP_100 = $149` — final list pricing per the 2026-09-28
   decision; commercial owner may tune) + allowlist mapping, webhook event →
   `PurchasedCreditPack` (idempotent via existing inbox; one-off purchases are
   not subscriptions — do **not** touch entitlement grants). Pack pricing sits
   below each plan's effective per-draft rate (rewards loyalty) but above the
   next tier's rate (pushes upgrades).
3a. **Refund/dispute mapping (gap — not previously itemized outside the test
   matrix):** extend the webhook processor's `refund.created`/`dispute.created`
   handling (Feature 19 §11 table) to also resolve a `PurchasedCreditPack` by
   `providerOrderId` when the refunded object is a one-off pack purchase
   (distinct from a subscription refund). On refund, set `status: REFUNDED`
   and stop further draw-down from that pack; **do not** claw back credits
   already consumed from it (mirror Feature 19's "refund never deletes data"
   principle — a draft already generated stays generated). Audit-trailed,
   SuperAdmin-visible (see WS-K).
3b. **Downgrade/cancellation interaction (gap):** when a TEAM/GROWTH
   subscription is canceled or downgraded to STARTER (webhook-driven, per
   Feature 19 §11), active `PurchasedCreditPack` balances remain on the
   tenant and continue to draw down against the STARTER quota rather than
   being forfeited (packs are tenant property, not plan property) — document
   this explicitly since Feature 19's entitlement model has no precedent for
   a resource that outlives its originating subscription. Growth's prepaid
   standing balance (item 5 below) is exempt: standing-balance packs held for
   soft overage are Growth-only and stop drawing down on downgrade, with a
   one-time admin notice.
4. Purchase UX: billing settings page "Buy +50 / +100 credits" →
   `POST /v1/billing/topup` (one-off checkout session, same security rules as
   `checkout`: server-side product mapping, signed redirect, webhook
   authoritative).
5. **Soft overage (Growth):** prepaid standing balance — tenant may hold up to
   2 active packs that draw down after the monthly quota; UI toggle
   "auto-reminder at 80%". True metered post-pay overage is explicitly
   **out of scope** pending a Creem metered-billing capability check.
6. `usage.aiDraftCredits` summary: `{ planAllowance, packs: {active, credits,
   used}, used, limit, resetsAt }`.
7. SuperAdmin: packs visible in tenant billing view; manual credit grants
   (existing) keep precedence over pack draw-down (they raise the effective
   limit, not the balance — document the distinction).

### WS-E — BYO AI provider gating (Growth/Enterprise) (**shipped 2026-09-29; grandfather migration deferred — see §2.1f**)

Files: `EntitlementService`, tenant LLM config resolution in report generation
(`tenant-own-ai-provider` path), SuperAdmin tenant LLM config UI, web notice.

1. Effective `byoLlmEnabled` from entitlement (GROWTH/ENTERPRISE true;
   overridable per tenant via MANUAL grant partial limits, same as today's
   credit overrides).
2. If a tenant has an enabled LLM config but `byoLlmEnabled = false`:
   ignore the tenant provider for drafting, meter normally, tag the run
   `providerSource: "DONORDESK"`, and surface a one-time admin notice
   ("Your plan drafts with DonorDesk AI; upgrade to Growth to use your own
   provider") + SuperAdmin flag.
3. Existing tenants already configured: grandfather via MANUAL grant
   (`byoLlmEnabled: true`) at migration time — never silently disable a
   working configuration.
4. Update `tenant-own-ai-provider.test.mjs` with the gated path.

### WS-F — Restore the 14-day trial (Team/Growth) (**shipped 2026-09-29 — see §2.1g**)

Files: `ProvisionTenantHandler`, `plan.ts` (`trialDays`, `isPlanForTrial`),
`ExpireLocalTrialsHandler` + Kestra schedule, checkout flow, billing settings
banners, signup web flow.

1. Catalog `trialDays: 14` for TEAM/GROWTH; `isPlanForTrial` returns true for
   TEAM/GROWTH (code path currently hard-false).
2. Signup with `?plan=team|growth` offers **Start 14-day trial** (no card, TRIAL
   grant, `TrialIdentity` fingerprint reactivated for abuse resistance) *or*
   **Subscribe now** (existing checkout path). Google sign-up carries the
   choice through signed OAuth state.
3. TRIAL precedence already sits between CREEM_SUBSCRIPTION and DEFAULT — a
   later paid subscription supersedes; expiry falls back to STARTER preserving
   data (existing semantics, add tests).
4. Re-enable + schedule `ExpireLocalTrialsHandler` (hourly, Kestra) and the
   trial banners in billing settings (dormant code exists).
5. Checkout page shows "trial active — card due at day 14" state; Creem
   subscription is created only on conversion (TRIAL is local-only, matching
   the pre-removal design; `subscription.trialing` webhook mapping stays for
   provider-side trials, unused).
6. Abuse policy: one trial per `TrialIdentity` fingerprint; admins can override
   via SuperAdmin (audited). `NEXT_PUBLIC_TRIALS_ENABLED` gates marketing copy.

### WS-G — Nonprofit discount verification + regional pricing (**backend shipped 2026-09-29; no web UI — see §2.1h**)

1. Verification: NGO registration certificate / equivalent → manual review →
   per-tenant discount applied through Creem discount product **or** MANUAL
   grant with discounted `monthlyPriceUsd` catalog override; actual product/
   price paid persists on the subscription (already the model — discounts
   never change domain limits).
1a. **Submission + review surface (gap — "manual review" had no defined
   surface):** tenant-side upload (billing settings: certificate file +
   registration number, stored as evidence-adjacent object, status
   `PENDING|APPROVED|REJECTED`) and a **SuperAdmin nonprofit-verification
   queue** (list pending submissions, view document, approve → apply
   discount grant, reject → reason recorded, audit-trailed). Without this,
   "manual review" has no queue and nothing to action against; see WS-K.1.
2. Regional/PPP pricing: per-tenant price overrides via existing MANUAL grant
   partial-override mechanism; documented eligibility (low-income-country
   registration per OECD DAC list); no public self-serve in this phase.
3. Support docs: replace the 990-style assumptions; publish "how to qualify"
   on `/pricing` FAQ (done) + support how-to article.

### WS-H — Web & billing UX consistency (**items 1 and 3 already satisfied by WS-A/D/F; item 2 copy-sweep not done — see §2.1i note**)

1. Billing settings page: show new limits (viewers, archived, packs, BYO
   state), top-up purchase, trial/grace banners (mostly existing), upgrade
   paths that reference the **new** numbers.
2. Sweep stale copy: support docs (`key-concepts.md` Plan/Tier section,
   how-to articles), signup wizard, `/v1/billing/summary` examples in docs.
3. `/pricing` page: ship behind `NEXT_PUBLIC_TRIALS_ENABLED` if WS-F lags
   (strip trial CTAs) — see §2 coupling gate.

### WS-I — Enterprise intake + trust surface (**shipped 2026-09-29 — see §2.1i**)

1. Replace the `mailto:` CTA with `/contact-sales` (validated form → email to
   sales via the existing console-email adapter + audit row; spam-protected).
2. Extend `/security` with: tenant RLS description, subprocessors (Creem,
   Google Drive, R2/Cloudflare), data-deletion and export policy, DPA request
   address.
3. Enterprise contract provisioning remains a manual SuperAdmin flow
   (documented follow-up in Feature 19).

### WS-A.7 — Coupling-gate CI guard (new, from audit §2.1)

1. Add a build-time or CI check that fails if the marketing page's hard-coded
   price/credit/floor constants diverge from `PLAN_CATALOG` /
   `PLAN_CATALOG_VERSION` / `ENTERPRISE_PRICE_FLOOR_ANNUAL_USD` — either a
   shared constants module imported by both `apps/web` and
   `packages/domain`, or a dedicated test asserting equality. No such guard
   exists today; the drift documented in §2.1 was caught only by a manual
   audit, not by CI or the deploy pipeline.
2. Commit the currently-uncommitted marketing-release diff
   (`apps/web/src/app/page.tsx`, `apps/web/src/app/signup/SignupForm.tsx`,
   `apps/web/src/app/pricing/`) before any further deploy layers on top of it
   — production is currently ahead of git for this release.

### WS-J — Operational unblock (gates the whole phase) (**operational only — see §2.1j for current status**)

1. **Production Creem:** live products at the §3 prices (2 plans × 2 intervals
   + 2 top-up SKUs — the existing test products carry the old $59/$149 pricing
   and must be replaced, not reused), keys, webhook secret rotation,
   merchant/payout approval — the Feature 19 Phase 0 remainder. *Nothing in
   this phase collects real money before this.*
2. **Kestra schedules:** wire `/internal/billing/reconcile-subscriptions`,
   `/reconcile-storage`, `/release-stale-reservations`, `/retry-inbox`,
   `/expire-trials` (reactivated for WS-F) with alerting.
3. **Phase 6 enforcement rollout** (Feature 19 §16): `ENTITLEMENT_ENFORCEMENT`
   report → per-cohort enforce; metrics: trial→paid conversion, top-up attach
   rate, AI gross margin per plan, over-limit report volume.
4. `REQUIRED_PRISMA_FIELDS` (health allowlist) extended with new models/fields
   in the same PR as the migration (deploy invariant).

### WS-K — SuperAdmin management surface for the new dimensions (**items 1–5, 7 shipped 2026-09-29; item 6 deferred — see §2.1k**)

Feature 19 already shipped SuperAdmin credit grants and the global/per-tenant
tier editor (`memorybank/SUPERADMIN-PORTAL.md` §5/§7). Phase 22 adds several
new resources (viewer seats, archived projects, credit packs, nonprofit
verification, trials, BYO gating) that each need their own SuperAdmin
visibility/control, which was previously only implied piecemeal inside
WS-A/D/E/F/G/I rather than specified as a coherent surface. Consolidating
here:

1. ✅ **Nonprofit verification queue** (from WS-G.1a): pending list, document
   link, approve/reject actions, audit trail. (Rejected/approved history
   filtering not built — the queue lists PENDING only, per §2.1k.)
2. ✅ (partial) **Credit pack management** (extends WS-D.7): per-tenant active
   pack count/remaining-credits visible in the Billing tab. **Not built**:
   comped-pack grant and manual `REFUNDED` override actions — visibility
   shipped, the two write actions did not (see §2.1k).
3. ✅ **Viewer seat override**: the generic tier-editor UI (both the global
   `TierModal` and per-tenant `TenantTierModal`) is confirmed to have been
   missing `viewerSeats`/`aiCreditTopUp`/`byoLlmEnabled` fields entirely
   (exactly the risk this item called out) — now added to both forms.
4. ✅ **Archived-project visibility**: SuperAdmin's tenant billing view now
   shows `(N archived)` next to the active project count.
5. ✅ **Trial controls**: grant/extend/end + fingerprint override, all audited.
6. **Not built — BYO-LLM override visibility**: deferred, see §2.1k.
7. ✅ **Enterprise contract provisioning**: dedicated `ENTERPRISE_CONTRACT`
   grant (distinct from the generic `MANUAL` tier change), floor-enforced
   annual price, explicit contract start/end. Renewal reminder is a manual
   runbook step, as the plan itself specifies.

---

## 5. Data model changes (migrations)

1. `Project`: `status` gains `ARCHIVED` (+ `archivedAt`).
2. `User`/member role: `VIEWER` role value.
3. New `PurchasedCreditPack` table (tenant-RLS protected, `donordesk_app` DML
   grants — same pattern as `ReportArtifact`).
4. `PlanLimitsJson`-shaped columns: no schema change (JSON), but re-run
   `infra/postgres/rls.sql` if any new table/global grants are added.
5. Backfill/one-shot: grandfather allowances for catalog-version cutover
   (WS-A.6) and BYO grandfather grants (WS-E.3).

## 6. API / contract changes (`packages/contracts/src/billing.ts`)

- `BillingSummaryUsage`: `projects { active, archived, limit }`,
  `seats { full, viewers }`, `aiDraftCredits { planAllowance, packs, used,
  limit, resetsAt }`, `trial?: { endsAt }`.
- New: `POST /v1/billing/topup` (checkout intent for a pack SKU),
  `POST /v1/projects/:id/archive|restore`.
- Zod schemas + generated SDK regenerated; OpenAPI updated.

## 7. Enforcement rules summary

| Resource | Rule |
|---|---|
| Projects | count = non-archived only; archive/restore are non-blocking ops |
| Seats | full users (ACTIVE/INVITED/SUSPENDED, excl. viewers) + owner; viewers separate cap |
| Storage | unchanged (managed bytes; Drive links free) |
| AI credits | plan quota → active packs (oldest first) → block (Growth: reminder + prepaid draw-down); failed generations never bill; BYO tenants unmetered |
| BYO LLM | entitlement-gated; ungated tenants fall back to DonorDesk AI with notice |

## 8. Test matrix

- **Domain:** catalog v2 + overrides merge (incl. explicit-null unlimited for
  `viewerSeats`), grant precedence with packs, trial grant/expiry/fallback,
  catalog-version cutover logic.
- **Concurrency (application, parallel):** project creates vs archived set at
  limit; viewer/full seat interleavings at caps; pack draw-down vs monthly
  reset race; failed-draft release across pack boundary.
- **Billing/Creem:** one-off purchase webhook idempotency + replay; top-up
  refund (`REFUNDED` pack zeroing); trial signup → conversion → supersede;
  product allowlist for pack SKUs; signed-redirect grants nothing.
- **API/web:** summary shapes, permission (`billing.manage`) on top-up,
  archive/restore audit, viewer role read-only enforcement (attempt writes →
  403), signup trial vs checkout routing, pricing page renders with/without
  trial flag.
- **SuperAdmin (WS-K):** nonprofit approve/reject applies and reverses the
  discount correctly; comped-pack grant vs purchased-pack distinction holds
  through `usage.aiDraftCredits`; manual pack refund override is audited and
  idempotent; trial grant/extend/end and fingerprint override are audited and
  respect existing precedence (`MANUAL > ... > TRIAL > DEFAULT`); enterprise
  contract grant enforces the floor and custom limits correctly.
- **Regression:** all Feature 19 tests stay green; `artifact-validators` and
  AI-credit metering tests unaffected for BYO (still `billableUnits = 0`).

## 9. Rollout sequence

| Step | Content | Gate |
|---|---|---|
| 1 | WS-J.1 production Creem + merchant approval | real checkout in live mode on a staging tenant |
| 2 | WS-A + WS-B + WS-C + migrations + summary API (+ §2 marketing in same train) | concurrency tests green; `/ready` allowlist updated; grandfather backfill verified |
| 3 | WS-D top-up packs | live one-off purchase E2E |
| 4 | WS-E BYO gate (with grandfather grants) | no tenant silently switched off tenant LLM |
| 5 | WS-F trials + `NEXT_PUBLIC_TRIALS_ENABLED` on | ExpireLocalTrials scheduled; abuse fingerprint verified |
| 6 | WS-G/WS-H/WS-I docs + enterprise intake | copy sweep complete |
| 6a | WS-K SuperAdmin surface (nonprofit queue, pack mgmt, trial controls, enterprise provisioning) | ships alongside the workstream each control belongs to (2-7), not deferred to the end — support/ops cannot operate a resource with no admin surface |
| 7 | WS-J.3 enforcement cohorts + metrics dashboards | kill switch rehearsed |

Rollback: Feature 19 §16 kill switch (`ENTITLEMENT_ENFORCEMENT=report|off`)
plus release-level rollback per `scripts/rollback.sh`; packs and grants are
append-only so rollback never loses purchase state.

## 10. Risks

| Risk | Mitigation |
|---|---|
| Quota cut (100→20, 500→100) churns heavy users | mid-cycle grandfather (WS-A.6); comms template + "your allowance resets next cycle"; top-ups as the pressure valve |
| Marketing/copy drift across catalog, signup, billing, docs | single copy sweep task + one release train for catalog+marketing |
| Trial abuse (fingerprint replay) | reactivated `TrialIdentity` + audited admin override; Creem-side card-required option kept as fallback |
| One-off pack webhooks diverge from subscription semantics | separate model + inbox event type; no entitlement-grant coupling |
| Creem metered billing unavailable | soft overage shipped as prepaid balance; true metering deferred |
| Test-mode → live-mode key mixups | allowlisted hosts/products per mode (existing), deploy checklist item |

## 11. Definition of done

- [ ] Catalog v2 live: 5/20/100 credits, viewer seats, archived exclusion, BYO
      flag — enforced at authoritative write paths with concurrency tests.
- [ ] Top-up packs purchasable in production; pack draw-down explainable from
      the ledger (every credit traceable, per Feature 19 DoD).
- [ ] Trials convert end-to-end (signup → trial → expiry → STARTER fallback →
      paid conversion) with the 7-day-past-due and expiry runbooks updated.
- [ ] BYO-LLM gated with zero silent downgrades (grandfather grants audited).
- [ ] `/pricing`, landing, signup, billing settings, and support docs all
      state identical numbers from one source of truth.
- [ ] SuperAdmin can fully operate every new resource without a DB query:
      nonprofit verification queue, credit-pack view/comp/refund, viewer-seat
      override, archived-project visibility, trial grant/extend/end +
      fingerprint override, BYO-LLM override visibility, Enterprise contract
      provisioning (WS-K).
- [ ] Production Creem live (no test mode), Kestra reconciliation scheduled
      and alerting, enforcement cohort rollout started with metrics.
- [ ] Migrations, typechecks (`pnpm -r typecheck`), builds (`pnpm -r build`),
      and full test matrix pass; `REQUIRED_PRISMA_FIELDS` updated.
