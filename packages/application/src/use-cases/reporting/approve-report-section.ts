import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
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
        error: DomainError.reportGateBlocked("Section has no revision; generate or edit the section before approval"),
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
          `Section revision ${revision.revisionNumber} has ${revision.assuranceState} assurance; reassess before approval`,
          { revisionId: revision.id, assuranceState: revision.assuranceState },
        ),
      };
    }

    const claimsResult = await this.claims.findBySection(sectionId, ctx.tenant.tenantId);
    if (!claimsResult.ok) return claimsResult;
    const unresolved = claimsResult.value.filter(
      (c) => c.verificationResult === "FAILED" && c.resolvedById === undefined,
    );
    if (unresolved.length > 0) {
      return {
        ok: false,
        error: DomainError.reportGateBlocked("Section contains unresolved claims; resolve or exclude them before approval", {
          unresolvedClaims: unresolved.map((c) => c.id),
        }),
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
