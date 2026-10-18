import { DomainError, suggestStoryFromPlan, type PlanStorySuggestion, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportingPeriodRepository } from "../../ports/reporting.js";
import type { IPlanDelivery } from "../../services/plan-delivery-service.js";

/** "Suggested from your plan": what "Tell the story" may offer for a period. Empty when nothing was planned for it. */
export class GetPlanStorySuggestionHandler {
  constructor(private readonly periods: IReportingPeriodRepository, private readonly plan: IPlanDelivery) {}

  async handle(ctx: AuthenticatedContext, periodId: string): Promise<Result<PlanStorySuggestion, DomainError>> {
    const period = await this.periods.findById(periodId, ctx.tenant.tenantId);
    if (!period.ok) return period;
    if (!period.value) return { ok: false, error: DomainError.notFound("ReportingPeriod", periodId) };
    const summary = await this.plan.forPeriod({ tenantId: ctx.tenant.tenantId, projectId: period.value.projectId, start: period.value.duration.start, end: period.value.duration.end });
    if (!summary.ok) return summary;
    return { ok: true, value: suggestStoryFromPlan(summary.value) };
  }
}
