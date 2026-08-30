import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportDraftRepository } from "../../ports/reporting.js";
import type { IAuditLogger } from "../../ports/core.js";

/**
 * Reactivates a superseded working draft as the current draft for its
 * reporting period. Any other non-approved drafts of the period are
 * superseded in turn, so there is always exactly one current working draft.
 */
export class ActivateReportDraftHandler {
  constructor(private readonly drafts: IReportDraftRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, draftId: string): Promise<Result<{ id: string }, DomainError>> {
    const draftResult = await this.drafts.findById(draftId, ctx.tenant.tenantId);
    if (!draftResult.ok) return draftResult;
    const draft = draftResult.value;
    if (!draft) return { ok: false, error: DomainError.notFound("ReportDraft", draftId) };
    if (draft.status !== "DRAFT" && draft.status !== "UNDER_REVIEW") {
      return {
        ok: false,
        error: DomainError.invalidTransition("Only working drafts (draft or under review) can be reactivated"),
      };
    }

    const allResult = await this.drafts.findByReportingPeriod(draft.reportingPeriodId, ctx.tenant.tenantId);
    if (!allResult.ok) return allResult;
    const supersedeAt = new Date();
    for (const other of allResult.value) {
      if (other.id === draft.id) continue;
      if (!other.isSuperseded && (other.status === "DRAFT" || other.status === "UNDER_REVIEW")) {
        other.supersede(supersedeAt);
        const updated = await this.drafts.update(other);
        if (!updated.ok) return updated;
      }
    }

    draft.activate();
    const saved = await this.drafts.update(draft);
    if (!saved.ok) return saved;

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "report.draft.activated",
      entityType: "report_draft",
      entityId: draft.id,
      projectId: draft.projectId,
    });
    return { ok: true, value: { id: draft.id } };
  }
}
