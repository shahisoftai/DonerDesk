import { randomUUID } from "node:crypto";
import type { Result, PlanCode, PlanCatalogOverride } from "@donordesk/domain";
import { DomainError, EntitlementGrant, TenantId, resolvePlanLimitsWithOverride, planLimitsToJson } from "@donordesk/domain";
import type { IEntitlementGrantRepository, IBillingSubscriptionRepository, IUsageCounterRepository, IPlanCatalogRepository } from "../../ports/billing.js";
import type { IAuditLogger, IClock } from "../../ports/core.js";
import { monthStartUtc, nextMonthStartUtc, USAGE_METRIC_AI_CREDITS } from "./_usage.js";

/** Stable marker prefix so re-running the migration never double-grants (checked via `reason`). */
export const GRANDFATHER_CREDIT_CUTOVER_REASON_PREFIX = "phase22-credit-cutover";

export interface CreditCutover {
  planCode: PlanCode;
  /** The allowance the plan enforced before this cutover. */
  oldMonthlyAiDraftCredits: number;
  /** The allowance the plan enforces after this cutover (from the new catalog). */
  newMonthlyAiDraftCredits: number;
}

/**
 * The one known cutover this migration exists for (Phase 22, WS-A):
 * TEAM 100 -> 20 and GROWTH 500 -> 100 monthly AI-draft credits. Kept here
 * (not accepted as free-form admin input) so a SuperAdmin triggering the
 * migration can't accidentally fabricate an arbitrary grandfather grant —
 * the values are historical fact about this specific catalog change, not a
 * general-purpose tool.
 */
export const PHASE22_CREDIT_CUTOVERS: CreditCutover[] = [
  { planCode: "TEAM", oldMonthlyAiDraftCredits: 100, newMonthlyAiDraftCredits: 20 },
  { planCode: "GROWTH", oldMonthlyAiDraftCredits: 500, newMonthlyAiDraftCredits: 100 },
];

export interface GrandfatherCreditCutoverOutcome {
  tenantId: string;
  planCode: PlanCode;
  usedThisMonth: number;
  grantedAllowance: number;
  effectiveUntil: string;
}

/**
 * WS-A.6 (memorybank/imp/Phase22-tier-pricing.md §"Existing-subscriber
 * cutover policy"): a catalog change that lowers a plan's monthly AI-draft
 * credit cap must not hard-block a tenant mid-cycle. For every tenant
 * currently on an affected plan whose *current UTC month* usage already
 * exceeds the new cap, this one-shot handler writes a time-bounded
 * `GRANDFATHERED` entitlement grant preserving the *old* allowance until the
 * next UTC month boundary (mirrors Feature 19 §5.3's existing-tenant
 * migration pattern). Storage/seats/projects are untouched — only the AI
 * credit bucket is overridden.
 *
 * Idempotent: a tenant that already has an active grant with this
 * migration's reason marker is skipped, so re-running the job (e.g. after a
 * partial failure) never double-grants or extends the window.
 */
export class RunGrandfatherCreditCutoverHandler {
  constructor(
    private readonly subscriptions: IBillingSubscriptionRepository,
    private readonly grants: IEntitlementGrantRepository,
    private readonly usage: IUsageCounterRepository,
    private readonly audit: IAuditLogger,
    private readonly clock: IClock,
    private readonly catalog?: IPlanCatalogRepository,
  ) {}

  async handle(input: { cutovers: CreditCutover[] }): Promise<Result<GrandfatherCreditCutoverOutcome[], DomainError>> {
    const now = this.clock.now();
    const periodStart = monthStartUtc(now);
    const effectiveUntil = nextMonthStartUtc(now);
    const cutoverByPlan = new Map(input.cutovers.map((c) => [c.planCode, c] as const));

    const subsResult = await this.subscriptions.listActiveByPlanCodes([...cutoverByPlan.keys()]);
    if (!subsResult.ok) return subsResult;

    const overridesResult: Result<PlanCatalogOverride[]> = this.catalog ? await this.catalog.listOverrides() : { ok: true, value: [] };
    if (!overridesResult.ok) return overridesResult;
    const catalogOverrideByPlan = new Map(overridesResult.value.map((o) => [o.planCode, o] as const));

    const outcomes: GrandfatherCreditCutoverOutcome[] = [];

    for (const sub of subsResult.value) {
      const cutover = cutoverByPlan.get(sub.planCode);
      if (!cutover || cutover.oldMonthlyAiDraftCredits <= cutover.newMonthlyAiDraftCredits) continue;

      const usageResult = await this.usage.get(sub.tenantId, USAGE_METRIC_AI_CREDITS, periodStart);
      if (!usageResult.ok) return usageResult;
      const used = Number(usageResult.value.used);
      if (used <= cutover.newMonthlyAiDraftCredits) continue;

      const existingResult = await this.grants.listEffectiveByTenant(sub.tenantId, now);
      if (!existingResult.ok) return existingResult;
      const alreadyGrandfathered = existingResult.value.some(
        (g) => g.source === "GRANDFATHERED" && g.reason?.startsWith(GRANDFATHER_CREDIT_CUTOVER_REASON_PREFIX),
      );
      if (alreadyGrandfathered) continue;

      // Full PlanLimitsJson, not just the credit bucket: calculateEntitlement
      // reads `overrideLimits` as a complete PlanLimits object, so a
      // partial override would leave every other bucket `undefined`.
      const planLimits = resolvePlanLimitsWithOverride(sub.planCode, catalogOverrideByPlan.get(sub.planCode));
      const overrideLimitsJson = JSON.stringify({
        ...planLimitsToJson(planLimits),
        monthlyAiDraftCredits: cutover.oldMonthlyAiDraftCredits,
      });
      const grant = EntitlementGrant.create({
        id: randomUUID(),
        props: {
          tenantId: sub.tenantId,
          planCode: sub.planCode,
          source: "GRANDFATHERED",
          effectiveFrom: now,
          effectiveUntil,
          overrideLimitsJson,
          reason: `${GRANDFATHER_CREDIT_CUTOVER_REASON_PREFIX}:${sub.planCode.toLowerCase()}:${cutover.oldMonthlyAiDraftCredits}->${cutover.newMonthlyAiDraftCredits}`,
          createdById: "system:phase22-migration",
        },
      });

      const created = await this.grants.create(grant);
      if (!created.ok) return created;

      await this.audit.record({
        tenantId: TenantId.create(sub.tenantId),
        actorId: "system:phase22-migration",
        eventType: "billing.credits.grandfathered",
        entityType: "Tenant",
        entityId: sub.tenantId,
        newValue: JSON.stringify({
          planCode: sub.planCode,
          usedThisMonth: used,
          oldAllowance: cutover.oldMonthlyAiDraftCredits,
          newAllowance: cutover.newMonthlyAiDraftCredits,
          effectiveUntil: effectiveUntil.toISOString(),
        }),
      });

      outcomes.push({
        tenantId: sub.tenantId,
        planCode: sub.planCode,
        usedThisMonth: used,
        grantedAllowance: cutover.oldMonthlyAiDraftCredits,
        effectiveUntil: effectiveUntil.toISOString(),
      });
    }

    return { ok: true, value: outcomes };
  }
}
