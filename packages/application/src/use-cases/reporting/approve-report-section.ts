import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportSectionRepository, IReportClaimRepository } from "../../ports/reporting.js";
import type { IAuditLogger } from "../../ports/core.js";

/**
 * Approves a report section only when the section's claims are resolved.
 * Any claim still FAILED (neither accepted-with-limitation nor excluded)
 * blocks section approval.
 */
export class ApproveReportSectionHandler {
  constructor(
    private readonly sections: IReportSectionRepository,
    private readonly claims: IReportClaimRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, sectionId: string): Promise<Result<void, DomainError>> {
    const r = await this.sections.findById(sectionId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    if (!r.value) return { ok: false, error: DomainError.notFound("ReportSection", sectionId) };
    const sec = r.value;

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
    });
    return { ok: true, value: undefined };
  }
}
