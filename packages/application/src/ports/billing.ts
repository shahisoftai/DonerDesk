import type { Result, DomainError } from "@donordesk/domain";
import type {
  BillingSubscription,
  BillingSubscriptionStatus,
  EntitlementGrant,
  PlanCode,
  PlanCatalogOverride,
  BillingInterval,
  UsageCounter,
  UsageMetric,
  PurchasedCreditPack,
  NonprofitVerification,
} from "@donordesk/domain";

export type CreditPackSku = "TOPUP_50" | "TOPUP_100" | "STANDING_BALANCE_100";

export interface ProviderSubscription {
  providerSubscriptionId: string;
  providerCustomerId?: string;
  providerProductId: string;
  planCode: PlanCode;
  status: BillingSubscriptionStatus;
  currency: string;
  unitAmountMinor: number;
  billingInterval: BillingInterval;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  trialStart?: Date;
  trialEnd?: Date;
  cancelAtPeriodEnd: boolean;
  graceEndsAt?: Date;
  providerUpdatedAt?: Date;
}

export interface ProviderBillingEvent {
  /** Globally unique provider event id (idempotency key). */
  eventId: string;
  /** Normalized provider event type. */
  eventType: string;
  providerCreatedAt?: Date;
  subscription?: ProviderSubscription;
  customerId?: string;
  /** Opaque provider metadata (e.g. the tenant reference recorded at checkout). */
  metadata?: Record<string, unknown>;
  /**
   * Provider order/transaction id. Present on one-off `checkout.completed`
   * events and on the `refund.created`/`dispute.created` events that later
   * reference the same order — the join key for `PurchasedCreditPack`.
   */
  orderId?: string;
  /** Present only on a `checkout.completed` event for a one-off top-up SKU. */
  oneOffPurchase?: { sku: CreditPackSku; credits: number };
}

export interface CreateCheckoutArgs {
  tenantId: string;
  requestId: string;
  plan: "TEAM" | "GROWTH";
  interval: BillingInterval;
  customerEmail: string;
  successUrl: string;
  /** Tenant has an APPROVED NonprofitVerification: use the discounted product if configured. */
  nonprofit?: boolean;
}

export interface CreateCustomerPortalArgs {
  providerCustomerId: string;
}

export interface CreateOneOffCheckoutArgs {
  tenantId: string;
  requestId: string;
  sku: CreditPackSku;
  customerEmail: string;
  successUrl: string;
}

export interface BillingProvider {
  createCheckout(input: CreateCheckoutArgs): Promise<Result<{ checkoutId: string; url: string }, DomainError>>;
  /** One-off (non-subscription) purchase, e.g. an AI-credit top-up pack. */
  createOneOffCheckout(input: CreateOneOffCheckoutArgs): Promise<Result<{ checkoutId: string; url: string }, DomainError>>;
  createCustomerPortal(input: CreateCustomerPortalArgs): Promise<Result<{ url: string }, DomainError>>;
  getSubscription(providerSubscriptionId: string): Promise<Result<ProviderSubscription, DomainError>>;
  /** Verify the raw body against the provider signature and parse the event. */
  verifyAndParseWebhook(rawBody: Buffer, signature: string): Result<ProviderBillingEvent, DomainError>;
}

export interface IEntitlementGrantRepository {
  create(grant: EntitlementGrant): Promise<Result<EntitlementGrant>>;
  listByTenant(tenantId: string): Promise<Result<EntitlementGrant[]>>;
  /** All grants active at `now` (effectiveFrom <= now < effectiveUntil). */
  listEffectiveByTenant(tenantId: string, now: Date): Promise<Result<EntitlementGrant[]>>;
  /** Trial grants whose window ended at/before `now`. */
  listExpiredTrialGrants(now: Date): Promise<Result<EntitlementGrant[]>>;
  /**
   * Ends one grant's open window in place at `at` (no-op if already ended at
   * or before `at`). Grants are append-oriented for *creation*; ending a stale
   * window early (subscription plan change/renewal resync) cannot be modeled
   * as a new append, because a phantom "terminated" row would leave the
   * original window effective. Precedent: PlatformControlPlane's
   * extendTrial/endTrial mutate `effectiveUntil` in place the same way.
   */
  endGrant(grantId: string, at: Date): Promise<Result<void>>;
}

/**
 * Persisted, globally-applied overrides to the static plan catalog. SuperAdmin
 * tier management writes here; entitlement resolution consults it so edited
 * allocations apply platform-wide without a deploy.
 */
export interface IPlanCatalogRepository {
  listOverrides(): Promise<Result<PlanCatalogOverride[]>>;
}

export interface IPlatformLlmConfigRepository {
  /** Tenant ids with an enabled tenant-scoped (BYO) LLM configuration. */
  listEnabledTenantScopeIds(): Promise<Result<string[]>>;
}

export interface IBillingSubscriptionRepository {
  create(sub: BillingSubscription): Promise<Result<BillingSubscription>>;
  update(sub: BillingSubscription): Promise<Result<BillingSubscription>>;
  findByProviderSubscriptionId(providerSubscriptionId: string): Promise<Result<BillingSubscription | null>>;
  /** The single access-granting subscription for a tenant, if any. */
  findAccessGrantingByTenant(tenantId: string): Promise<Result<BillingSubscription | null>>;
  /**
   * Subscriptions that need provider re-sync: non-terminal (ACTIVE / TRIALING /
   * PAST_DUE / UNPAID) and either never synced or last synced before
   * `staleBefore`. Used by scheduled reconciliation so a missed webhook
   * converges even when the provider never retries.
   */
  listReconcileCandidates(staleBefore: Date, limit?: number): Promise<Result<BillingSubscription[]>>;
  /**
   * Currently access-granting subscriptions (ACTIVE, or PAST_DUE within
   * grace) on any of `planCodes`. Platform-scoped (not tenant-qualified) —
   * used by one-shot catalog-migration jobs that must enumerate every tenant
   * on a plan, not resolve one tenant's entitlement.
   */
  listActiveByPlanCodes(planCodes: PlanCode[], limit?: number): Promise<Result<BillingSubscription[]>>;
}

