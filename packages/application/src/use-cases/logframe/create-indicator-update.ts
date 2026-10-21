import type { Result } from "@donordesk/domain";
import { DomainError, indicatorValueProblem, isPeriodLocked, periodLockedMessage, validateDisaggregation } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IIndicatorRepository, IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { IReportingPeriodRepository } from "../../ports/reporting.js";
import type { IIdGenerator, IAuditLogger } from "../../ports/core.js";
import type { CreateIndicatorUpdateInput } from "@donordesk/contracts";
import type { IEvidenceLinker } from "../../ports/evidence-linker.js";
import { upsertIndicatorUpdate } from "./upsert-indicator-update.js";

import type { ITaskReconciliation } from "../../ports/tasks.js";

export class CreateIndicatorUpdateHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly repo: IIndicatorUpdateRepository,
    private readonly audit: IAuditLogger,
    private readonly indicators: IIndicatorRepository,
    private readonly periods: IReportingPeriodRepository,
    private readonly linker?: IEvidenceLinker,
    private readonly tasks?: ITaskReconciliation,
  ) {}

  async handle(ctx: AuthenticatedContext, input: CreateIndicatorUpdateInput): Promise<Result<{ id: string }, DomainError>> {
    // Same rules as the grid: a closed period is locked, and a breakdown is checked against the indicator, never dropped.
    const period = await this.periods.findById(input.reportingPeriodId, ctx.tenant.tenantId);
    if (!period.ok) return period;
    if (!period.value) return { ok: false, error: DomainError.notFound("ReportingPeriod", input.reportingPeriodId) };
    if (isPeriodLocked(period.value.status.value)) {
      return { ok: false, error: DomainError.conflict(periodLockedMessage(period.value.status.value)) };
    }
    const indicator = await this.indicators.findById(input.indicatorId, ctx.tenant.tenantId);
    if (!indicator.ok) return indicator;
    if (!indicator.value || indicator.value.projectId !== period.value.projectId) {
      return { ok: false, error: DomainError.notFound("Indicator", input.indicatorId) };
    }
    const problem =
      indicatorValueProblem(indicator.value, input.periodAchievement, "period") ?? indicatorValueProblem(indicator.value, input.cumulativeAchievement, "cumulative");
    if (problem) return { ok: false, error: DomainError.validation(problem) };
    let row = input;
    if (input.disaggregation) {
      const checked = validateDisaggregation(input.disaggregation, {
        indicatorType: indicator.value.type,
        periodAchievement: input.periodAchievement,
      });
      if (!checked.ok) {
        return { ok: false, error: DomainError.validation(`${indicator.value.code}: ${checked.error.message}`, checked.error.details) };
      }
      row = { ...input, disaggregation: checked.value };
    }
    const saved = await upsertIndicatorUpdate(this.ids, this.repo, ctx.tenant.tenantId, ctx.tenant.userId, input.reportingPeriodId, row, this.linker ? (u) => this.linker!.attachPendingFor(ctx, u) : undefined);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "logframe.indicator.updated",
      entityType: "indicator_update",
      entityId: saved.value.id,
      oldValue: saved.value.previousValue,
      newValue: input.periodAchievement,
    });
    await this.tasks?.reconcileForCurrentUser(ctx);
    return { ok: true, value: { id: saved.value.id } };
  }
}
