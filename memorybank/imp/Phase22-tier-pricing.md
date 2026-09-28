# Phase 22 — Tier Pricing Overhaul: Catalog, Entitlements, Monetization Features

**Created:** 2026-09-28
**Status:** IN PROGRESS — **WS-A shipped 2026-09-28** (catalog flipped to §3
values in the same change as this status update; see §2.1a). WS-B through
WS-K remain planned.
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
  are code-level types over existing JSON columns, not new Prisma columns);
  WS-A.6's grandfather-allowance migration for existing TEAM/GROWTH
  subscribers crossing the credit-ladder cut has **not** been written yet —
  this must land before `ENTITLEMENT_ENFORCEMENT` is turned on for existing
  paid tenants, or a TEAM tenant using 30 drafts/mo today gets hard-blocked
  the moment enforcement flips.

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

### WS-A — Domain catalog + new limit dimensions (**shipped 2026-09-28 — see §2.1a; item 6 still open**)

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
6. ⏳ **Still open — existing-subscriber cutover policy:** a TEAM tenant at
   20+ drafts this month must not be hard-blocked mid-cycle. On entitlement
   read, if `catalogVersion < 2`-era usage exists, enforce new credit limits
   only from the next UTC month boundary; before that, apply the old quota as
   a time-bounded `GRANDFATHERED` allowance written by a one-shot migration
   handler (mirrors Feature 19 §5.3 pattern). Storage/seats/projects
   unchanged. **This must land before `ENTITLEMENT_ENFORCEMENT` is enabled
   for existing paid tenants** — see §2.1a's "not done" note.

### WS-B — Archived project status (active-only counting)

Files: project domain/entity + repository, `CreateProjectHandler`,
`PrismaProjectRepository` count query, API routes, web project list, billing
summary.

1. Add `ARCHIVED` project status (migration + enum) with `archivedAt`.
2. `POST /v1/projects/:id/archive`, `POST /v1/projects/:id/restore` (audit
   trailed; archived projects are fully readable/exportable, not writable).
3. `maxActiveProjects` enforcement counts only non-archived projects
   (transactional count already exists — change the predicate).
4. Billing summary `usage.projects` reports `{ active, archived, limit }`.
5. Web: archive/restore actions + archived filter in the project list.
6. Concurrency tests: N parallel creates at limit with archived projects in
   play never exceed the cap.

### WS-C — Read-only viewer seats

Files: identity context (role model), invitations, seat enforcement, billing
summary, web member management.

1. New role `VIEWER` (read-only permission set; cannot consume AI credits,
   approve, edit, upload managed evidence; can browse reports/evidence/
   dashboards and export).
2. Seat accounting: `maxSeats` counts owner + `ACTIVE|INVITED|SUSPENDED`
   **non-viewer** users. `viewerSeats` counted separately (`STARTER` 2, others
   null). Invitation acceptance re-checks the viewer cap atomically.
3. `usage.seats` reports `{ full: { used, limit }, viewers: { used, limit } }`.
4. Existing tenants: no migration needed (no viewers exist yet); document that
   converting a full member to viewer frees a paid seat.

### WS-D — AI credit top-up packs + prepaid standing balance

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

### WS-E — BYO AI provider gating (Growth/Enterprise)

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

### WS-F — Restore the 14-day trial (Team/Growth)

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

### WS-G — Nonprofit discount verification + regional pricing

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

### WS-H — Web & billing UX consistency

1. Billing settings page: show new limits (viewers, archived, packs, BYO
   state), top-up purchase, trial/grace banners (mostly existing), upgrade
   paths that reference the **new** numbers.
2. Sweep stale copy: support docs (`key-concepts.md` Plan/Tier section,
   how-to articles), signup wizard, `/v1/billing/summary` examples in docs.
3. `/pricing` page: ship behind `NEXT_PUBLIC_TRIALS_ENABLED` if WS-F lags
   (strip trial CTAs) — see §2 coupling gate.

### WS-I — Enterprise intake + trust surface

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

### WS-J — Operational unblock (gates the whole phase)

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

### WS-K — SuperAdmin management surface for the new dimensions (new)

Feature 19 already shipped SuperAdmin credit grants and the global/per-tenant
tier editor (`memorybank/SUPERADMIN-PORTAL.md` §5/§7). Phase 22 adds several
new resources (viewer seats, archived projects, credit packs, nonprofit
verification, trials, BYO gating) that each need their own SuperAdmin
visibility/control, which was previously only implied piecemeal inside
WS-A/D/E/F/G/I rather than specified as a coherent surface. Consolidating
here:

1. **Nonprofit verification queue** (from WS-G.1a): pending/approved/rejected
   list, document view, approve/reject actions, audit trail.
2. **Credit pack management** (extends WS-D.7): view active/exhausted/
   refunded packs per tenant; manual grant of a comped pack (e.g. goodwill
   credit) distinct from a purchased one — mark `providerOrderId: null`;
   manual `REFUNDED` override for support-driven refunds processed outside
   the Creem webhook path (with reason, audited).
3. **Viewer seat override**: per-tenant `viewerSeats` override through the
   existing partial-limits MANUAL-grant mechanism (WS-A.3) — confirm the
   generic tier-editor UI (WS-A.5) actually renders/persists this field;
   don't assume "generic" coverage without a UI check.
4. **Archived-project visibility**: tenant billing view (WS-D is silent on
   this) shows `{active, archived, limit}` per §6 contract so support can
   diagnose "why can't I create a project" tickets without a DB query.
5. **Trial controls** (from WS-F.6): SuperAdmin action to grant a trial
   outside the normal signup flow, extend/end an active trial, and override
   the `TrialIdentity` abuse fingerprint for a specific tenant — all audited.
   WS-F.6 required the audit but never specified where the action lives.
6. **BYO-LLM override visibility**: when WS-E.2's one-time admin notice
   fires (tenant has a configured provider but `byoLlmEnabled=false`), the
   existing SuperAdmin tenant LLM config UI (WS-E.1) should surface that
   state directly next to the config, not require cross-referencing
   entitlements separately.
7. **Enterprise contract provisioning**: Phase 22 (WS-I.3) and Feature 19
   (§16 Phase 0) both defer this to "a manual SuperAdmin flow" without
   specifying one. Minimum surface: create an `ENTERPRISE_CONTRACT`
   entitlement grant with custom `PlanLimits` override and a floor-enforced
   annual price, set contract start/end, and a renewal-reminder record (even
   if the reminder itself is a manual runbook step in this phase, not an
   automated job).

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
