import type { Result } from "@donordesk/domain";
import {
  DomainError,
  TenantId,
  calculateEntitlement,
  type EntitlementSnapshot,
  type EntitlementInput,
  type EntitlementUsage,
  planLimitsToJson,
  type UsageMetric,
} from "@donordesk/domain";
import type {
  IEntitlementGrantRepository,
  IBillingSubscriptionRepository,
  IUsageCounterRepository,
} from "../ports/billing.js";
import type { IProjectRepository } from "../ports/projects.js";
import type { IUserRepository } from "../ports/identity.js";
import { monthStartUtc, USAGE_METRIC_STORAGE, USAGE_METRIC_AI_CREDITS } from "../use-cases/billing/_usage.js";

export interface EntitlementQuery {
  tenantId: string;
  /** Optional override for tests; defaults to now. */
  now?: Date;
}

export interface UsageSnapshot {
  activeProjects: number;
  seats: number;
  managedStorageBytes: bigint;
  aiDraftCreditsUsed: number;
  aiDraftCreditsReserved: number;
}

/**
 * Resolves a tenant's effective entitlement and current usage. This is the
 * single choke point for plan answers: web summary, project/seat/storage
 * enforcement, and AI-credit checks all read through here.
 */
export class EntitlementService {
  constructor(
    private readonly grants: IEntitlementGrantRepository,
    private readonly subscriptions: IBillingSubscriptionRepository,
    private readonly usage: IUsageCounterRepository,
    private readonly projects: IProjectRepository,
    private readonly users: IUserRepository,
  ) {}

  async resolve(query: EntitlementQuery): Promise<Result<EntitlementSnapshot, DomainError>> {
    const usage = await this.usageSnapshot(query);
    if (!usage.ok) return usage;
    return this.resolveWithUsage(query, usage.value);
  }

  async usageSnapshot(query: EntitlementQuery): Promise<Result<UsageSnapshot, DomainError>> {
    const now = query.now ?? new Date();
    const tenantId = TenantId.create(query.tenantId);
    const [projectResult, userResult, storageCounter, aiCounter] = await Promise.all([
      this.projects.listByTenant(tenantId),
      this.users.listByTenant(tenantId),
      this.usage.get(query.tenantId, USAGE_METRIC_STORAGE, monthStartUtc(now)),
      this.usage.get(query.tenantId, USAGE_METRIC_AI_CREDITS, monthStartUtc(now)),
    ]);
    if (!projectResult.ok) return projectResult;
    if (!userResult.ok) return userResult;
    if (!storageCounter.ok) return storageCounter;
    if (!aiCounter.ok) return aiCounter;

    return {
      ok: true,
      value: {
        activeProjects: projectResult.value.filter((p) => p.status !== "ARCHIVED").length,
        seats: userResult.value.filter((u) => u.status === "ACTIVE" || u.status === "INVITED" || u.status === "SUSPENDED").length,
        managedStorageBytes: storageCounter.value.totalCommitted(),
        aiDraftCreditsUsed: Number(aiCounter.value.used),
        aiDraftCreditsReserved: Number(aiCounter.value.reserved),
      },
    };
  }

  async resolveWithUsage(query: EntitlementQuery, usage: UsageSnapshot): Promise<Result<EntitlementSnapshot, DomainError>> {
    const now = query.now ?? new Date();

    const [grantResult, subResult] = await Promise.all([
      this.grants.listEffectiveByTenant(query.tenantId, now),
      this.subscriptions.findAccessGrantingByTenant(query.tenantId),
    ]);
    if (!grantResult.ok) return grantResult;
    if (!subResult.ok) return subResult;

    const subscription = subResult.value;
    const subscriptionView = subscription
      ? {
          status: subscription.status,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          currentPeriodEnd: subscription.currentPeriodEnd,
          graceEndsAt: subscription.graceEndsAt,
        }
      : undefined;

    const inputs: EntitlementInput[] = grantResult.value.map((g) => ({
      planCode: g.planCode,
      source: g.source,
      effectiveFrom: g.effectiveFrom,
      effectiveUntil: g.effectiveUntil,
      subscription: g.source === "CREEM_SUBSCRIPTION" ? subscriptionView : undefined,
      overrideLimits: g.overrideLimitsJson ? JSON.parse(g.overrideLimitsJson) : undefined,
    }));

    const entitlementUsage: EntitlementUsage = {
      activeProjects: usage.activeProjects,
      seats: usage.seats,
      managedStorageBytes: usage.managedStorageBytes,
      aiDraftCreditsUsed: usage.aiDraftCreditsUsed,
    };

    return { ok: true, value: calculateEntitlement(inputs, entitlementUsage, now) };
  }

