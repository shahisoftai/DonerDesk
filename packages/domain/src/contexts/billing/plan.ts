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
    trialDays: 14,
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
    trialDays: 14,
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

export function isPlanForTrial(code: PlanCode): boolean {
  return code === "TEAM" || code === "GROWTH";
}
