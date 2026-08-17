import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportDraftRepository } from "../../ports/reporting.js";
import type { IAuditLogger } from "../../ports/core.js";

/**
 * Rejects a report under review and returns it to DRAFT so gate blocks are
 * actionable. The rejection reason is captured in the audit trail.
 */
export class RejectReportHandler {
  constructor(private readonly drafts: IReportDraftRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, draftId: string, notes?: string): Promise<Result<void, DomainError>> {
    const r = await this.drafts.findById(draftId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    if (!r.value) return { ok: false, error: DomainError.notFound("ReportDraft", draftId) };
    const draft = r.value;
    draft.reject();
    const saved = await this.drafts.update(draft);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "report.draft.rejected",
      entityType: "report_draft",
      entityId: draftId,
      projectId: draft.projectId,
      newValue: JSON.stringify({ notes: notes ?? "" }),
    });
    return { ok: true, value: undefined };
  }
}
