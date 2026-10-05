import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportSectionRepository } from "../../ports/reporting.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { ISectionChartService } from "../../services/section-chart-service.js";

/** Rebuilds a section's charts from the tables currently in its text (also how existing drafts pick up the table-aware charts). */
export class RefreshSectionChartsHandler {
  constructor(
    private readonly sections: IReportSectionRepository,
    private readonly charts: ISectionChartService,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, sectionId: string): Promise<Result<{ charts: number }, DomainError>> {
    const found = await this.sections.findById(sectionId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return { ok: false, error: DomainError.notFound("ReportSection", sectionId) };
    const section = found.value;
    const refreshed = await this.charts.refresh({ tenantId: ctx.tenant.tenantId, sectionId, revisionId: null, title: section.sectionTitle, content: section.content });
    if (!refreshed.ok) return refreshed;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "report.section.charts.refreshed",
      entityType: "report_section",
      entityId: sectionId,
      newValue: String(refreshed.value),
    });
    return { ok: true, value: { charts: refreshed.value } };
  }
}
