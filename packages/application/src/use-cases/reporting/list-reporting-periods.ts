import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportingPeriodRepository } from "../../ports/reporting.js";
import type { CalculateReadinessHandler } from "../compliance/calculate-readiness.js";

export class ListReportingPeriodsHandler {
  constructor(
    private readonly periods: IReportingPeriodRepository,
    private readonly readiness: CalculateReadinessHandler,
  ) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<Array<unknown>, DomainError>> {
    const r = await this.periods.findByProject(projectId, ctx.tenant.tenantId);
    if (!r.ok) return r;

    // Readiness is derived live (never persisted) so the list always reflects
    // the current state of sections, indicators, evidence, checklist, and approval.
    const withReadiness = await Promise.all(
      r.value.map(async (p) => {
        let readinessScore = p.readinessScore;
        const breakdown = await this.readiness.handle(ctx, p.id);
        if (breakdown.ok) readinessScore = breakdown.value.overall;
        return {
          id: p.id,
          reportType: p.reportType,
          status: p.status.toString(),
          readinessScore,
          deadline: p.deadline.toISOString(),
          internalReviewDeadline: p.internalReviewDeadline?.toISOString(),
          startDate: p.duration.start.toISOString(),
          endDate: p.duration.end.toISOString(),
          daysUntilDeadline: p.daysUntilDeadline(),
          donorTemplateId: p.donorTemplateId,
        };
      }),
    );

    return { ok: true, value: withReadiness };
  }
}
