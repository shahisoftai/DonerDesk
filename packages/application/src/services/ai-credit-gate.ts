import { DomainError, TenantId } from "@donordesk/domain";
import type { Result } from "@donordesk/domain";
import type { IAuditLogger } from "../ports/core.js";
import type { ILlmUsageRepository, IPurchasedCreditPackRepository } from "../ports/billing.js";
import { monthStartUtc } from "../use-cases/billing/_usage.js";
import { resolveEntitlementEnforcementMode, type EntitlementEnforcementMode, type EntitlementService } from "./entitlement-service.js";

/**
 * Read-only check that a tenant still has DonorDesk AI credits this month
 * (plan quota, then active top-up packs). It reserves and consumes nothing:
 * work that is free per use (section regeneration) is simply refused once the
 * tenant is out of credits, so the credit limit cannot be bypassed.
 * The ledger of billable drafts is the source of truth, as in drafting.
 */
export class AiCreditGate {
  constructor(
    private readonly entitlements: EntitlementService,
    private readonly llmRuns: ILlmUsageRepository,
    private readonly audit: IAuditLogger,
    private readonly packs?: IPurchasedCreditPackRepository,
    private readonly mode: () => EntitlementEnforcementMode = resolveEntitlementEnforcementMode,
  ) {}

  async assertAvailable(tenantId: TenantId, actorId: string, now: Date = new Date()): Promise<Result<void, DomainError>> {
    const mode = this.mode();
    if (mode === "off") return { ok: true, value: undefined };

    const entitlement = await this.entitlements.resolve({ tenantId: tenantId.toString() });
    if (!entitlement.ok) return entitlement;
    const limit = entitlement.value.limits.monthlyAiDraftCredits;
    if (limit === null) return { ok: true, value: undefined };

    const used = await this.llmRuns.countAiReportDrafts(tenantId.toString(), monthStartUtc(now));
    if (!used.ok) return used;
    if (used.value < limit) return { ok: true, value: undefined };

    const packs = this.packs ? await this.packs.listActiveByTenant(tenantId.toString()) : null;
    if (packs && !packs.ok) return packs;
    if (packs && packs.value.some((pack) => pack.remaining > 0)) return { ok: true, value: undefined };

    if (mode === "report") {
      await this.audit.record({
        tenantId,
        actorId,
        eventType: "entitlement.limit_would_block",
        entityType: "entitlement",
        entityId: tenantId.toString(),
        newValue: JSON.stringify({ resource: "AI_CREDITS", limit: String(limit), used: String(used.value), via: "section-regeneration" }),
      });
      return { ok: true, value: undefined };
    }
    return {
      ok: false,
      error: DomainError.aiCreditsExhausted("AI draft credits exhausted for the current billing month.", {
        resource: "AI_CREDITS",
        limit: String(limit),
        usage: String(used.value),
        upgradePath: "/settings/billing",
      }),
    };
  }
}
