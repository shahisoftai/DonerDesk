import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportDraftRepository, IReportingPeriodRepository } from "../../ports/reporting.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { IReportNotifier } from "../../services/report-notifier.js";

export class SubmitReportForReviewHandler {
  constructor(private readonly drafts: IReportDraftRepository, private readonly audit: IAuditLogger, private readonly notifier?: IReportNotifier, private readonly periods?: IReportingPeriodRepository) {}

  async handle(ctx: AuthenticatedContext, draftId: string): Promise<Result<void, DomainError>> {
    const r = await this.drafts.findById(draftId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    if (!r.value) return { ok: false, error: DomainError.notFound("ReportDraft", draftId) };
    const draft = r.value;
    draft.requestReview();
    const saved = await this.drafts.update(draft);
    if (!saved.ok) return saved;
    // The period follows its report: it reads "under review", not "draft written", while a reviewer has it.
    if (this.periods) {
      const period = await this.periods.findById(draft.reportingPeriodId, ctx.tenant.tenantId);
      if (period.ok && period.value) {
        period.value.advanceStatus("UNDER_REVIEW");
        await this.periods.update(period.value);
      }
    }
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "report.draft.review_requested",
      entityType: "report_draft",
      entityId: draftId,
    });
    await this.notifier?.reviewRequested(ctx.tenant.tenantId, ctx.tenant.userId, draft);
    return { ok: true, value: undefined };
  }
}
