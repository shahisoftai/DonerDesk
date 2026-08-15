import type { Result, DomainError } from "@donordesk/domain";
import type {
  BillingSubscription,
  BillingSubscriptionStatus,
  EntitlementGrant,
  PlanCode,
  BillingInterval,
  UsageCounter,
  UsageMetric,
} from "@donordesk/domain";

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
}

export interface CreateCheckoutArgs {
  tenantId: string;
  requestId: string;
  plan: "TEAM" | "GROWTH";
  interval: BillingInterval;
  customerEmail: string;
  successUrl: string;
}

export interface CreateCustomerPortalArgs {
  providerCustomerId: string;
}

export interface BillingProvider {
  createCheckout(input: CreateCheckoutArgs): Promise<Result<{ checkoutId: string; url: string }, DomainError>>;
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
}

export interface IBillingSubscriptionRepository {
  create(sub: BillingSubscription): Promise<Result<BillingSubscription>>;
  update(sub: BillingSubscription): Promise<Result<BillingSubscription>>;
  findByProviderSubscriptionId(providerSubscriptionId: string): Promise<Result<BillingSubscription | null>>;
  /** The single access-granting subscription for a tenant, if any. */
  findAccessGrantingByTenant(tenantId: string): Promise<Result<BillingSubscription | null>>;
}

export interface IUsageCounterRepository {
  /** Atomically read-or-create the counter for a tenant/metric/period. */
  get(tenantId: string, metric: UsageMetric, periodStart: Date): Promise<Result<UsageCounter>>;
  /** Atomic in-place increment (returns the updated counter). */
  add(tenantId: string, metric: UsageMetric, periodStart: Date, delta: bigint): Promise<Result<UsageCounter>>;
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
  }): Promise<Result<{ id: string }>>;
}
