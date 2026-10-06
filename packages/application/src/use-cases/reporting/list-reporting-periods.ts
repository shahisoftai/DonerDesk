import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportingPeriodRepository, IReportDraftRepository } from "../../ports/reporting.js";
import { hasReleasedReport } from "@donordesk/domain";
import type { CalculateReadinessHandler } from "../compliance/calculate-readiness.js";

export class ListReportingPeriodsHandler {
  constructor(
    private readonly periods: IReportingPeriodRepository,
    private readonly readiness: CalculateReadinessHandler,
    /** Tells which periods have an approved or sent report, so the page offers only what the server will accept. */
    private readonly drafts?: IReportDraftRepository,
  ) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<Array<unknown>, DomainError>> {
    const r = await this.periods.findByProject(projectId, ctx.tenant.tenantId, { includeCancelled: true });
    if (!r.ok) return r;

    // Readiness is derived live (never persisted) so the list always reflects
    // the current state of sections, indicators, evidence, checklist, and approval.
    const withReadiness = await Promise.all(
      r.value.map(async (p) => {
        let readinessScore = p.readinessScore;
        const draftList = this.drafts ? await this.drafts.findByReportingPeriod(p.id, ctx.tenant.tenantId) : undefined;
        const releasedReport = draftList?.ok ? hasReleasedReport(draftList.value.map((d) => d.status)) : false;
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
          scope: p.scope,
          releasedReport,
          cancelled: p.isCancelled,
          cancelledAt: p.cancelledAt?.toISOString() ?? null,
          cancelReason: p.cancelReason ?? null,
        };
      }),
    );

    return { ok: true, value: withReadiness };
  }
}
