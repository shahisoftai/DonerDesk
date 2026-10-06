import type { Result } from "@donordesk/domain";
import { DomainError, decideIndicatorRemoval } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IIndicatorRepository, IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { IIndicatorApprovalGuard } from "../../ports/indicator-approval-guard.js";
import type { IAuditLogger } from "../../ports/core.js";

/** Removes an indicator: deleted when nothing was recorded for it, archived (values kept) when something was. */
export class ArchiveIndicatorHandler {
  constructor(
    private readonly indicators: IIndicatorRepository,
    private readonly updates: IIndicatorUpdateRepository,
    private readonly guard: IIndicatorApprovalGuard,
    private readonly audit: IAuditLogger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async handle(ctx: AuthenticatedContext, indicatorId: string): Promise<Result<{ outcome: "ARCHIVED" | "DELETED" }, DomainError>> {
    const found = await this.indicators.findById(indicatorId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    const indicator = found.value;
    if (!indicator) return { ok: false, error: DomainError.notFound("Indicator", indicatorId) };
    if (indicator.isArchived) return { ok: true, value: { outcome: "ARCHIVED" } };

    const values = await this.updates.findByIndicator(indicator.id, ctx.tenant.tenantId);
    if (!values.ok) return values;
    const used = await this.guard.isUsedInApprovedReport(ctx.tenant.tenantId, indicator.id);
    if (!used.ok) return used;
    const decision = decideIndicatorRemoval({ hasValues: values.value.length > 0, usedInApprovedReport: used.value });
    if (decision.outcome === "REFUSE") return { ok: false, error: DomainError.validation(decision.reason) };

    if (decision.outcome === "DELETE") {
      const deleted = await this.indicators.delete(indicator.id, ctx.tenant.tenantId);
      if (!deleted.ok) return deleted;
    } else {
      indicator.archive(this.now());
      const saved = await this.indicators.update(indicator);
      if (!saved.ok) return saved;
    }
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: decision.outcome === "DELETE" ? "logframe.indicator.deleted" : "logframe.indicator.archived",
      entityType: "indicator",
      entityId: indicator.id,
      projectId: indicator.projectId,
      oldValue: indicator.code,
    });
    return { ok: true, value: { outcome: decision.outcome === "DELETE" ? "DELETED" : "ARCHIVED" } };
  }
}
