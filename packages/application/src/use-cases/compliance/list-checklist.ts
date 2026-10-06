import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IChecklistRepository, IChecklistReconciler } from "../../ports/compliance.js";

export class ListChecklistHandler {
  constructor(
    private readonly repo: IChecklistRepository,
    /** Closes the items the data now satisfies before they are listed. */
    private readonly reconciler?: IChecklistReconciler,
  ) {}

  async handle(ctx: AuthenticatedContext, reportingPeriodId: string): Promise<Result<unknown[], DomainError>> {
    await this.reconciler?.reconcile(ctx, reportingPeriodId);
    const r = await this.repo.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    return {
      ok: true,
      value: r.value.map((i) => ({
        id: i.id,
        reportingPeriodId: i.reportingPeriodId,
        type: i.type,
        title: i.title,
        description: i.description,
        severity: i.severity,
        relatedEntityType: i.relatedEntityType,
        relatedEntityId: i.relatedEntityId,
        assignedToId: i.assignedToId,
        dueDate: i.dueDate?.toISOString(),
        status: i.status,
        resolutionNotes: i.resolutionNotes,
      })),
    };
  }
}
