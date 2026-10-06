import type { Result } from "@donordesk/domain";
import { DomainError, checkIndicatorMove } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IIndicatorRepository, ILogframeRepository } from "../../ports/logframe.js";
import type { IIndicatorApprovalGuard } from "../../ports/indicator-approval-guard.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { MoveIndicatorInput } from "@donordesk/contracts";

/** Moves an indicator to another logframe item of the same project, so a wrong parent is fixed without rebuilding the project. */
export class MoveIndicatorHandler {
  constructor(
    private readonly indicators: IIndicatorRepository,
    private readonly items: ILogframeRepository,
    private readonly guard: IIndicatorApprovalGuard,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, input: MoveIndicatorInput): Promise<Result<{ id: string; moved: boolean }, DomainError>> {
    const found = await this.indicators.findById(input.indicatorId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    const indicator = found.value;
    if (!indicator) return { ok: false, error: DomainError.notFound("Indicator", input.indicatorId) };
    const target = await this.items.findById(input.logframeItemId, ctx.tenant.tenantId);
    if (!target.ok) return target;
    const used = await this.guard.isUsedInApprovedReport(ctx.tenant.tenantId, indicator.id);
    if (!used.ok) return used;

    const verdict = checkIndicatorMove({
      indicatorProjectId: indicator.projectId,
      currentItemId: indicator.logframeItemId,
      targetItemId: input.logframeItemId,
      targetProjectId: target.value?.projectId,
      usedInApprovedReport: used.value,
    });
    if (!verdict.allowed) return { ok: false, error: DomainError.validation(verdict.reason) };
    if (!verdict.changes) return { ok: true, value: { id: indicator.id, moved: false } };

    const from = indicator.logframeItemId;
    indicator.moveTo(input.logframeItemId);
    const saved = await this.indicators.update(indicator);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "logframe.indicator.moved",
      entityType: "indicator",
      entityId: indicator.id,
      projectId: indicator.projectId,
      oldValue: from,
      newValue: input.logframeItemId,
    });
    return { ok: true, value: { id: indicator.id, moved: true } };
  }
}
