import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IIndicatorRepository } from "../../ports/logframe.js";
import type { IAuditLogger } from "../../ports/core.js";

/** Brings an archived indicator back, with every value it had. */
export class RestoreIndicatorHandler {
  constructor(private readonly indicators: IIndicatorRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, indicatorId: string): Promise<Result<{ id: string }, DomainError>> {
    const found = await this.indicators.findById(indicatorId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    const indicator = found.value;
    if (!indicator) return { ok: false, error: DomainError.notFound("Indicator", indicatorId) };
    if (!indicator.isArchived) return { ok: true, value: { id: indicator.id } };
    indicator.restore();
    const saved = await this.indicators.update(indicator);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "logframe.indicator.restored",
      entityType: "indicator",
      entityId: indicator.id,
      projectId: indicator.projectId,
      newValue: indicator.code,
    });
    return { ok: true, value: { id: indicator.id } };
  }
}
