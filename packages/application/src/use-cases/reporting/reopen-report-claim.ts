import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportClaimRepository, IReportSectionRepository, IReportAssuranceService } from "../../ports/reporting.js";
import type { IAuditLogger } from "../../ports/core.js";

/**
 * Undoes a claim decision (keep-with-note / leave-out) so the statement needs
 * a decision again — the editor's "Undo" after resolving (Report Editor U7).
 * The section's revision is reassessed so its assurance state and the gates
 * reflect the reopened statement. An approved section must be reopened
 * (edited) first: its approval covered the decision.
 */
export class ReopenReportClaimHandler {
  constructor(
    private readonly claims: IReportClaimRepository,
    private readonly sections: IReportSectionRepository,
    private readonly assuranceService: IReportAssuranceService,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, claimId: string): Promise<Result<void, DomainError>> {
    const claimResult = await this.claims.findById(claimId, ctx.tenant.tenantId);
    if (!claimResult.ok) return claimResult;
    const claim = claimResult.value;
    if (!claim) return { ok: false, error: DomainError.notFound("ReportClaim", claimId) };
    if (claim.resolvedById === undefined) {
      return { ok: false, error: DomainError.invalidTransition("This statement has no decision to undo.") };
    }

    const sectionResult = await this.sections.findById(claim.sectionId, ctx.tenant.tenantId);
    if (!sectionResult.ok) return sectionResult;
    const section = sectionResult.value;
    if (!section) return { ok: false, error: DomainError.notFound("ReportSection", claim.sectionId) };
    if (section.status === "APPROVED") {
      return { ok: false, error: DomainError.invalidTransition("This section is already approved. Edit the section to reopen it first.") };
    }

    const previous = { notes: claim.resolutionNotes ?? null };
    claim.reopen();
    const saved = await this.claims.update(claim);
    if (!saved.ok) return saved;

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "report.claim.reopened",
      entityType: "report_claim",
      entityId: claimId,
      projectId: claim.projectId,
      oldValue: JSON.stringify(previous),
    });

    if (section.currentRevisionId) {
      const assessed = await this.assuranceService.assessRevision({
        ctx: { tenantId: ctx.tenant.tenantId, userId: ctx.tenant.userId },
        sectionId: section.id,
        revisionId: section.currentRevisionId,
      });
      if (!assessed.ok) return assessed;
    }
    return { ok: true, value: undefined };
  }
}