  /** Serializable JSON summary consumed by the billing settings page. */
  async toSummary(query: EntitlementQuery): Promise<
    Result<
      {
        plan: string;
        source: string;
        catalogVersion: number;
        trialEndsAt?: string;
        isTrial: boolean;
        subscription?: {
          status: string;
          interval?: string;
          currentPeriodEnd?: string;
          cancelAtPeriodEnd: boolean;
        };
        limits: ReturnType<typeof planLimitsToJson>;
        overLimit: string[];
        usage: {
          projects: { used: number; limit: number | null };
          seats: { used: number; limit: number | null };
          managedStorageBytes: { used: string; limit: string | null };
          aiDraftCredits: { used: number; limit: number | null; resetsAt?: string };
        };
      },
      DomainError
    >
  > {
    const now = query.now ?? new Date();
    const usage = await this.usageSnapshot(query);
    if (!usage.ok) return usage;

    const resolved = await this.resolveWithUsage({ ...query, now }, usage.value);
    if (!resolved.ok) return resolved;

    const snapshot = resolved.value;
    const limits = snapshot.limits;
    const aiReset = nextMonthStartUtc(now);

    return {
      ok: true,
      value: {
        plan: snapshot.planCode,
        source: snapshot.source,
        catalogVersion: snapshot.catalogVersion,
        trialEndsAt: snapshot.trialEndsAt?.toISOString(),
        isTrial: snapshot.isTrial,
        subscription: snapshot.subscription
          ? {
              status: snapshot.subscription.status,
              currentPeriodEnd: snapshot.subscription.currentPeriodEnd?.toISOString(),
              cancelAtPeriodEnd: snapshot.subscription.cancelAtPeriodEnd,
            }
          : undefined,
        limits: planLimitsToJson(limits),
        overLimit: snapshot.overLimit,
        usage: {
          projects: { used: usage.value.activeProjects, limit: limits.maxActiveProjects },
          seats: { used: usage.value.seats, limit: limits.maxSeats },
          managedStorageBytes: {
            used: usage.value.managedStorageBytes.toString(),
            limit: limits.maxManagedStorageBytes === null ? null : limits.maxManagedStorageBytes.toString(),
          },
          aiDraftCredits: {
            used: usage.value.aiDraftCreditsUsed,
            limit: limits.monthlyAiDraftCredits,
            resetsAt: aiReset.toISOString(),
          },
        },
      },
    };
  }

  /** Storage metric accessor kept for handler reuse. */
  static storageMetric(): UsageMetric {
    return USAGE_METRIC_STORAGE;
  }

  /** AI credit metric accessor kept for handler reuse. */
  static aiCreditsMetric(): UsageMetric {
    return USAGE_METRIC_AI_CREDITS;
  }
}

function nextMonthStartUtc(date: Date): Date {
  const start = monthStartUtc(date);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
}

export function entitlementLimitError(resource: string, limit: number | bigint | null, usage: number | bigint): DomainError {
  return DomainError.planLimitReached(`Plan limit reached for ${resource}.`, {
    resource,
    limit: String(limit),
    usage: String(usage),
    upgradePath: "/settings/billing",
  });
}
