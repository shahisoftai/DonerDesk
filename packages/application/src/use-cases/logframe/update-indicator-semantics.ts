import type { Result, IndicatorSemantics } from "@donordesk/domain";
import { DomainError, sanitizeIndicatorSemantics } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IIndicatorRepository } from "../../ports/logframe.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { UpdateIndicatorSemanticsInput } from "@donordesk/contracts";

/**
 * Lets a project owner declare how an indicator's value is aggregated and
 * whether higher or lower is better. This is the only way to resolve the
 * "no denominator configured" gap: percentage/ratio indicators are either
 * calculated from a numerator + denominator indicator (PERCENTAGE/RATIO), or
 * declared as directly reported rates (e.g. survey results) via LATEST.
 * The resulting semantics are always CONFIGURED — an explicit human decision.
 */
export class UpdateIndicatorSemanticsHandler {
  constructor(private readonly indicators: IIndicatorRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, input: UpdateIndicatorSemanticsInput): Promise<Result<{ id: string }, DomainError>> {
    const found = await this.indicators.findById(input.indicatorId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    const indicator = found.value;
    if (!indicator) return { ok: false, error: DomainError.notFound("Indicator", input.indicatorId) };

    for (const refId of [input.numeratorIndicatorId, input.denominatorIndicatorId]) {
      if (!refId) continue;
      const ref = await this.indicators.findById(refId, ctx.tenant.tenantId);
      if (!ref.ok) return ref;
      if (!ref.value || ref.value.projectId !== indicator.projectId) {
        return { ok: false, error: DomainError.validation("Numerator and denominator must be indicators of the same project") };
      }
    }

    let semantics: IndicatorSemantics;
    try {
      semantics = sanitizeIndicatorSemantics({
        aggregation: input.aggregation,
        direction: input.direction,
        reportingBasis: input.reportingBasis,
        numeratorIndicatorId: input.numeratorIndicatorId,
        denominatorIndicatorId: input.denominatorIndicatorId,
        status: "CONFIGURED",
      });
    } catch (e) {
      return { ok: false, error: DomainError.validation(e instanceof Error ? e.message : "Invalid indicator semantics") };
    }

    indicator.update({ semanticsJson: JSON.stringify(semantics) });
    const saved = await this.indicators.update(indicator);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "logframe.indicator.semantics_configured",
      entityType: "indicator",
      entityId: indicator.id,
      projectId: indicator.projectId,
      newValue: `${semantics.aggregation}/${semantics.direction}/${semantics.reportingBasis}`,
    });
    return { ok: true, value: { id: indicator.id } };
  }
}
