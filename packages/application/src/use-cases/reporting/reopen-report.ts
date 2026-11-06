import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportDraftRepository, IReportingPeriodRepository } from "../../ports/reporting.js";
import type { IAuditLogger } from "../../ports/core.js";

export interface ReopenReportInput {
  /** Why the report is being opened again (kept in the audit trail and shown on the report). */
  reason: string;
}

/**
 * Opens an approved, exported or submitted report for changes, for example to add a chart after approval. The report goes back
 * to DRAFT and must be approved again (the second-approver rule applies again); sections stay as they are until one is edited.
 * Reopening is audited with the reason, the previous status and who approved it before. Exports already made are untouched.
 */
export class ReopenReportHandler {
  constructor(
    private readonly drafts: IReportDraftRepository,
    private readonly periods: IReportingPeriodRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, draftId: string, input: ReopenReportInput): Promise<Result<{ status: string }, DomainError>> {
    const reason = input.reason.trim();
    if (reason.length < 5) return { ok: false, error: DomainError.validation("Say why the report is being reopened (at least a few words). It is kept in the audit trail.") };
    if (reason.length > 1000) return { ok: false, error: DomainError.validation("The reason is too long (1,000 characters at most).") };

    const found = await this.drafts.findById(draftId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return { ok: false, error: DomainError.notFound("ReportDraft", draftId) };
    const draft = found.value;
    const before = { status: draft.status, approvedById: draft.approvedById ?? null, approvedAt: draft.approvedAt ? draft.approvedAt.toISOString() : null };
    draft.reopen();
    const saved = await this.drafts.update(draft);
    if (!saved.ok) return saved;

    const period = await this.periods.findById(draft.reportingPeriodId, ctx.tenant.tenantId);
    if (period.ok && period.value) {
      period.value.reopenStatus();
      const updated = await this.periods.update(period.value);
      if (!updated.ok) return updated;
    }

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "report.draft.reopened",
      entityType: "report_draft",
      entityId: draftId,
      projectId: draft.projectId,
      oldValue: JSON.stringify(before),
      newValue: JSON.stringify({ reason }),
    });
    return { ok: true, value: { status: draft.status } };
  }
}
