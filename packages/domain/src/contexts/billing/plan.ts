import { DomainError } from "../../core/domain-error.js";

export type PlanCode = "STARTER" | "TEAM" | "GROWTH" | "ENTERPRISE";

export const PLAN_CODES: readonly PlanCode[] = ["STARTER", "TEAM", "GROWTH", "ENTERPRISE"];

/** Bumping this version invalidates persisted catalog-coded snapshots. */
export const PLAN_CATALOG_VERSION = 2;

export interface PlanLimits {
  /** Active projects; null = unlimited (contractual). */
  maxActiveProjects: number | null;
  /** Seats including owner; null = unlimited (contractual). */
  maxSeats: number | null;
  /** DonorDesk-managed storage bytes; null = unlimited (contractual). */
  maxManagedStorageBytes: bigint | null;
  /** Successful AI report drafts per UTC month; null = unlimited (contractual). */
  monthlyAiDraftCredits: number | null;
  /** Read-only viewer seats, counted separately from `maxSeats`; null = unlimited. */
  viewerSeats: number | null;
  /** Whether AI credit top-up packs are purchasable on this plan. */
  aiCreditTopUp: boolean;
  /** Whether the tenant may draft with its own (BYO) LLM provider on this plan. */
  byoLlmEnabled: boolean;
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
    viewerSeats: 2,
    aiCreditTopUp: false,
    byoLlmEnabled: false,
  },
  TEAM: {
    code: "TEAM",
    name: "Team",
    monthlyPriceUsd: 129,
    annualPriceUsd: 1290,
    trialDays: 14,
    maxActiveProjects: 5,
    maxSeats: 5,
    maxManagedStorageBytes: 25n * GB,
    monthlyAiDraftCredits: 20,
    viewerSeats: null,
    aiCreditTopUp: true,
    byoLlmEnabled: false,
  },
  GROWTH: {
    code: "GROWTH",
    name: "Growth",
    monthlyPriceUsd: 299,
    annualPriceUsd: 2990,
    trialDays: 14,
    maxActiveProjects: 20,
    maxSeats: 15,
    maxManagedStorageBytes: 100n * GB,
    monthlyAiDraftCredits: 100,
    viewerSeats: null,
    aiCreditTopUp: true,
    byoLlmEnabled: true,
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
    viewerSeats: null,
    aiCreditTopUp: true,
    byoLlmEnabled: true,
  },
};

export const ENTERPRISE_PRICE_FLOOR_ANNUAL_USD = 12000;

export function isPlanCode(value: unknown): value is PlanCode {
  return typeof value === "string" && (PLAN_CODES as readonly string[]).includes(value);
}

export function resolvePlan(code: PlanCode): PlanDefinition {
  const plan = PLAN_CATALOG[code];
  if (!plan) throw DomainError.validation(`Unknown plan: ${code}`);
  return plan;
}

/**
 * Single list of `PlanLimits` keys that are not `maxManagedStorageBytes`
 * (the one field needing bigint<->string conversion at the JSON boundary).
 * Every helper below (JSON conversion, merge, override resolution) derives
 * from this list instead of hand-listing fields, so adding a limit bucket to
 * `PlanLimits` only requires one edit here plus the interface/catalog entries
 * — never N scattered edits that can silently drop a field at a boundary.
 */
const PLAN_LIMITS_PASSTHROUGH_KEYS = [
  "maxActiveProjects",
  "maxSeats",
  "monthlyAiDraftCredits",
  "viewerSeats",
  "aiCreditTopUp",
  "byoLlmEnabled",
] as const satisfies readonly (keyof PlanLimits)[];

export function resolvePlanLimits(code: PlanCode): PlanLimits {
  const plan = resolvePlan(code);
  return {
    ...Object.fromEntries(PLAN_LIMITS_PASSTHROUGH_KEYS.map((key) => [key, plan[key]])),
    maxManagedStorageBytes: plan.maxManagedStorageBytes,
  } as unknown as PlanLimits;
}

/** JSON-safe shape (bigint -> decimal string) for API/contract boundaries. */
export interface PlanLimitsJson {
  maxActiveProjects: number | null;
  maxSeats: number | null;
  maxManagedStorageBytes: string | null;
  monthlyAiDraftCredits: number | null;
  viewerSeats: number | null;
  aiCreditTopUp: boolean;
  byoLlmEnabled: boolean;
}

