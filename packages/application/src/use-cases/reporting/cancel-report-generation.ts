import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportDraftRepository, IReportSectionRepository } from "../../ports/reporting.js";
import type { IAuditLogger } from "../../ports/core.js";

/**
 * Stops an in-flight section-wise generation by superseding the current
 * working draft. The background loop observes the superseded marker between
 * sections and stops drafting. The user can then generate a fresh draft.
 */
export class CancelReportGenerationHandler {
  constructor(
    private readonly drafts: IReportDraftRepository,
    private readonly sections: IReportSectionRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, reportingPeriodId: string): Promise<Result<{ cancelled: boolean }, DomainError>> {
    const draftsResult = await this.drafts.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId);
    if (!draftsResult.ok) return draftsResult;
    const draft = draftsResult.value.find((d) => !d.isSuperseded);
    if (!draft) return { ok: true, value: { cancelled: false } };

    // Only a working draft is cancellable; an approved/exported/submitted
    // report has no in-flight generation to stop.
    if (draft.status !== "DRAFT" && draft.status !== "UNDER_REVIEW") {
      return { ok: true, value: { cancelled: false } };
    }

    const sectionsResult = await this.sections.findByReportDraft(draft.id, ctx.tenant.tenantId);
    const stillGenerating = sectionsResult.ok
      ? sectionsResult.value.some((s) => s.status === "NOT_STARTED")
      : false;

    draft.supersede(new Date());
    const updated = await this.drafts.update(draft);
    if (!updated.ok) return updated;

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "report.draft.generation_cancelled",
      entityType: "report_draft",
      entityId: draft.id,
      projectId: draft.projectId,
      newValue: JSON.stringify({ stillGenerating }),
    });
    return { ok: true, value: { cancelled: true } };
  }
}