export interface UsageCounterEntry {
  tenantId: string;
  counter: UsageCounter;
}

export interface IUsageCounterRepository {
  /** Atomically read-or-create the counter for a tenant/metric/period. */
  get(tenantId: string, metric: UsageMetric, periodStart: Date): Promise<Result<UsageCounter>>;
  /** Atomic in-place increment (returns the updated counter). */
  add(tenantId: string, metric: UsageMetric, periodStart: Date, delta: bigint): Promise<Result<UsageCounter>>;
  /**
   * Absolute-correct the `used` value for a tenant/metric/period (reconciliation).
   * Only ever reduces the committed total; never grows it above the authoritative
   * count.
   */
  setUsed(tenantId: string, metric: UsageMetric, periodStart: Date, used: bigint): Promise<Result<UsageCounter>>;
  /** All counters for a metric in a period (platform-scoped reconciliation). */
  listByMetric(metric: UsageMetric, periodStart: Date): Promise<Result<UsageCounterEntry[]>>;
}

export interface IBillingEventInboxRepository {
  create(input: {
    id: string;
    provider: string;
    providerEventId: string;
    eventType: string;
    providerCreatedAt?: Date;
    tenantId?: string;
    payloadChecksum: string;
  }): Promise<Result<{ id: string }>>;
  markProcessing(id: string, attempt: number): Promise<Result<void>>;
  markProcessed(id: string): Promise<Result<void>>;
  markFailed(id: string, error: string): Promise<Result<void>>;
  /** Events stuck in PROCESSING beyond `olderThan` (worker crashed mid-claim). */
  listStaleProcessing(olderThan: Date, limit?: number): Promise<Result<Array<{ id: string; providerEventId: string; tenantId: string | null; attemptCount: number }>>>;
}

export interface IPurchasedCreditPackRepository {
  create(pack: PurchasedCreditPack): Promise<Result<PurchasedCreditPack>>;
  findByProviderOrderId(providerOrderId: string): Promise<Result<PurchasedCreditPack | null>>;
  /** Active packs for a tenant, oldest-first (draw-down order). */
  listActiveByTenant(tenantId: string): Promise<Result<PurchasedCreditPack[]>>;
  /** All packs for a tenant, any status (billing summary / SuperAdmin view). */
  listByTenant(tenantId: string): Promise<Result<PurchasedCreditPack[]>>;
  /**
   * Atomically draws `amount` credits from the pack, guarding the remaining
   * balance at the database level (`used + amount <= credits`). Returns the
   * updated pack, or a CONFLICT error if the pack no longer has enough
   * remaining balance (raced by a concurrent draw-down).
   */
  reserve(packId: string, amount: number): Promise<Result<PurchasedCreditPack>>;
  /** Compensating release after a reserved draw-down whose generation failed. */
  release(packId: string, amount: number): Promise<Result<PurchasedCreditPack>>;
  update(pack: PurchasedCreditPack): Promise<Result<PurchasedCreditPack>>;
}

export interface INonprofitVerificationRepository {
  create(v: NonprofitVerification): Promise<Result<NonprofitVerification>>;
  update(v: NonprofitVerification): Promise<Result<NonprofitVerification>>;
  findById(id: string): Promise<Result<NonprofitVerification | null>>;
  /** The tenant's most recent submission, regardless of status. */
  findLatestByTenant(tenantId: string): Promise<Result<NonprofitVerification | null>>;
  listPending(limit?: number): Promise<Result<NonprofitVerification[]>>;
}

export interface ITrialIdentityRepository {
  existsByEmailFingerprint(fingerprint: string): Promise<Result<boolean>>;
  create(input: {
    id: string;
    tenantId: string;
    emailFingerprint: string;
    domainFingerprint: string;
    trialStartedAt: Date;
    trialEndedAt?: Date;
  }): Promise<Result<{ id: string }>>;
}

export interface ILlmUsageRepository {
  /** Successful REPORT_DRAFT runs for a tenant in a UTC month. */
  countSuccessfulReportDrafts(tenantId: string, monthStart: Date): Promise<Result<number>>;
  /** Billable successful REPORT_DRAFT runs backed by a real (non-stub) DonorDesk model in a UTC month (tenant-own-provider runs excluded). */
  countAiReportDrafts(tenantId: string, monthStart: Date): Promise<Result<number>>;
  /** Record a run (success or failure) so cost is always tracked. */
  recordRun(input: {
    id: string;
    tenantId: string;
    operationType: string;
    resourceId?: string;
    modelId: string;
    promptId: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    costUsd: number;
    latencyMs: number;
    status: string;
    promptVersion: number;
    modelVersion: string;
    billableUnits?: number;
    requestId?: string;
    errorMessage?: string;
    /** Redacted structured diagnostics only; never store unrestricted donor content here. */
    responseText?: string;
  }): Promise<Result<{ id: string }>>;
  /** The most recent runs of one kind for a tenant, newest first (the administrator's AI usage view). */
  listRecent(tenantId: string, operationType: string, limit: number): Promise<Result<import("@donordesk/domain").AiRunRecord[]>>;
}
