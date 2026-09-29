import type { Result } from "@donordesk/domain";
import {
  DomainError,
  TenantId,
  calculateEntitlement,
  resolvePlanLimitsWithOverride,
  type EntitlementSnapshot,
  type EntitlementInput,
  type EntitlementUsage,
  type PlanCatalogOverride,
  type PlanLimitsResolver,
  type PlanCode,
  planLimitsToJson,
  type UsageMetric,
  MAX_ACTIVE_GROWTH_STANDING_BALANCE_PACKS,
} from "@donordesk/domain";
import type {
  IEntitlementGrantRepository,
  IBillingSubscriptionRepository,
  IUsageCounterRepository,
  IPlanCatalogRepository,
  IPurchasedCreditPackRepository,
} from "../ports/billing.js";
import type { IProjectRepository } from "../ports/projects.js";
import type { IUserRepository } from "../ports/identity.js";
import type { IAuditLogger } from "../ports/core.js";
import { monthStartUtc, nextMonthStartUtc, USAGE_METRIC_STORAGE, USAGE_METRIC_AI_CREDITS } from "../use-cases/billing/_usage.js";

export interface EntitlementQuery {
  tenantId: string;
  /** Optional override for tests; defaults to now. */
  now?: Date;
}

export interface UsageSnapshot {
  activeProjects: number;
  archivedProjects: number;
  seats: number;
  viewerSeats: number;
  managedStorageBytes: bigint;
  aiDraftCreditsUsed: number;
  aiDraftCreditsReserved: number;
  activeCreditPacks: number;
  activeCreditPackCredits: number;
  activeCreditPackUsed: number;
  /** GROWTH_STANDING_BALANCE-sourced subset of the active packs above (§4 WS-D item 5). */
  activeStandingBalancePacks: number;
  activeStandingBalanceCredits: number;
  activeStandingBalanceUsed: number;
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
    private readonly catalog?: IPlanCatalogRepository,
    private readonly packs?: IPurchasedCreditPackRepository,
  ) {}

  async resolve(query: EntitlementQuery): Promise<Result<EntitlementSnapshot, DomainError>> {
    const usage = await this.usageSnapshot(query);
    if (!usage.ok) return usage;
    return this.resolveWithUsage(query, usage.value);
  }

  async usageSnapshot(query: EntitlementQuery): Promise<Result<UsageSnapshot, DomainError>> {
    const now = query.now ?? new Date();
    const tenantId = TenantId.create(query.tenantId);
    const [projectResult, userResult, storageCounter, aiCounter, packsResult] = await Promise.all([
      this.projects.listByTenant(tenantId),
      this.users.listByTenant(tenantId),
      this.usage.get(query.tenantId, USAGE_METRIC_STORAGE, monthStartUtc(now)),
      this.usage.get(query.tenantId, USAGE_METRIC_AI_CREDITS, monthStartUtc(now)),
      this.packs ? this.packs.listActiveByTenant(query.tenantId) : Promise.resolve({ ok: true as const, value: [] }),
    ]);
    if (!projectResult.ok) return projectResult;
    if (!userResult.ok) return userResult;
    if (!storageCounter.ok) return storageCounter;
    if (!aiCounter.ok) return aiCounter;
    if (!packsResult.ok) return packsResult;

    return {
      ok: true,
      value: {
        // DonorDesk Academy demo projects (Feature 22) are excluded from both
        // counts: they must never consume a real project slot or show up as
        // clutter in plan-limit reporting.
        activeProjects: projectResult.value.filter((p) => p.status !== "ARCHIVED" && !p.isDemo).length,
        archivedProjects: projectResult.value.filter((p) => p.status === "ARCHIVED" && !p.isDemo).length,
        seats: userResult.value.filter(
          (u) => u.role !== "VIEWER" && (u.status === "ACTIVE" || u.status === "INVITED" || u.status === "SUSPENDED"),
        ).length,
        viewerSeats: userResult.value.filter(
          (u) => u.role === "VIEWER" && (u.status === "ACTIVE" || u.status === "INVITED" || u.status === "SUSPENDED"),
        ).length,
        managedStorageBytes: storageCounter.value.totalCommitted(),
        aiDraftCreditsUsed: Number(aiCounter.value.used),
        aiDraftCreditsReserved: Number(aiCounter.value.reserved),
        activeCreditPacks: packsResult.value.length,
        activeCreditPackCredits: packsResult.value.reduce((sum, p) => sum + p.credits, 0),
        activeCreditPackUsed: packsResult.value.reduce((sum, p) => sum + p.used, 0),
        activeStandingBalancePacks: packsResult.value.filter((p) => p.source === "GROWTH_STANDING_BALANCE").length,
        activeStandingBalanceCredits: packsResult.value
          .filter((p) => p.source === "GROWTH_STANDING_BALANCE")
          .reduce((sum, p) => sum + p.credits, 0),
        activeStandingBalanceUsed: packsResult.value
          .filter((p) => p.source === "GROWTH_STANDING_BALANCE")
          .reduce((sum, p) => sum + p.used, 0),
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

    const overrides: Result<PlanCatalogOverride[]> = this.catalog
      ? await this.catalog.listOverrides()
      : { ok: true, value: [] };
    if (!overrides.ok) return overrides;
    const overrideByCode = new Map(overrides.value.map((o) => [o.planCode, o] as const));

    const resolveLimits: PlanLimitsResolver = (code: PlanCode) =>
      resolvePlanLimitsWithOverride(code, overrideByCode.get(code));

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
      createdAt: g.createdAt,
    }));

    const entitlementUsage: EntitlementUsage = {
      activeProjects: usage.activeProjects,
      seats: usage.seats,
      viewerSeats: usage.viewerSeats,
      managedStorageBytes: usage.managedStorageBytes,
      aiDraftCreditsUsed: usage.aiDraftCreditsUsed,
    };

    return { ok: true, value: calculateEntitlement(inputs, entitlementUsage, now, resolveLimits) };
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
          projects: { active: number; archived: number; limit: number | null };
          seats: {
            full: { used: number; limit: number | null };
            viewers: { used: number; limit: number | null };
          };
          managedStorageBytes: { used: string; limit: string | null };
          aiDraftCredits: {
            planAllowance: number | null;
            packs: { active: number; credits: number; used: number };
            standingBalance: { active: number; credits: number; used: number; maxActive: number };
            used: number;
            limit: number | null;
            resetsAt?: string;
          };
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
          projects: {
            active: usage.value.activeProjects,
            archived: usage.value.archivedProjects,
            limit: limits.maxActiveProjects,
          },
          seats: {
            full: { used: usage.value.seats, limit: limits.maxSeats },
            viewers: { used: usage.value.viewerSeats, limit: limits.viewerSeats },
          },
          managedStorageBytes: {
            used: usage.value.managedStorageBytes.toString(),
            limit: limits.maxManagedStorageBytes === null ? null : limits.maxManagedStorageBytes.toString(),
          },
          aiDraftCredits: {
            planAllowance: limits.monthlyAiDraftCredits,
            packs: {
              active: usage.value.activeCreditPacks,
              credits: usage.value.activeCreditPackCredits,
              used: usage.value.activeCreditPackUsed,
            },
            standingBalance: {
              active: usage.value.activeStandingBalancePacks,
              credits: usage.value.activeStandingBalanceCredits,
              used: usage.value.activeStandingBalanceUsed,
              maxActive: MAX_ACTIVE_GROWTH_STANDING_BALANCE_PACKS,
            },
            used: usage.value.aiDraftCreditsUsed + usage.value.activeCreditPackUsed,
            limit: limits.monthlyAiDraftCredits === null ? null : limits.monthlyAiDraftCredits + usage.value.activeCreditPackCredits,
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

export function entitlementLimitError(resource: string, limit: number | bigint | null, usage: number | bigint): DomainError {
  return DomainError.planLimitReached(`Plan limit reached for ${resource}.`, {
    resource,
    limit: String(limit),
    usage: String(usage),
    upgradePath: "/settings/billing",
  });
}

/**
 * The Phase 6 enforcement rollout switch (Feature 19 §5.6-7 / Phase 22 §2.1j
 * WS-J.3): "off" never blocks and never records anything (a true kill
 * switch); "report" evaluates every limit exactly as "enforce" does but logs
 * a would-block audit event and lets the request through instead of
 * rejecting it, so real usage against the new caps can be observed before
 * anyone is actually blocked; "enforce" (the default) blocks, unchanged from
 * this system's behavior before this switch existed. The default must stay
 * "enforce" — every capacity check in this codebase already blocks
 * unconditionally, and defaulting anywhere else would silently disable
 * protection that's live today.
 */
export type EntitlementEnforcementMode = "off" | "report" | "enforce";

export function resolveEntitlementEnforcementMode(): EntitlementEnforcementMode {
  const raw = (process.env.ENTITLEMENT_ENFORCEMENT ?? "enforce").trim().toLowerCase();
  return raw === "off" || raw === "report" ? raw : "enforce";
}

/**
 * Single choke point for the off/report/enforce decision, used by every
 * capacity-limit call site (projects, seats, viewers, storage). AI credits
 * use their own variant (see generate-report-draft.ts) since reservation
 * there isn't a simple usage-vs-limit comparison.
 */
export async function applyEntitlementLimit(
  audit: IAuditLogger,
  tenantId: TenantId,
  actorId: string,
  resource: string,
  limit: number | bigint,
  used: number | bigint,
  mode: EntitlementEnforcementMode = resolveEntitlementEnforcementMode(),
): Promise<Result<void, DomainError>> {
  if (mode === "off") return { ok: true, value: undefined };
  if (mode === "report") {
    await audit.record({
      tenantId,
      actorId,
      eventType: "entitlement.limit_would_block",
      entityType: "entitlement",
      entityId: tenantId.toString(),
      newValue: JSON.stringify({ resource, limit: String(limit), used: String(used) }),
    });
    return { ok: true, value: undefined };
  }
  return { ok: false, error: entitlementLimitError(resource, limit, used) };
}
