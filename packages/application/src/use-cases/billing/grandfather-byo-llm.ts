import { randomUUID } from "node:crypto";
import type { Result, PlanCatalogOverride, PlanCode } from "@donordesk/domain";
import { DomainError, EntitlementGrant, TenantId, resolvePlanLimitsWithOverride, planLimitsToJson, isPlanCode } from "@donordesk/domain";
import type {
  IEntitlementGrantRepository,
  IPlanCatalogRepository,
  IPlatformLlmConfigRepository,
} from "../../ports/billing.js";
import type { IAuditLogger, IClock } from "../../ports/core.js";
import { EntitlementService } from "../../services/entitlement-service.js";

/** Stable marker prefix so re-running the migration never double-grants (checked via `reason`). */
export const GRANDFATHER_BYO_LLM_REASON_PREFIX = "phase22-byo-llm-grandfather";

export interface GrandfatherByoLlmOutcome {
  tenantId: string;
  planCode: string;
}

/**
 * Phase 22 WS-E.3: before the BYO-LLM entitlement gate (added this phase)
 * takes effect, any tenant that already has a working tenant-scoped LLM
 * configuration but whose plan does NOT include `byoLlmEnabled` must be
 * grandfathered with a permanent MANUAL override — never silently disable a
 * configuration that was working. One-shot, idempotent (a tenant with an
 * existing grant tagged `GRANDFATHER_BYO_LLM_REASON_PREFIX` is skipped), and
 * safe to re-run. Mirrors `RunGrandfatherCreditCutoverHandler`'s shape.
 */
export class RunGrandfatherByoLlmHandler {
  constructor(
    private readonly llmConfigs: IPlatformLlmConfigRepository,
    private readonly grants: IEntitlementGrantRepository,
    private readonly entitlements: EntitlementService,
    private readonly audit: IAuditLogger,
    private readonly clock: IClock,
    private readonly catalog?: IPlanCatalogRepository,
  ) {}

  async handle(): Promise<Result<GrandfatherByoLlmOutcome[], DomainError>> {
    const now = this.clock.now();
    const tenantsResult = await this.llmConfigs.listEnabledTenantScopeIds();
    if (!tenantsResult.ok) return tenantsResult;

    const overridesResult: Result<PlanCatalogOverride[]> = this.catalog ? await this.catalog.listOverrides() : { ok: true, value: [] };
    if (!overridesResult.ok) return overridesResult;
    const catalogOverrideByPlan = new Map(overridesResult.value.map((o) => [o.planCode, o] as const));

    const outcomes: GrandfatherByoLlmOutcome[] = [];

    for (const tenantId of tenantsResult.value) {
      const entitlementResult = await this.entitlements.resolve({ tenantId, now });
      if (!entitlementResult.ok) return entitlementResult;
      const snapshot = entitlementResult.value;
      if (snapshot.limits.byoLlmEnabled) continue; // already allowed, nothing to grandfather
      if (!isPlanCode(snapshot.planCode)) continue; // defensive; catalog plan codes are always valid
      const planCode: PlanCode = snapshot.planCode;

      const existingResult = await this.grants.listEffectiveByTenant(tenantId, now);
      if (!existingResult.ok) return existingResult;
      const alreadyGrandfathered = existingResult.value.some(
        (g) => g.source === "MANUAL" && g.reason?.startsWith(GRANDFATHER_BYO_LLM_REASON_PREFIX),
      );
      if (alreadyGrandfathered) continue;

      // Full PlanLimitsJson (not just byoLlmEnabled): calculateEntitlement
      // reads `overrideLimits` as a complete PlanLimits object, so a partial
      // override would leave every other bucket `undefined`.
      const planLimits = resolvePlanLimitsWithOverride(planCode, catalogOverrideByPlan.get(planCode));
      const overrideLimitsJson = JSON.stringify({
        ...planLimitsToJson(planLimits),
        byoLlmEnabled: true,
      });
      const grant = EntitlementGrant.create({
        id: randomUUID(),
        props: {
          tenantId,
          planCode,
          source: "MANUAL",
          effectiveFrom: now,
          overrideLimitsJson,
          reason: `${GRANDFATHER_BYO_LLM_REASON_PREFIX}:${planCode.toLowerCase()}`,
          createdById: "system:phase22-migration",
        },
      });
      const created = await this.grants.create(grant);
      if (!created.ok) return created;

      await this.audit.record({
        tenantId: TenantId.create(tenantId),
        actorId: "system:phase22-migration",
        eventType: "billing.byo_llm.grandfathered",
        entityType: "Tenant",
        entityId: tenantId,
        newValue: JSON.stringify({ planCode }),
      });

      outcomes.push({ tenantId, planCode });
    }

    return { ok: true, value: outcomes };
  }
}
