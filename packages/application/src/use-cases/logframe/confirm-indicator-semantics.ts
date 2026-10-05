import type { Result } from "@donordesk/domain";
import { DomainError, effectiveIndicatorSemantics, sanitizeIndicatorSemantics, type IndicatorSemantics } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IIndicatorRepository } from "../../ports/logframe.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { ConfirmIndicatorSemanticsInput } from "@donordesk/contracts";

export interface ConfirmIndicatorSemanticsOutcome {
  confirmed: string[];
  /** Indicators that could not be confirmed as suggested, each with an actionable reason. */
  failed: Array<{ indicatorId: string; code?: string; message: string }>;
}

/**
 * One-click "this calculation is right": stores an indicator's *effective*
 * semantics (configured, else the shared inference) as CONFIGURED. It never
 * invents anything — the direction stays exactly what the effective semantics
 * state (NEUTRAL unless a person chose otherwise) — and refuses pairs that
 * cannot be calculated (a rate/ratio without numerator and denominator), which
 * must be configured by hand. Per-indicator results; one failure never blocks the rest.
 */
export class ConfirmIndicatorSemanticsHandler {
  constructor(private readonly indicators: IIndicatorRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, input: ConfirmIndicatorSemanticsInput): Promise<Result<ConfirmIndicatorSemanticsOutcome, DomainError>> {
    const confirmed: string[] = [];
    const failed: ConfirmIndicatorSemanticsOutcome["failed"] = [];

    for (const indicatorId of new Set(input.indicatorIds)) {
      const found = await this.indicators.findById(indicatorId, ctx.tenant.tenantId);
      if (!found.ok) return found;
      const indicator = found.value;
      if (!indicator) {
        failed.push({ indicatorId, code: "NOT_FOUND", message: "Indicator not found" });
        continue;
      }
      const effective = effectiveIndicatorSemantics(indicator);
      if (effective.status === "CONFIGURED") {
        confirmed.push(indicatorId);
        continue;
      }
      let semantics: IndicatorSemantics;
      try {
        semantics = sanitizeIndicatorSemantics({ ...effective, status: "CONFIGURED" });
      } catch (e) {
        failed.push({
          indicatorId,
          code: "VALIDATION",
          message: `${indicator.code}: ${e instanceof Error ? e.message : "Invalid calculation"}. Open the indicator and choose its calculation.`,
        });
        continue;
      }
      indicator.update({ semanticsJson: JSON.stringify(semantics) });
      const saved = await this.indicators.update(indicator);
      if (!saved.ok) return saved;
      await this.audit.record({
        tenantId: ctx.tenant.tenantId,
        actorId: ctx.tenant.userId,
        eventType: "logframe.indicator.semantics_confirmed",
        entityType: "indicator",
        entityId: indicator.id,
        projectId: indicator.projectId,
        newValue: `${semantics.aggregation}/${semantics.direction}/${semantics.reportingBasis}`,
      });
      confirmed.push(indicatorId);
    }
    return { ok: true, value: { confirmed, failed } };
  }
}
