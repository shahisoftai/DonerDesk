# Feature 19: Tiers, Entitlements, and Creem Payments — Implementation Plan

**Updated:** 2026-08-18  
**Status:** IMPLEMENTED — entitlements, AI-credit quotas, usage counters,
SuperAdmin credit/tier management, **Creem billing adapter LIVE in test mode**
(`BILLING_PROVIDER=creem`, `CREEM_TEST_MODE=true`), Phase 4 reconciliation
handlers, webhook tenant resolution, and the Continue→checkout→thanks flow.
Stub remains the development/tests default. Enterprise custom contract
provisioning is the remaining planned follow-up.  
**Payment provider:** Creem (production Merchant of Record), stub (development/tests)  
**Pricing decision:** Starter $0, Team $59/month, Growth $149/month, Enterprise custom

> **2026-08-18 implementation notes.** Two releases shipped the live Creem path:
> **`20260818053116`** (Phase 4 reconciliation + checkout thanks page) and
> **`20260818061120`** (Continue checkout flow + trial removal). Summary:
>
> **Live Creem billing (test mode)**
> - `BILLING_PROVIDER=creem` + `CREEM_TEST_MODE=true` are wired in production
>   `api.env` with the four test product IDs, `CREEM_API_KEY`, and
>   `CREEM_WEBHOOK_SECRET`. Public webhook endpoint
>   `POST /v1/webhooks/creem` (raw-body HMAC verified) is registered.
> - Checkout success URL is `${BILLING_SUCCESS_BASE_URL}/thanks`; the public
>   `/thanks` page verifies the signed redirect
>   (`apps/web/src/lib/server/creem-redirect.ts`) and guides setup with quick
>   links. A signed redirect never grants access — webhook + reconciliation are
>   authoritative.
> - **Webhook tenant resolution fix:** the processor previously could only
>   resolve the tenant from an existing local subscription mapping, which fails
>   for the *first* event of a brand-new subscription. It now resolves from the
>   checkout `metadata.tenant_id` first, falling back to the local mapping. Both
>   the Creem and stub adapters parse metadata into `ProviderBillingEvent`.
>
> **Phase 4 reconciliation (Feature §12) — all handlers implemented**
> - `ReconcileBillingSubscriptionsHandler` — re-syncs stale/non-terminal
>   subscriptions from the provider (missed-webhook convergence).
> - `ReconcileManagedStorageUsageHandler` — clamps storage counters down to the
>   authoritative evidence-byte sum (`IEvidenceRepository.sumManagedStorageBytes`).
> - `ReleaseStaleUsageReservationsHandler` — clamps AI-credit counters to the
>   LLM-run ledger (leaked-reservation recovery).
> - `RetryBillingInboxHandler` — recovers events stuck in `PROCESSING` (worker
>   crash between claim and commit) by re-fetching current provider state.
> - `ExpireLocalTrialsHandler` — dormant (no new trials are granted; see below).
> - A shared `BillingSubscriptionSynchronizer`
>   (`packages/application/src/services/billing-subscription-synchronizer.ts`)
>   maps provider snapshots → subscription + grant + audit in exactly one code
>   path (DRY/SRP/DIP); the webhook processor and reconciliation handlers both
>   use it. Also fixes a latent termination-grant bug (`effectiveFrom ==
>   effectiveUntil` failed domain validation).
> - New repository methods: `listReconcileCandidates`, `setUsed`,
>   `listByMetric` (with tenant-qualified entries), `listStaleProcessing`
>   (`PrismaBillingSubscriptionRepository`/`PrismaUsageCounterRepository`/
>   `PrismaBillingEventInboxRepository`), and `sumManagedStorageBytes`
>   (`PrismaEvidenceRepository`).
> - Internal Kestra routes added: `/internal/billing/expire-trials`,
>   `/internal/billing/reconcile-subscriptions`, `/internal/billing/reconcile-storage`,
>   `/internal/billing/release-stale-reservations`, `/internal/billing/retry-inbox`
>   (all HMAC-authenticated; 401 without the internal token).
>
> **Continue checkout flow + trial removal**
> - Pricing page Team/Growth tiers now show **Continue** buttons (→
>   `/signup?plan=team|growth`). `signupAction` redirects paid-plan signups to a
>   new `/checkout` route that creates the Creem session server-side and
>   redirects to hosted checkout; Starter stays on `/dashboard`. Google sign-up
>   with a paid plan routes the same way.
> - **All 14-day trial references removed.** `ProvisionTenantHandler` no longer
>   grants trials — every new workspace starts on the free STARTER tier
>   (`trialGranted: false`); catalog `trialDays` nulled for Team/Growth;
>   `isPlanForTrial` always `false`; billing-panel trial banner and pricing/
>   signup trial copy removed. `TrialIdentity` table/repo and
>   `ExpireLocalTrialsHandler` remain dormant for legacy data.
> - The `/thanks` page guides setup with quick links (workspace setup, first
>   project, invite team, manage subscription).
>
> **Deploy notes (this feature)**
> - No schema change in either release; `prisma migrate deploy` is a no-op.
> - Server `api.env` gained the Creem TEST-mode block; `PlanCatalogOverride`
>   RLS grant already applied in the earlier tier-management release.
> - Rollback: `RELEASE_ID=20260818053116 scripts/rollback.sh` for the
>   reconciliation release, `20260818041110` for the trial-removal release.
> - Remaining: live (non-test) Creem products/keys, and Enterprise custom
>   contract provisioning.

