import { DomainError } from "../../core/domain-error.js";

export type PlanCode = "STARTER" | "TEAM" | "GROWTH" | "ENTERPRISE";

export const PLAN_CODES: readonly PlanCode[] = ["STARTER", "TEAM", "GROWTH", "ENTERPRISE"];

/** Bumping this version invalidates persisted catalog-coded snapshots. */
export const PLAN_CATALOG_VERSION = 1;

export interface PlanLimits {
  /** Active projects; null = unlimited (contractual). */
  maxActiveProjects: number | null;
  /** Seats including owner; null = unlimited (contractual). */
  maxSeats: number | null;
  /** DonorDesk-managed storage bytes; null = unlimited (contractual). */
  maxManagedStorageBytes: bigint | null;
  /** Successful AI report drafts per UTC month; null = unlimited (contractual). */
  monthlyAiDraftCredits: number | null;
}

export interface PlanDefinition extends PlanLimits {
  code: PlanCode;
  name: string;
  monthlyPriceUsd: number | null;
  annualPriceUsd: number | null;
  trialDays: number | null;
}

const GB = 1024n * 1024n * 1024n;

/**
 * Single source of commercial truth. Do not derive commercial terms from
 * PlanCode anywhere else; subscriptions persist the provider product/amount.
 */
export const PLAN_CATALOG: Readonly<Record<PlanCode, PlanDefinition>> = {
  STARTER: {
    code: "STARTER",
    name: "Starter",
    monthlyPriceUsd: 0,
    annualPriceUsd: 0,
    trialDays: null,
    maxActiveProjects: 1,
    maxSeats: 1,
    maxManagedStorageBytes: 1n * GB,
    monthlyAiDraftCredits: 5,
  },
  TEAM: {
    code: "TEAM",
    name: "Team",
    monthlyPriceUsd: 59,
    annualPriceUsd: 590,
    trialDays: null,
    maxActiveProjects: 5,
    maxSeats: 5,
    maxManagedStorageBytes: 25n * GB,
    monthlyAiDraftCredits: 100,
  },
  GROWTH: {
    code: "GROWTH",
    name: "Growth",
    monthlyPriceUsd: 149,
    annualPriceUsd: 1490,
    trialDays: null,
    maxActiveProjects: 20,
    maxSeats: 15,
    maxManagedStorageBytes: 100n * GB,
    monthlyAiDraftCredits: 500,
  },
  ENTERPRISE: {
    code: "ENTERPRISE",
    name: "Enterprise",
    monthlyPriceUsd: null,
    annualPriceUsd: null,
    trialDays: null,
    maxActiveProjects: null,
    maxSeats: null,
    maxManagedStorageBytes: null,
    monthlyAiDraftCredits: null,
  },
};

export const ENTERPRISE_PRICE_FLOOR_ANNUAL_USD = 6000;

export function isPlanCode(value: unknown): value is PlanCode {
  return typeof value === "string" && (PLAN_CODES as readonly string[]).includes(value);
}

export function resolvePlan(code: PlanCode): PlanDefinition {
  const plan = PLAN_CATALOG[code];
  if (!plan) throw DomainError.validation(`Unknown plan: ${code}`);
  return plan;
}

export function resolvePlanLimits(code: PlanCode): PlanLimits {
  const plan = resolvePlan(code);
  return {
    maxActiveProjects: plan.maxActiveProjects,
    maxSeats: plan.maxSeats,
    maxManagedStorageBytes: plan.maxManagedStorageBytes,
    monthlyAiDraftCredits: plan.monthlyAiDraftCredits,
  };
}

/** JSON-safe shape (bigint -> decimal string) for API/contract boundaries. */
export interface PlanLimitsJson {
  maxActiveProjects: number | null;
  maxSeats: number | null;
  maxManagedStorageBytes: string | null;
  monthlyAiDraftCredits: number | null;
}

export function planLimitsToJson(limits: PlanLimits): PlanLimitsJson {
  return {
    maxActiveProjects: limits.maxActiveProjects,
    maxSeats: limits.maxSeats,
    maxManagedStorageBytes: limits.maxManagedStorageBytes === null ? null : limits.maxManagedStorageBytes.toString(),
    monthlyAiDraftCredits: limits.monthlyAiDraftCredits,
  };
}

export function planLimitsFromJson(json: PlanLimitsJson): PlanLimits {
  return {
    maxActiveProjects: json.maxActiveProjects,
    maxSeats: json.maxSeats,
    maxManagedStorageBytes: json.maxManagedStorageBytes === null ? null : BigInt(json.maxManagedStorageBytes),
    monthlyAiDraftCredits: json.monthlyAiDraftCredits,
  };
}

export function isPlanForTrial(_code: PlanCode): boolean {
  return false;
}

/**
 * Partial, persisted override of a static catalog entry. Unset fields fall
 * back to the static `PLAN_CATALOG` values, so a SuperAdmin can adjust one
 * allocation (e.g. AI credits) without rewriting the whole tier.
 */
