import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportingPeriodRepository } from "../../ports/reporting.js";

export class ListReportingPeriodsHandler {
  constructor(private readonly periods: IReportingPeriodRepository) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<Array<unknown>, DomainError>> {
    const r = await this.periods.findByProject(projectId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    return {
      ok: true,
      value: r.value.map((p) => ({
        id: p.id,
        reportType: p.reportType,
        status: p.status.toString(),
        readinessScore: p.readinessScore,
        deadline: p.deadline.toISOString(),
        internalReviewDeadline: p.internalReviewDeadline?.toISOString(),
        startDate: p.duration.start.toISOString(),
        endDate: p.duration.end.toISOString(),
        daysUntilDeadline: p.daysUntilDeadline(),
        donorTemplateId: p.donorTemplateId,
      })),
    };
  }
}
