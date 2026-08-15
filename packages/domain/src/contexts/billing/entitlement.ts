import { DomainError } from "../../core/domain-error.js";
import type { PlanLimits } from "./plan.js";
import { resolvePlanLimits } from "./plan.js";
import type { BillingSubscriptionStatus } from "./billing-subscription.js";

export type EntitlementSource =
  | "DEFAULT"
  | "TRIAL"
  | "CREEM_SUBSCRIPTION"
  | "ENTERPRISE_CONTRACT"
  | "GRANDFATHERED"
  | "MANUAL";

export const ENTITLEMENT_SOURCES: readonly EntitlementSource[] = [
  "DEFAULT",
  "TRIAL",
  "CREEM_SUBSCRIPTION",
  "ENTERPRISE_CONTRACT",
  "GRANDFATHERED",
  "MANUAL",
];

export function isEntitlementSource(value: unknown): value is EntitlementSource {
  return typeof value === "string" && (ENTITLEMENT_SOURCES as readonly string[]).includes(value);
}

/** Descending precedence: earlier entries win over later ones. */
const SOURCE_PRECEDENCE: readonly EntitlementSource[] = [
  "MANUAL",
  "ENTERPRISE_CONTRACT",
  "GRANDFATHERED",
  "CREEM_SUBSCRIPTION",
  "TRIAL",
  "DEFAULT",
];

export function sourcePrecedence(source: EntitlementSource): number {
  const index = SOURCE_PRECEDENCE.indexOf(source);
  return index === -1 ? SOURCE_PRECEDENCE.length : index;
}

export type LimitedResource = "PROJECTS" | "SEATS" | "STORAGE" | "AI_CREDITS";

export interface EntitlementSubscriptionView {
  status: BillingSubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd?: Date;
  graceEndsAt?: Date;
}

export interface EntitlementInput {
  planCode: string;
  source: EntitlementSource;
  /** When the grant starts being effective. */
  effectiveFrom: Date;
  /** When the grant stops being effective. Trial/legacy windows use this. */
  effectiveUntil?: Date;
  subscription?: EntitlementSubscriptionView;
  /** Plan-specific override limits; falls back to catalog when omitted. */
  overrideLimits?: PlanLimits;
}

export interface EntitlementSnapshot {
  planCode: string;
  source: EntitlementSource;
  catalogVersion: number;
  limits: PlanLimits;
  effectiveFrom: Date;
  effectiveUntil?: Date;
  subscription?: EntitlementSubscriptionView;
  overLimit: LimitedResource[];
  trialEndsAt?: Date;
  isTrial: boolean;
}

export interface EntitlementUsage {
  activeProjects: number;
  seats: number;
  managedStorageBytes: bigint;
  aiDraftCreditsUsed: number;
}

/**
 * Pure entitlement calculation. Chooses the highest-precedence grant that is
 * currently effective, resolves its limits, then compares the tenant's usage
 * against the limits. Expired grants are ignored here (lazy enforcement) even
 * before any reconciliation job flips the database.
 *
 * - A CREEM_SUBSCRIPTION grant remains effective only while the subscription is
 *   ACTIVE/TRIALING or inside its grace window.
 * - A TRIAL grant is effective only until `effectiveUntil`.
 * - No valid grant -> STARTER (DEFAULT) is the effective fallback.
 */
export function calculateEntitlement(
  grants: EntitlementInput[],
  usage: EntitlementUsage,
  now: Date,
): EntitlementSnapshot {
  const effective = grants
    .filter((grant) => isGrantEffective(grant, now))
    .sort((a, b) => sourcePrecedence(a.source) - sourcePrecedence(b.source));

  const selected = effective[0];

  if (!selected) {
    const starter = resolvePlanLimits("STARTER");
    return {
      planCode: "STARTER",
      source: "DEFAULT",
      catalogVersion: 1,
      limits: starter,
      effectiveFrom: now,
      overLimit: computeOverLimit(starter, usage),
      isTrial: false,
    };
  }

  const limits = selected.overrideLimits ?? resolvePlanLimits(selected.planCode as import("./plan.js").PlanCode);
  const trialEndsAt = selected.source === "TRIAL" ? selected.effectiveUntil : undefined;

  return {
    planCode: selected.planCode,
    source: selected.source,
    catalogVersion: 1,
    limits,
    effectiveFrom: selected.effectiveFrom,
    effectiveUntil: selected.effectiveUntil,
    subscription: selected.subscription,
    overLimit: computeOverLimit(limits, usage),
    trialEndsAt,
    isTrial: selected.source === "TRIAL",
  };
}

function isGrantEffective(grant: EntitlementInput, now: Date): boolean {
  if (grant.effectiveFrom.getTime() > now.getTime()) return false;
  if (grant.effectiveUntil && grant.effectiveUntil.getTime() <= now.getTime()) return false;
  if (grant.source === "CREEM_SUBSCRIPTION" && grant.subscription) {
    if (grant.subscription.status === "CANCELLED" || grant.subscription.status === "EXPIRED" || grant.subscription.status === "PAUSED") {
      return false;
    }
    if (grant.subscription.status === "PAST_DUE") {
      const grace = grant.subscription.graceEndsAt;
      if (!grace || grace.getTime() <= now.getTime()) return false;
    }
    const periodEnd = grant.subscription.currentPeriodEnd;
    if (periodEnd && periodEnd.getTime() < now.getTime()) return false;
  }
  return true;
}

function computeOverLimit(limits: PlanLimits, usage: EntitlementUsage): LimitedResource[] {
  const over: LimitedResource[] = [];
  if (limits.maxActiveProjects !== null && usage.activeProjects > limits.maxActiveProjects) over.push("PROJECTS");
  if (limits.maxSeats !== null && usage.seats > limits.maxSeats) over.push("SEATS");
  if (limits.maxManagedStorageBytes !== null && usage.managedStorageBytes > limits.maxManagedStorageBytes) over.push("STORAGE");
  if (limits.monthlyAiDraftCredits !== null && usage.aiDraftCreditsUsed > limits.monthlyAiDraftCredits) over.push("AI_CREDITS");
  return over;
}

export function assertWithinLimit(
  resource: LimitedResource,
  usage: number | bigint,
  limit: number | bigint | null,
): void {
  if (limit === null) return;
  if (usage > limit) {
    const details: Record<string, unknown> = {
      resource,
      limit: limit.toString(),
      usage: usage.toString(),
      upgradePath: "/settings/billing",
    };
    if (resource === "AI_CREDITS") {
      throw DomainError.aiCreditsExhausted("AI draft credits exhausted for the current billing month.", details);
    }
    throw DomainError.planLimitReached(`Plan limit reached for ${resource}.`, details);
  }
}

export function assertCreditsAvailable(usage: number, limit: number | null): void {
  if (limit === null) return;
  if (usage >= limit) {
    throw DomainError.aiCreditsExhausted("AI draft credits exhausted for the current billing month.", {
      resource: "AI_CREDITS",
      limit: String(limit),
      usage: String(usage),
      upgradePath: "/settings/billing",
    });
  }
}