export interface PlanCatalogOverride {
  planCode: PlanCode;
  name?: string;
  monthlyPriceUsd?: number | null;
  annualPriceUsd?: number | null;
  trialDays?: number | null;
  enabled?: boolean;
  /** Partial limits override; unset buckets keep the static catalog value. */
  limits?: Partial<PlanLimits>;
  /** Platform actor that created/updated the override. */
  createdById?: string;
}

/** JSON-safe persisted form of a catalog override. */
export interface PlanCatalogOverrideJson {
  planCode: PlanCode;
  name?: string | null;
  monthlyPriceUsd?: number | null;
  annualPriceUsd?: number | null;
  trialDays?: number | null;
  enabled?: boolean;
  limits?: PlanLimitsJson | null;
}

export function planCatalogOverrideFromJson(json: PlanCatalogOverrideJson): PlanCatalogOverride {
  return {
    planCode: json.planCode,
    name: json.name ?? undefined,
    monthlyPriceUsd: json.monthlyPriceUsd ?? undefined,
    annualPriceUsd: json.annualPriceUsd ?? undefined,
    trialDays: json.trialDays ?? undefined,
    enabled: json.enabled,
    limits: json.limits ? planLimitsFromJson(json.limits) : undefined,
  };
}

/**
 * Merge a partial PlanLimitsJson onto a base. `undefined` buckets (and missing
 * keys) keep the base value; explicit `null` means unlimited/contract and is
 * preserved (never collapsed to the base).
 */
export function mergePartialLimits(
  partial: Partial<PlanLimitsJson> | null | undefined,
  base: PlanLimitsJson,
): PlanLimitsJson {
  return {
    maxActiveProjects: partial?.maxActiveProjects !== undefined ? partial.maxActiveProjects : base.maxActiveProjects,
    maxSeats: partial?.maxSeats !== undefined ? partial.maxSeats : base.maxSeats,
    maxManagedStorageBytes: partial?.maxManagedStorageBytes !== undefined ? partial.maxManagedStorageBytes : base.maxManagedStorageBytes,
    monthlyAiDraftCredits: partial?.monthlyAiDraftCredits !== undefined ? partial.monthlyAiDraftCredits : base.monthlyAiDraftCredits,
  };
}

export function planCatalogOverrideToJson(override: PlanCatalogOverride | null | undefined): PlanCatalogOverrideJson | null {
  if (!override) return null;
  const base = planLimitsToJson(resolvePlanLimits(override.planCode));
  return {
    planCode: override.planCode,
    name: override.name ?? null,
    monthlyPriceUsd: override.monthlyPriceUsd ?? null,
    annualPriceUsd: override.annualPriceUsd ?? null,
    trialDays: override.trialDays ?? null,
    enabled: override.enabled,
    limits: override.limits
      ? mergePartialLimits(
          {
            maxActiveProjects: override.limits.maxActiveProjects,
            maxSeats: override.limits.maxSeats,
            maxManagedStorageBytes: override.limits.maxManagedStorageBytes === undefined ? undefined : override.limits.maxManagedStorageBytes === null ? null : override.limits.maxManagedStorageBytes.toString(),
            monthlyAiDraftCredits: override.limits.monthlyAiDraftCredits,
          },
          base,
        )
      : null,
  };
}

/** Apply a partial override onto the static catalog entry. */
export function resolvePlanWithOverride(code: PlanCode, override?: PlanCatalogOverride | null): PlanDefinition {
  const base = resolvePlan(code);
  if (!override) return base;
  const limits = override.limits;
  return {
    ...base,
    name: override.name !== undefined ? override.name : base.name,
    monthlyPriceUsd: override.monthlyPriceUsd !== undefined ? override.monthlyPriceUsd : base.monthlyPriceUsd,
    annualPriceUsd: override.annualPriceUsd !== undefined ? override.annualPriceUsd : base.annualPriceUsd,
    trialDays: override.trialDays !== undefined ? override.trialDays : base.trialDays,
    maxActiveProjects: limits?.maxActiveProjects !== undefined ? limits.maxActiveProjects : base.maxActiveProjects,
    maxSeats: limits?.maxSeats !== undefined ? limits.maxSeats : base.maxSeats,
    maxManagedStorageBytes: limits?.maxManagedStorageBytes !== undefined ? limits.maxManagedStorageBytes : base.maxManagedStorageBytes,
    monthlyAiDraftCredits: limits?.monthlyAiDraftCredits !== undefined ? limits.monthlyAiDraftCredits : base.monthlyAiDraftCredits,
  };
}

export function resolvePlanLimitsWithOverride(code: PlanCode, override?: PlanCatalogOverride | null): PlanLimits {
  const plan = resolvePlanWithOverride(code, override);
  return {
    maxActiveProjects: plan.maxActiveProjects,
    maxSeats: plan.maxSeats,
    maxManagedStorageBytes: plan.maxManagedStorageBytes,
    monthlyAiDraftCredits: plan.monthlyAiDraftCredits,
  };
}

/** Resolver used by entitlement calculation; defaults to the static catalog. */
export type PlanLimitsResolver = (code: PlanCode) => PlanLimits;

export const STATIC_PLAN_LIMITS: PlanLimitsResolver = resolvePlanLimits;
