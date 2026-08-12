import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportDraftRepository, IReportingPeriodRepository } from "../../ports/reporting.js";
import type { IAuditLogger } from "../../ports/core.js";

export class ApproveReportHandler {
  constructor(private readonly drafts: IReportDraftRepository, private readonly periods: IReportingPeriodRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, draftId: string): Promise<Result<void, DomainError>> {
    const r = await this.drafts.findById(draftId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    if (!r.value) return { ok: false, error: DomainError.notFound("ReportDraft", draftId) };
    const draft = r.value;
    draft.approve(ctx.tenant.userId);
    const saved = await this.drafts.update(draft);
    if (!saved.ok) return saved;

    const periodResult = await this.periods.findById(draft.reportingPeriodId, ctx.tenant.tenantId);
    if (periodResult.ok && periodResult.value) {
      const period = periodResult.value;
      period.transitionTo(period.status);
      const savedPeriod = await this.periods.update(period);
      if (!savedPeriod.ok) return savedPeriod;
    }

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "report.approved",
      entityType: "report_draft",
      entityId: draftId,
    });
    return { ok: true, value: undefined };
  }
}
