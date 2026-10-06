import type { Result } from "@donordesk/domain";
import { DomainError, RELEASED_DRAFT_STATUSES, isSynthesisSection } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportDraftRepository, IReportSectionRepository } from "../../ports/reporting.js";
import type { IAuditLogger } from "../../ports/core.js";

/**
 * "This summary still matches the report": a person confirms an executive summary or conclusion after the sections it
 * summarises changed in ways that do not affect it. The notice stays off until the sections change again.
 */
export class MarkSummaryCurrentHandler {
  constructor(
    private readonly sections: IReportSectionRepository,
    private readonly drafts: IReportDraftRepository,
    private readonly audit: IAuditLogger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async handle(ctx: AuthenticatedContext, sectionId: string): Promise<Result<{ summaryCurrentAt: string }, DomainError>> {
    const found = await this.sections.findById(sectionId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    const section = found.value;
    if (!section) return { ok: false, error: DomainError.notFound("ReportSection", sectionId) };
    if (!isSynthesisSection({ title: section.sectionTitle, templateSectionId: section.templateSectionId })) {
      return { ok: false, error: DomainError.validation("Only a summary section (executive summary or conclusion) can be marked as current") };
    }
    const draft = await this.drafts.findById(section.reportDraftId, ctx.tenant.tenantId);
    if (!draft.ok) return draft;
    if (draft.value && RELEASED_DRAFT_STATUSES.has(draft.value.status)) {
      return { ok: false, error: DomainError.invalidTransition("This report is approved; reopen it to change its summary") };
    }
    const at = this.now();
    section.markSummaryCurrent(at);
    const saved = await this.sections.update(section);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "report.summary.marked_current",
      entityType: "report_section",
      entityId: sectionId,
      projectId: draft.value?.projectId,
    });
    return { ok: true, value: { summaryCurrentAt: at.toISOString() } };
  }
}
