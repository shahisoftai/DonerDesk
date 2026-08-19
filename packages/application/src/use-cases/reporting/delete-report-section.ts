import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type {
  IReportDraftRepository,
  IReportSectionRepository,
  IReportClaimRepository,
  IReportRevisionRepository,
} from "../../ports/reporting.js";
import type { IAuditLogger } from "../../ports/core.js";

/**
 * Removes a section and every artifact bound to it: revision-bound claims are
 * removed first (they reference revisions), then the revisions themselves
 * (which reference the section), then the section row. Without this ordering
 * the delete would fail on foreign keys for any section that was ever edited,
 * rewritten, or verified. Deleting is only permitted while the draft is still
 * DRAFT.
 */
export class DeleteReportSectionHandler {
  constructor(
    private readonly drafts: IReportDraftRepository,
    private readonly sections: IReportSectionRepository,
    private readonly claims: IReportClaimRepository,
    private readonly revisions: IReportRevisionRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, sectionId: string): Promise<Result<void, DomainError>> {
    const section = await this.sections.findById(sectionId, ctx.tenant.tenantId);
    if (!section.ok) return section;
    if (!section.value) return { ok: false, error: DomainError.notFound("ReportSection", sectionId) };

    const draft = await this.drafts.findById(section.value.reportDraftId, ctx.tenant.tenantId);
    if (!draft.ok) return draft;
    if (!draft.value) return { ok: false, error: DomainError.notFound("ReportDraft", section.value.reportDraftId) };
    if (draft.value.status !== "DRAFT") {
      return {
        ok: false,
        error: DomainError.invalidTransition("Sections can only be deleted while the report is in draft."),
      };
    }

    const claimsDeleted = await this.claims.deleteBySection(sectionId, ctx.tenant.tenantId);
    if (!claimsDeleted.ok) return claimsDeleted;
    const revisionsDeleted = await this.revisions.deleteBySection(sectionId, ctx.tenant.tenantId);
    if (!revisionsDeleted.ok) return revisionsDeleted;
    const deleted = await this.sections.delete(sectionId, ctx.tenant.tenantId);
    if (!deleted.ok) return deleted;

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "report.section.deleted",
      entityType: "report_section",
      entityId: sectionId,
      newValue: JSON.stringify({
        reportDraftId: section.value.reportDraftId,
        sectionTitle: section.value.sectionTitle,
      }),
    });

    return { ok: true, value: undefined };
  }
}
