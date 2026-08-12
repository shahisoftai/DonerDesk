import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IChecklistRepository } from "../../ports/compliance.js";

export class ListChecklistHandler {
  constructor(private readonly repo: IChecklistRepository) {}

  async handle(ctx: AuthenticatedContext, reportingPeriodId: string): Promise<Result<unknown[], DomainError>> {
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