export function planLimitsToJson(limits: PlanLimits): PlanLimitsJson {
  return {
    ...Object.fromEntries(PLAN_LIMITS_PASSTHROUGH_KEYS.map((key) => [key, limits[key]])),
    maxManagedStorageBytes: limits.maxManagedStorageBytes === null ? null : limits.maxManagedStorageBytes.toString(),
  } as unknown as PlanLimitsJson;
}

export function planLimitsFromJson(json: PlanLimitsJson): PlanLimits {
  return {
    ...Object.fromEntries(PLAN_LIMITS_PASSTHROUGH_KEYS.map((key) => [key, json[key]])),
    maxManagedStorageBytes: json.maxManagedStorageBytes === null ? null : BigInt(json.maxManagedStorageBytes),
  } as unknown as PlanLimits;
}

export function isPlanForTrial(code: PlanCode): boolean {
  return code === "TEAM" || code === "GROWTH";
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
const PLAN_LIMITS_JSON_KEYS = [
  ...PLAN_LIMITS_PASSTHROUGH_KEYS,
  "maxManagedStorageBytes",
] as const satisfies readonly (keyof PlanLimitsJson)[];

export function mergePartialLimits(
  partial: Partial<PlanLimitsJson> | null | undefined,
  base: PlanLimitsJson,
): PlanLimitsJson {
  return Object.fromEntries(
    PLAN_LIMITS_JSON_KEYS.map((key) => [key, partial?.[key] !== undefined ? partial[key] : base[key]]),
  ) as unknown as PlanLimitsJson;
}

/**
 * Read a grant's stored override JSON as a complete `PlanLimits`. Keys the stored
 * object lacks (written before a bucket existed) keep the plan's own value, so a
 * boundary never sees `undefined`; malformed JSON yields `undefined` (use the plan).
 */
export function parseStoredLimitsOverride(raw: string | null | undefined, base: PlanLimits): PlanLimits | undefined {
  if (!raw) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
  try {
    return planLimitsFromJson(mergePartialLimits(parsed as Partial<PlanLimitsJson>, planLimitsToJson(base)));
  } catch {
    return undefined;
  }
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
    limits: override.limits ? mergePartialLimits(limitsToPartialJson(override.limits), base) : null,
  };
}

/**
 * Convert a partial `PlanLimits` override (bigint storage) into the partial
 * JSON shape `mergePartialLimits` expects, preserving the "unset key stays
 * unset" distinction (`undefined` vs explicit `null`).
 */
function limitsToPartialJson(limits: Partial<PlanLimits>): Partial<PlanLimitsJson> {
  const json: Partial<PlanLimitsJson> = Object.fromEntries(
    PLAN_LIMITS_PASSTHROUGH_KEYS.filter((key) => limits[key] !== undefined).map((key) => [key, limits[key]]),
  );
  if (limits.maxManagedStorageBytes !== undefined) {
    json.maxManagedStorageBytes = limits.maxManagedStorageBytes === null ? null : limits.maxManagedStorageBytes.toString();
  }
  return json;
}

/** Apply a partial override onto the static catalog entry. */
export function resolvePlanWithOverride(code: PlanCode, override?: PlanCatalogOverride | null): PlanDefinition {
  const base = resolvePlan(code);
  if (!override) return base;
  const limits = override.limits;
  const mergedLimits = limits
    ? planLimitsFromJson(mergePartialLimits(limitsToPartialJson(limits), planLimitsToJson(base)))
    : resolvePlanLimits(code);
  return {
    ...base,
    ...mergedLimits,
    name: override.name !== undefined ? override.name : base.name,
    monthlyPriceUsd: override.monthlyPriceUsd !== undefined ? override.monthlyPriceUsd : base.monthlyPriceUsd,
    annualPriceUsd: override.annualPriceUsd !== undefined ? override.annualPriceUsd : base.annualPriceUsd,
    trialDays: override.trialDays !== undefined ? override.trialDays : base.trialDays,
  };
}

export function resolvePlanLimitsWithOverride(code: PlanCode, override?: PlanCatalogOverride | null): PlanLimits {
  const plan = resolvePlanWithOverride(code, override);
  return {
    ...Object.fromEntries(PLAN_LIMITS_PASSTHROUGH_KEYS.map((key) => [key, plan[key]])),
    maxManagedStorageBytes: plan.maxManagedStorageBytes,
  } as unknown as PlanLimits;
}

/** Resolver used by entitlement calculation; defaults to the static catalog. */
export type PlanLimitsResolver = (code: PlanCode) => PlanLimits;

export const STATIC_PLAN_LIMITS: PlanLimitsResolver = resolvePlanLimits;
