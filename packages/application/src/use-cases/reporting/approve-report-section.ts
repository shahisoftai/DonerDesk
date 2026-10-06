import type { Result } from "@donordesk/domain";
import { DomainError, agree, countOf } from "@donordesk/domain";
import { canApproveAssurance } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportSectionRepository, IReportClaimRepository, IReportRevisionRepository } from "../../ports/reporting.js";
import type { IAuditLogger } from "../../ports/core.js";

/**
 * Approves a report section only when its current revision has CURRENT
 * assurance (every material assertion detected and current) and no claim is
 * unresolved. Stale or unassessed revisions can never be approved.
 */
export class ApproveReportSectionHandler {
  constructor(
    private readonly sections: IReportSectionRepository,
    private readonly claims: IReportClaimRepository,
    private readonly revisions: IReportRevisionRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, sectionId: string): Promise<Result<void, DomainError>> {
    const r = await this.sections.findById(sectionId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    if (!r.value) return { ok: false, error: DomainError.notFound("ReportSection", sectionId) };
    const sec = r.value;

    if (!sec.currentRevisionId) {
      return {
        ok: false,
        error: DomainError.reportGateBlocked("This section has no content yet. Generate a draft or write the section before approving it."),
      };
    }
    const revisionResult = await this.revisions.findById(sec.currentRevisionId, ctx.tenant.tenantId);
    if (!revisionResult.ok) return revisionResult;
    const revision = revisionResult.value;
    if (!revision) return { ok: false, error: DomainError.notFound("ReportRevision", sec.currentRevisionId) };
    if (!canApproveAssurance(revision.assuranceState)) {
      return {
        ok: false,
        error: DomainError.reportGateBlocked(
          "This section needs fixes before it can be approved: some statements could not be verified. Edit them below, or accept a statement with a note / exclude it, then try again.",
          { revisionId: revision.id, assuranceState: revision.assuranceState },
        ),
      };
    }

    const claimsResult = await this.claims.findBySection(sectionId, ctx.tenant.tenantId);
    if (!claimsResult.ok) return claimsResult;
    // P0-3: only MATERIAL failed claims that are still unresolved block approval.
    // NOT_MATERIAL failures (non-claim / metadata that slipped through) must not
    // create blockers or noise in the review queue.
    const unresolved = claimsResult.value.filter(
      (c) => c.materiality === "MATERIAL" && c.verificationResult === "FAILED" && c.resolvedById === undefined,
    );
    if (unresolved.length > 0) {
      return {
        ok: false,
        error: DomainError.reportGateBlocked(
          `This section contains ${countOf(unresolved.length, "statement")} that still ${agree(unresolved.length, "needs", "need")} a decision. Accept each statement with a note or exclude it below, then try again.`,
          { unresolvedClaims: unresolved.map((c) => c.id) },
        ),
      };
    }

    sec.approve();
    const saved = await this.sections.update(sec);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "report.section.approved",
      entityType: "report_section",
      entityId: sectionId,
      newValue: JSON.stringify({ revisionId: revision.id, revisionNumber: revision.revisionNumber, revisionHash: revision.contentHash }),
    });
    return { ok: true, value: undefined };
  }
}