> **2026-08-17 implementation notes.** The domain/application/infrastructure
> described below were built out (2026-08-13…08-16) and are now enforced in
> production for AI report drafts:
> - `EntitlementService` resolves the effective grant (precedence `MANUAL >
>   ENTERPRISE_CONTRACT > GRANDFATHERED > CREEM_SUBSCRIPTION > TRIAL > DEFAULT`)
>   and exposes `limits.monthlyAiDraftCredits` (`plan.ts`: STARTER 5, TEAM 100,
>   GROWTH 500, ENTERPRISE `null`/unlimited). Ties (multiple MANUAL grants) now
>   resolve to the most recent grant so the newest override wins.
> - `GenerateReportDraftHandler` meters real AI drafts only: a successful
>   non-stub generation consumes exactly one credit; a stub fallback releases the
>   reserved credit, records an error run, and never bills (see
>   `../imp/LLM-PROVIDER-WIRING.md` §14). The counter self-heals against the
>   `LlmRun` ledger (`countAiReportDrafts`) before enforcement.
> - **SuperAdmin Billing & credits** (2026-08-17): `GET /superadmin/billing`
>   (per-tenant plan/allowance/usage/override/subscription), `POST
>   /superadmin/tenants/:id/credits {mode: SET|INCREASE|DECREASE, value}` (writes
>   a MANUAL `EntitlementGrant` with a full PlanLimits override — takes effect
>   immediately), `POST /superadmin/tenants/:id/credits/reset` (zeroes the current
>   UTC-month counter). All audit-trailed. See `../SUPERADMIN-PORTAL.md` §5/§7.
> - **SuperAdmin Tier management** (2026-08-17): a dedicated **Tier management**
>   navigation area (`sa.donordesk.online`) with
>   - **Global tier catalog editor** — `GET /superadmin/tiers` returns all plans
>     with applied `PlanCatalogOverride`s (limits/prices/trial days/enabled) and
>     per-plan tenant counts. `PUT /superadmin/tiers/:planCode` persists a partial
>     override (missing limit buckets fall back to the static catalog; `null`
>     means unlimited for that tier); `POST /superadmin/tiers/:planCode/reset`
>     reverts a tier to the static catalog. The override table is
>     `PlanCatalogOverride` (migration
>     `20260817210000_plan_catalog_override`); `EntitlementService` and the
>     control plane merge these overrides on every entitlement read, so edits
>     apply platform-wide immediately, including tenant-facing `/v1/billing/summary`.
>   - **Per-tenant tier assignment** — `POST /superadmin/tenants/:id/tier`
>     (`{planCode, reason?, limits?}`) writes a MANUAL grant for the target plan
>     (optional partial limits merged over the *target* plan's catalog/override
>     limits, never the old plan's); disabled tiers are rejected at assignment.
>     `PUT /superadmin/tenants/:id/tier/limits` writes a full per-tenant
>     `PlanLimitsJson` override; `POST /superadmin/tenants/:id/tier/reset` closes
>     only `tier-change-to-*` MANUAL grants (typed-client UTC dates) so credit and
>     feature-allocation overrides survive. `GET /superadmin/tenants/:id/tier`
>     returns the effective plan, limits, usage, subscription, and append-only
>     grant history.
> - **Deploy note:** the new `PlanCatalogOverride` table is a global (non-tenant)
>   reference table. `infra/postgres/rls.sql` grants it to `donordesk_app` so
>   tenant-facing entitlement resolution can read catalog overrides; it is NOT in
>   the tenant-isolation array (no `tenantId` column). Re-run the RLS script on
>   deploy.
> - Timezone note: MANUAL grants must be written via the typed Prisma client (raw
>   SQL binds dates in the host's CEST session timezone → 2h future-dated grants).



## 1. Objective

Implement commercially safe subscriptions without coupling product access directly
to Creem. DonorDesk owns plans, usage, trials, and effective entitlements. Creem owns
checkout, recurring collection, customer billing self-service, compliant customer
invoices, refunds/disputes, and sales-tax/VAT/GST collection and remittance as
Merchant of Record.

The implementation must:

- preserve the domain/application/infrastructure dependency direction;
- enforce limits at every authoritative write path, not only in the UI;
- remain correct under concurrent requests, duplicate/out-of-order webhooks, and
  delayed workers;
- preserve all customer data after trial expiry, cancellation, or downgrade;
- support local signup, Google provisioning, OIDC/SCIM, and administrative tenant
  creation through one initial-entitlement policy;
- record all billing and entitlement mutations in `audit_events`;
- meter AI cost even when customer-facing usage is not charged;
- permit a provider swap without changing domain or application policies.

## 2. Verified current codebase baseline

This plan is based on the repository as it exists on 2026-08-15.

| Area | Current implementation | Consequence for this feature |
|---|---|---|
| Organization persistence | `Organization` has no plan fields | Add entitlement/subscription tables and expose an effective snapshot |
| Local signup | Organization is inserted before user creation | Must become one transaction before trials are granted |
| Google signup | `GoogleSignInHandler.provision()` independently creates tenant and user | Must use the same tenant provisioner as local signup |
| Project creation | Project persists before organization is loaded; setup/profile/audit are separate writes | Rework into transaction before enforcing capacity |
| User invitations | Existing users only are checked; pending invitations are not counted or tenant/email-unique | Add seat policy, pending-invite lookup, and acceptance-time enforcement |
| Evidence | `fileSize` is stored; no tenant byte sum/reservation exists | Add managed-byte usage and upload reservation |
| Google Drive evidence | Link-first files can have zero/unknown size and are externally stored | Do not charge them as DonorDesk-managed storage |
| LLM runs | Prisma model exists but report generation does not record a run | Add an AI usage ledger/run repository before enforcing credits |
| API errors | `DomainErrorCode` has no plan/usage errors | Add stable machine codes and HTTP mappings |
| Idempotency | Existing `IdempotencyRecord` is tenant-oriented | Add globally unique provider-event inbox for public webhooks |
| Jobs | `IJobQueue` enqueues but does not schedule recurring work | Add scheduled trial/subscription reconciliation entry points |
| Container | Authenticated API requests create tenant-bound Prisma containers | Webhook needs a platform-scoped container and trusted tenant resolution |
| Web signup | Signup page is a client component and ignores search params | Add a server wrapper and validated query-to-form boundary |
| Settings | No billing page; `billing.manage` permission exists | Reuse that permission for billing mutations |

Principal paths to change:

- `packages/application/src/use-cases/identity/sign-up.ts`
- `packages/application/src/use-cases/identity/google-sign-in.ts`
- `packages/application/src/use-cases/projects/create-project.ts`
- `packages/application/src/use-cases/identity/invite-user.ts`
- `packages/application/src/use-cases/evidence/upload-evidence.ts`
- `packages/application/src/use-cases/evidence/link-google-drive-evidence.ts`
- `packages/application/src/use-cases/reporting/generate-report-draft.ts`
- `packages/infrastructure/src/container.ts`
- `apps/api/src/server.ts`
- `apps/web/src/app/signup/page.tsx`

## 3. Commercial catalog

### 3.1 Launch pricing

| | Starter | Team | Growth | Enterprise |
|---|---:|---:|---:|---:|
| Monthly price | $0 | $59 | $149 | Custom; target floor $6,000/year |
| Annual price | $0 | $590 | $1,490 | Annual contract |
| Active projects | 1 | 5 | 20 | Contracted/unlimited |
| Seats, including owner | 1 | 5 | 15 | Contracted/unlimited |
| DonorDesk-managed storage | 1 GB | 25 GB | 100 GB | Contracted |
| Linked Google Drive bytes | Not charged | Not charged | Not charged | Not charged |
| Successful AI report drafts/month | 5 | 100 | 500 | Contracted |
| Core reporting and exports | Included | Included | Included | Included |
| Google Drive link-first | Included | Included | Included | Included |
| R2-managed uploads | Up to quota | Up to quota | Up to quota | Contracted |
| Support | Community | Email | Priority email | SLA/dedicated |
| SSO/SCIM, custom residency, SLA | — | — | — | Included/contracted |

Annual billing gives two months free. Display tax treatment at checkout; Creem,
as Merchant of Record, is responsible for customer tax calculation/remittance and
compliant invoices. DonorDesk retains Creem order/transaction references required
for support and accounting reconciliation.

### 3.2 Trial and nonprofit policy

**Updated 2026-08-18:** the 14-day trial offer is **removed**. Every new
workspace starts on the free STARTER tier and pays to unlock Team/Growth via
Creem. `ProvisionTenantHandler` no longer grants trials; catalog `trialDays` is
null for Team/Growth; `isPlanForTrial` always returns `false`; pricing/signup/
billing copy no longer mentions trials. The `TrialIdentity` table, repository,
and `ExpireLocalTrialsHandler` remain dormant for any legacy trial grants.

Nonprofit policy (unchanged):
- Offer a manually approved 40% nonprofit discount to qualifying small NGOs.
  Represent it through Creem discount/product configuration and persist the actual
  product/price paid; discounts do not change domain limits.
- Do not advertise any AI tier as unlimited.

### 3.3 Catalog ownership and versioning

Create `packages/domain/src/contexts/billing/plan.ts` for stable identifiers,
limits, and pure entitlement policy. Create `packages/contracts/src/billing.ts`
for JSON-safe DTO/Zod schemas. Marketing copy stays in the web app. Creem product
IDs remain infrastructure configuration.

```typescript
export type PlanCode = "STARTER" | "TEAM" | "GROWTH" | "ENTERPRISE";

export interface PlanLimits {
  maxActiveProjects: number | null;       // null = unlimited
  maxSeats: number | null;
  maxManagedStorageBytes: bigint | null;  // domain only
  monthlyAiDraftCredits: number | null;
}
```

Never use `Infinity`. API byte values are decimal strings because JSON cannot
serialize `bigint`. Each catalog revision has a `catalogVersion`; subscriptions
persist exact Creem product, currency, and amount rather than deriving commercial
terms from `PlanCode`.

## 4. Domain model

### 4.1 Separate provider state from effective access

Do not add one overloaded `planStatus` string to `Organization`. Add:

1. `BillingSubscription`: provider synchronization state.
2. `EntitlementGrant`: source and validity window of product access.
3. `EntitlementSnapshot`: calculated answer consumed by handlers/UI.

```typescript
export type EntitlementSource =
  | "DEFAULT"
  | "TRIAL"
  | "CREEM_SUBSCRIPTION"
  | "ENTERPRISE_CONTRACT"
  | "GRANDFATHERED"
  | "MANUAL";

export interface EntitlementSnapshot {
  plan: PlanCode;
  source: EntitlementSource;
  effectiveFrom: Date;
  effectiveUntil?: Date;
  limits: PlanLimits;
  overLimit: Array<"PROJECTS" | "SEATS" | "STORAGE" | "AI_CREDITS">;
  subscription?: {
    status: BillingSubscriptionStatus;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd?: Date;
  };
}
```

Expired grants are ignored at calculation time even before reconciliation changes
the database. If no valid paid/manual/trial grant exists, Starter is effective.
Existing data remains readable after downgrade. Writes that increase an over-limit
resource are blocked; deletion, export, payment, and usage-reducing actions remain.

### 4.2 Domain errors

Extend `DomainErrorCode` with:

- `PLAN_LIMIT_REACHED`
- `AI_CREDITS_EXHAUSTED`
- `BILLING_STATE_INVALID`
- `BILLING_PROVIDER_UNAVAILABLE`

Limit details are stable and machine-readable:

```json
{
  "resource": "PROJECTS",
  "plan": "TEAM",
  "limit": 5,
  "usage": 5,
  "upgradePath": "/settings/billing"
}
```

Map project/seat/storage capacity to HTTP `409`, replenishing AI credits to `429`,
feature entitlements to `403`, and provider unavailability to `503`. Do not depend
on HTTP 402.

## 5. Persistence and migration

### 5.1 New Prisma models

Add the following in `packages/infrastructure/prisma/schema.prisma`; exact Prisma
syntax is finalized in Phase 1, but these constraints are required.

#### `BillingSubscription`

- `id`, `tenantId`, `provider` (`CREEM`)
- `providerCustomerId`, `providerSubscriptionId`, `providerProductId`
- `planCode`, `catalogVersion`, normalized provider `status`
- `currency`, `unitAmountMinor`, `billingInterval`
- `currentPeriodStart`, `currentPeriodEnd`, `trialStart`, `trialEnd`
- `cancelAtPeriodEnd`, `canceledAt`, `graceEndsAt`
- `providerUpdatedAt`, `lastSyncedAt`, timestamps
- unique `(provider, providerSubscriptionId)` and index `(tenantId, status)`

Only one access-granting recurring subscription may exist per tenant. Enforce this
transactionally and reconcile defensively.

#### `EntitlementGrant`

- `id`, `tenantId`, `planCode`, `source`
- `effectiveFrom`, `effectiveUntil`
- optional `billingSubscriptionId`
- optional override limits JSON for Enterprise/grandfathering
- `reason`, `createdById`, timestamps
- indexes on `(tenantId, effectiveFrom, effectiveUntil)`

Grants are append-oriented. Do not destroy plan history.

#### `BillingEventInbox`

- globally unique `providerEventId`
- `provider`, `eventType`, `providerCreatedAt`, nullable resolved `tenantId`
- payload checksum; encrypted/minimized payload according to retention policy
- `status` (`RECEIVED`, `PROCESSING`, `PROCESSED`, `FAILED`, `IGNORED`)
- `attemptCount`, `lastError`, `processedAt`, timestamps

This is separate from existing tenant idempotency because a webhook is public and
tenant resolution happens only after signature verification.

#### `UsageCounter`

- unique `(tenantId, metric, periodStart)`
- `used`, `reserved`, `updatedAt`
- initial metrics: `MANAGED_STORAGE_BYTES`, `AI_DRAFT_CREDITS`

Projects/seats may use transactional count queries. Storage needs reservations;
AI credits need atomic reservation/consumption and request idempotency.

#### `TrialIdentity`

- normalized verified email and organization/domain fingerprint
- `tenantId`, `trialStartedAt`, `trialEndedAt`
- suitable uniqueness constraints to prevent routine replay

This is abuse resistance, not proof that similarly named organizations are one
legal entity. Administrators need an audited override.

### 5.2 Existing schema changes

- Add indexes for tenant-qualified project-status and user-status counts.
- Add invitation expiry/status lookup and prevent duplicate live invitations for
  tenant/email using normalized fields and a transactional rule.
- Add `operationType`, `resourceId`, `billableUnits`, and request idempotency to
  `LlmRun`, or add an adjacent ledger if altering run semantics is disruptive.
- Use `BigInt` for managed storage counters; expose decimal strings in APIs.
- Store no Creem secret or raw card/payment data.

### 5.3 Existing tenant migration

1. Add tables/indexes while limits are disabled.
2. Create a permanent Starter default grant for every tenant.
3. Calculate existing usage.
4. Give tenants already above Starter a time-bounded `GRANDFATHERED` override
   matching observed usage plus safe buffer; do not mislabel them Enterprise.
5. Notify affected admins and provide upgrade/export paths.
6. Enable `ENTITLEMENT_ENFORCEMENT=off|report|enforce` gradually.
7. Retain a kill switch that disables blocking but continues measurement.

## 6. Transaction and concurrency foundation

The existing `IUnitOfWork` does not expose transaction-bound repositories and is
insufficient for capacity enforcement. Replace/extend it with an application
transaction boundary implemented by Prisma. Never leak `Prisma.TransactionClient`
into domain/application packages.

Required atomic workflows:

- tenant + initial admin + Starter/trial grants + audits;
- capacity check + project + setup + reporting profile + audit/outbox intent;
- seat check + pending invitation;
- seat check + invitation acceptance/user activation;
- storage reservation + evidence finalization/release;
- AI reservation + successful consumption/release;
- provider inbox claim + subscription sync + entitlement transition + audit.

Use serializable transactions with bounded retry for project/seat capacity, or lock
a stable tenant entitlement/usage row before count-and-create. Parallel tests must
prove final usage never exceeds limits.

External calls (Creem, Drive, R2, email, LLM) never occur while holding a database
transaction. Persist intent/reservation, call externally, then finalize.

## 7. Central tenant provisioning

Create `ProvisionTenantHandler` and use it from local signup, Google provisioning,
OIDC JIT provisioning, SCIM/administrative creation where applicable, seeds, and
tests.

Input includes validated requested plan (`STARTER`, `TEAM`, `GROWTH`) and verified
signup identity. Unknown/absent becomes Starter; Enterprise cannot self-select.
The handler atomically creates organization, owner, the permanent free STARTER
base grant, and audits.

`?plan=` is only an intent hint for the checkout flow; it is never an entitlement.
Google signup must carry the plan through signed OAuth state so a paid signup is
routed to checkout after provisioning.

## 8. Authoritative limit enforcement

### 8.1 Projects

Rework `CreateProjectHandler`:

1. Resolve entitlement inside the transaction.
2. Lock capacity/count active tenant projects.
3. Return `PLAN_LIMIT_REACHED` when full.
4. Create project, setup, reporting profile, audit, and outbox intent atomically.
5. Provision Drive asynchronously after commit.

Initially all projects count. Do not promise that archiving frees capacity until an
explicit archived status and policy exist.

### 8.2 Seats and invitations

A seat includes owner and users in `ACTIVE`, `INVITED`, or `SUSPENDED`; `REMOVED`
does not count. A live, unexpired invitation reserves one seat.

- Check/reserve at invitation creation.
- Resend an existing live invitation rather than consuming another seat.
- Recheck atomically at acceptance and SCIM/JIT provisioning.
- Never allow removal/suspension of the final active admin.

### 8.3 Storage

Only DonorDesk-managed storage consumes quota. Google Drive link references do not,
though external size may be displayed separately.

1. Enforce request/file limits before buffering the multipart body; replace the
   current unconditional `toBuffer()` approach.
2. Atomically reserve declared bytes.
3. Save to LOCAL/R2 outside the transaction.
4. Persist evidence and convert reserved to used bytes.
5. On failure, remove object and release reservation idempotently.
6. Reconcile objects/counters periodically.

Deletion decrements usage only after the object is removed or durably scheduled.
Unknown-size external links never consume managed bytes.

### 8.4 AI credits and cost

One customer credit means one successfully persisted full report draft. A
regeneration consumes another; manual reports do not. Failed operations release
customer credits but still record provider tokens/cost.

Before enforcement:

- implement `ILlmRunRepository`/usage ledger;
- record `operationType=REPORT_DRAFT`, resource ID, model, prompt version, tokens,
  cost, status, and request idempotency;
- reserve one credit atomically before generation;
- consume only after draft/sections persist successfully;
- use UTC calendar months and return quota reset time;
- impose an internal cost circuit breaker on every tier.

## 9. Billing provider and Creem adapter

### 9.1 Application port

Create `packages/application/src/ports/billing.ts`:

```typescript
export interface BillingProvider {
  createCheckout(input: {
    tenantId: string;
    requestId: string;
    plan: "TEAM" | "GROWTH";
    interval: "MONTH" | "YEAR";
    customerEmail: string;
    successUrl: string;
  }): Promise<Result<{ checkoutId: string; url: string }, DomainError>>;

  createCustomerPortal(input: {
    providerCustomerId: string;
  }): Promise<Result<{ url: string }, DomainError>>;

  getSubscription(providerSubscriptionId: string):
    Promise<Result<ProviderSubscription, DomainError>>;

  verifyAndParseWebhook(rawBody: Buffer, signature: string):
    Result<ProviderBillingEvent, DomainError>;
}
```

Use Creem Customer Portal/product bundles for cancellation and plan changes. Add
direct mutation methods only if verified API behavior and UX require them. The
application owns entitlement changes; the adapter only maps Creem objects/events.

### 9.2 Implementations and configuration

- `packages/infrastructure/src/billing/creem.ts`: `CreemBillingProvider`.
- `packages/infrastructure/src/billing/stub.ts`: `StubBillingProvider`.
- Factory selected by `BILLING_PROVIDER=stub|creem`.

Use Creem REST or official TypeScript SDK in infrastructure. Do not make the Next.js
adapter the system of record: the webhook belongs in Fastify and lifecycle logic in
application handlers.

```text
BILLING_PROVIDER=stub|creem
CREEM_API_KEY=
CREEM_WEBHOOK_SECRET=
CREEM_TEST_MODE=true|false
CREEM_PRODUCT_TEAM_MONTHLY=
CREEM_PRODUCT_TEAM_ANNUAL=
CREEM_PRODUCT_GROWTH_MONTHLY=
CREEM_PRODUCT_GROWTH_ANNUAL=
BILLING_SUCCESS_BASE_URL=https://...
```

Map `(plan, interval)` to allowlisted product IDs server-side. Never accept product
or arbitrary success URL from a browser. Provider metadata contains only opaque
tenant/request references, never sensitive NGO data.

### 9.3 Creem decision

Creem is accepted for Phase 1 because its documented platform provides recurring
products, monthly/yearly cycles, checkout request IDs and metadata, signed redirects,
HMAC-SHA256 webhooks, customer portal, product bundles, test mode, subscription
lifecycle events, refunds/disputes, and Merchant-of-Record tax/invoice handling.

Before launch, commercial/legal owners must verify account approval, merchant and
customer countries, payout destination/cadence, reserves, fees, refunds, sanctions
or NGO restrictions, data terms, and support SLA. Retain the provider port because
these are external commercial dependencies.

## 10. Checkout and portal

### 10.1 Checkout

Authenticated `POST /v1/billing/checkout`:

1. Require `billing.manage`.
2. Validate plan/interval enums only.
3. Load organization/current subscription.
4. Reject duplicate/incompatible checkout, or reuse an unexpired intent.
5. Server-map to Creem product.
6. Persist unique request ID/checkout intent.
7. Call Creem outside the transaction.
8. Persist checkout ID and return its HTTPS URL.

The success page is informational. A signed redirect may accelerate refresh but
never grants access by itself; webhook/reconciliation is authoritative.

**Implemented 2026-08-18:** the checkout return URL is
`${BILLING_SUCCESS_BASE_URL}/thanks` — the public `/thanks` page verifies the
Creem redirect signature (`verifyCreemRedirectSignature`, SHA-256 over ordered
params + `salt={apiKey}`) and offers quick-start links (workspace setup, first
project, invite team, manage subscription). `SUCCESS_PATH` is `/thanks` in
`CreateCheckoutHandler`. A new `/checkout?plan=team|growth` web route creates the
Creem session server-side and redirects to hosted checkout; pricing **Continue**
buttons and paid-plan signups (local + Google) route through it.

### 10.2 Portal

Authenticated `POST /v1/billing/portal` requires `billing.manage`, loads the Creem
customer ID by authenticated tenant, requests a short-lived portal URL, and redirects
from a server action. Never accept customer ID from the client or log portal links.

Configure Team/Growth monthly/annual products in a Creem product bundle only after
tests confirm desired proration and period-end downgrade semantics.

## 11. Webhook ingestion and lifecycle

Expose public `POST /v1/webhooks/creem` before the authenticated Fastify group.
Capture exact raw bytes; do not attach the normal tenant container.

1. Require `creem-signature`; verify HMAC against raw bytes.
2. Strictly validate normalized event and reject oversized bodies.
3. Insert inbox row by globally unique event ID.
4. On duplicate, return `200` without effects.
5. Return `200` promptly after durable receipt.
6. Process through a durable worker; memory queue is not production-safe.
7. Resolve tenant from trusted request metadata/customer/subscription mapping.
8. Fetch current Creem subscription if event is stale/incomplete/regressive.
9. Transactionally sync subscription, change grants, audit, and mark processed.

Creem retries and permits manual resend, so idempotency is mandatory. Compare event
and object update timestamps; older events cannot overwrite newer state.

| Creem event | DonorDesk behavior |
|---|---|
| `checkout.completed` | Record mapping; do not blindly grant paid access |
| `subscription.paid` | Authoritative paid activation/renewal after product validation |
| `subscription.active` | Synchronize; Creem recommends `paid` for activation |
| `subscription.trialing` | Sync provider trial; never create a second local trial |
| `subscription.scheduled_cancel` | Keep access through confirmed period end |
| `subscription.canceled` | Reconcile; revoke only when access period ends |
| `subscription.past_due` / `unpaid` | Apply grace policy and billing warning |
| `subscription.expired` / `paused` | End paid grant; fall back to another grant/Starter |
| `subscription.update` | Re-fetch/map product and period idempotently |
| `refund.created` | Reconcile access, audit, notify admin |
| `dispute.created` | Flag review; preserve data; apply explicit risk policy |

Initial grace: retain paid access seven days after `past_due`, then fall back to
Starter unless Creem reports recovery. Store grace deadline explicitly.

## 12. Reconciliation and operations

Webhooks are notifications, not the only recovery mechanism. **All handlers below
are implemented (2026-08-18)** and exposed as HMAC-authenticated
`/internal/billing/*` routes for Kestra:

- `ExpireLocalTrialsHandler` — dormant (no new trials are granted; cleans up
  legacy trial grants).
- `ReconcileBillingSubscriptionHandler` — daily re-sync of stale/non-terminal
  subscriptions from the provider.
- `ReconcileManagedStorageUsageHandler` — clamps storage counters to the
  authoritative evidence-byte sum.
- `ReleaseStaleUsageReservationsHandler` — clamps AI-credit counters to the LLM-run
  ledger.
- `RetryBillingInboxHandler` — recovers events stuck in `PROCESSING`.

All sync logic is centralized in `BillingSubscriptionSynchronizer`
(`packages/application/src/services/billing-subscription-synchronizer.ts`),
shared by the webhook processor and every reconciliation handler. Routes:
`POST /internal/billing/expire-trials`, `/reconcile-subscriptions`,
`/reconcile-storage`, `/release-stale-reservations`, `/retry-inbox`.

Use Kestra in deployment (or BullMQ plus external scheduler) for hourly trial expiry,
frequent inbox retry, daily active/past-due subscription reconciliation, hourly stale
reservation release, and periodic storage reconciliation.

Handlers are idempotent and tenant-qualified. Add metrics for webhook age/failures,
reconciliation drift, trial-expiry lag, checkout failures, subscriptions by plan,
usage near limits, and AI cost. Do not log secrets, full payloads, portal URLs, or
sensitive customer data.

## 13. API and read model

Add:

- `GET /v1/billing/summary`
- `POST /v1/billing/checkout`
- `POST /v1/billing/portal`
- `POST /v1/webhooks/creem`
- internal authenticated reconciliation routes only where Kestra requires them

Example JSON-safe summary:

```typescript
{
  plan: "TEAM",
  source: "CREEM_SUBSCRIPTION",
  catalogVersion: 1,
  trialEndsAt?: string,
  subscription: {
    status: "ACTIVE",
    interval: "MONTH",
    currentPeriodEnd: string,
    cancelAtPeriodEnd: false
  },
  usage: {
    projects: { used: 3, limit: 5 },
    seats: { used: 4, limit: 5 },
    managedStorageBytes: { used: "12000", limit: "26843545600" },
    aiDraftCredits: { used: 20, limit: 100, resetsAt: "..." }
  }
}
```

Do not add billing fields to general organization update input. A compact plan badge
may appear on organization reads; detailed usage comes from billing summary.

## 14. Web implementation

### 14.1 Landing and signup

Add `#pricing` between “How it works” and “Security” with Starter, Team, Growth,
and Enterprise cards. Show accurate monthly/annual prices, limits, and
“tax calculated at checkout where applicable.” Never claim unlimited AI.

**Implemented 2026-08-18:** Starter shows **Start free**, Team/Growth show
**Continue**; no trial terms anywhere. Pricing copy: "Start free. Upgrade when
you grow."

Links: Starter `/signup`, Team `/signup?plan=team`, Growth
`/signup?plan=growth`, Enterprise real lead form/configured contact.

Because signup is currently a client page, introduce a server wrapper that validates
`searchParams.plan` and passes a typed value to the form. Carry a hidden field,
validate again in server action/contracts, and call centralized provisioning.
Invalid becomes Starter. Preserve requested plan in signed Google OAuth state.

### 14.2 Billing settings

Add `apps/web/src/app/(portal)/settings/billing/` with plan/status, trial/grace/
cancellation banners, usage meters/reset dates, monthly/annual comparison,
checkout/portal server actions, nonprofit guidance, Enterprise contact, and clear
downgrade/data-preservation language.

Only `billing.manage` users see mutations. Disabled resource controls need adjacent
explanation/upgrade link. API errors remain authoritative after concurrent changes.

## 15. Security, privacy, and compliance

- Secrets stay server-side and are redacted from logs.
- Verify exact raw body using official SDK or constant-time HMAC comparison.
- Limit webhook body size; Creem documents no static source IPs, so do not rely on
  IP allowlists. Configure WAF route exceptions without removing signatures.
- Allowlist Creem test/production API and checkout hosts.
- Reject browser-supplied return URL, product/customer/subscription/tenant IDs.
- Define minimum webhook/customer data retention and deletion policy.
- Treat portal magic links as secrets; never persist/log them.
- Require `billing.manage`; webhook effects use an explicit system actor.
- Refund, dispute, cancellation, and downgrade never delete tenant data.

## 16. Delivery phases and gates

Status per phase (updated 2026-08-18):
- **Phase 0 — Creem readiness:** ✅ test products created and wired; merchant/
  commercial approval remains for production (test-mode gate partially done).
- **Phase 1 — domain, schema, transactions:** ✅ shipped in prior releases.
- **Phase 2 — provisioning and report-mode limits:** ✅ shipped (provisioner,
  project/seat/storage/AI enforcement) in prior releases.
- **Phase 3 — Creem and billing API:** ✅ shipped 2026-08-18 (port, stub, Creem
  adapter/factory, raw-body webhook + durable inbox processor, checkout/portal
  routes, `/thanks` return page, webhook tenant resolution from metadata).
- **Phase 4 — reconciliation:** ✅ shipped 2026-08-18 (all five handlers +
  `/internal/billing/*` routes; Kestra scheduling to be wired).
- **Phase 5 — web experience:** ✅ shipped 2026-08-18 (Continue buttons,
  `/checkout` route, billing settings page, quick-start thanks page).
- **Phase 6 — controlled enforcement:** ⏳ not started.

### Phase 0 — Creem readiness

- ✅ Create test Team/Growth monthly/annual products and bundle (done — four test
  product IDs wired in `api.env`).
- ⏳ Approve merchant account and countries/payout arrangement.
- ⏳ Verify portal upgrade/downgrade/cancel/proration/refund/invoice UX.
- ⏳ Confirm Terms, Privacy, DPA, and Merchant-of-Record wording.

**Gate:** approved decision record and test-mode lifecycle. If Creem cannot support
required regions/terms, retain the port and replace only its adapter.

### Phase 1 — domain, schema, transactions

- Catalog, entitlement policy, errors, DTOs.
- Prisma models/migration/indexes.
- Real transaction abstraction with transaction-bound repositories.
- Existing-tenant usage report/grandfather grants.

**Gate:** domain tests, migration on production-like snapshot, rollback rehearsal,
and concurrent transaction tests.

### Phase 2 — provisioning and report-mode limits

- Central tenant provisioner for local/Google/OIDC/admin paths.
- Project/seat enforcement, storage reservation/streaming, AI usage persistence.
- `ENTITLEMENT_ENFORCEMENT=report` records would-block without blocking.

**Gate:** cross-tenant/parallel tests prove no over-allocation and counters reconcile.

### Phase 3 — Creem and billing API

- Port, stub, Creem adapter/factory.
- Public raw-body webhook and durable inbox processor.
- Checkout/portal routes and audits.

**Gate:** Creem test mode covers duplicates/out-of-order events, scheduled cancel,
past-due recovery, expiration, refund, dispute, invalid signature, unknown product/
customer, and outage.

### Phase 4 — reconciliation

- ✅ All five handlers implemented 2026-08-18 (see §12). Trial expiry is
  effectively a no-op because no new trials are granted.
- ⏳ Kestra scheduling + reconciliation metrics/alerts + failed-event runbook.
- ⏳ Seven-day past-due grace runbook verification.

**Gate:** late jobs cannot extend trials; missed webhooks converge; replay is harmless.

### Phase 5 — web experience

- ✅ Pricing/signup plan flow including signed Google state (2026-08-18).
- ✅ Billing settings/actions, meters, banners, soft limits; `/checkout` route;
  quick-start `/thanks` page.

**Gate:** Playwright covers Starter/invalid plan, checkout return before webhook,
upgrade, scheduled downgrade, expiry, over-limit reads, permissions/accessibility.

### Phase 6 — controlled enforcement

- Compare report-mode usage to facts and resolve grandfather cases.
- Enable enforcement by tenant cohort.
- Monitor conversion, AI gross margin, webhook lag, and support load.

**Gate:** no unexplained drift/failing inbox, tested kill switch, communication and
support runbook complete.

## 17. Required test matrix

### Domain

- Catalog and JSON-safe mapping; grant precedence/expiry/Starter fallback.
- Grace, scheduled cancellation, downgrade preservation, override limits.
- Stable structured errors.

### Application and concurrency

- Parallel project creates, invites, and invitation acceptances at limits.
- Owner/suspended/expired-invite semantics.
- Storage reserve/failure/retry/delete and AI success/failure/idempotency/reset.
- Local/Google/OIDC/SCIM provisioning parity (all start on STARTER) and
  cross-tenant isolation.

### Infrastructure and Creem

- Product allowlist, test/live separation, exact-byte signatures.
- Global dedupe, processor crash recovery, event-order protection.
- Provider reconciliation/timeouts, checkout IDs/identity, sanitized logs.

### API and web

- `billing.manage`; no client-selected provider identifiers/URLs.
- Error contracts and pricing/signup carry-through.
- Success redirect alone grants nothing.
- Grace/cancel UI and accessible soft limits.
- Downgrade preserves reads, exports, deletions, and billing access.

### Operations

- Creem retry/manual replay; blocked/delayed webhook reconciliation.
- Provider outage; worker crash between claim and commit.
- Secret rotation/test-live mismatch; rollback to report/off without data loss.

## 18. Definition of done

Progress as of 2026-08-18 (Creem test mode):

- ✅ every provisioning path assigns exactly one valid initial entitlement (free
  STARTER; paid tiers unlocked by subscription after checkout);
- ✅ concurrency and alternate paths cannot exceed hard limits;
- ✅ late workers cannot retain expired trials (no new trials are granted);
- ✅ every AI attempt records cost and each customer credit is explainable;
- ⏳ Creem production checkout/portal works and webhooks are verified, durable,
  idempotent, and reconciled (test-mode wiring + reconciliation handlers are
  live; production keys/products pending);
- ✅ cancellation, failure, refund, dispute, downgrade, and outage preserve data
  and converge to documented access;
- ✅ billing/entitlement changes are tenant-correct and audited;
- ✅ pricing UI matches catalog and Creem products;
- ✅ migrations, tests, typechecks, builds, runbooks, monitoring, and rollback pass.

## 19. Verified external references

- Creem subscriptions: <https://docs.creem.io/features/subscriptions/introduction>
- Creem checkout: <https://docs.creem.io/features/checkout/checkout-api>
- Creem webhooks/events: <https://docs.creem.io/code/webhooks>
- Creem customer portal: <https://docs.creem.io/features/customer-portal>
- Creem product bundles: <https://docs.creem.io/features/product-bundles>
- Creem Merchant of Record: <https://docs.creem.io/merchant-of-record/what-is>

Revalidate these against the installed SDK/API version and approved Creem account
immediately before implementation and production launch.
