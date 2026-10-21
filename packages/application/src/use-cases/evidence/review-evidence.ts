import { DomainError, checkEvidenceReview, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { IEvidenceRepository, IEvidenceUseGuard } from "../../ports/evidence.js";
import type { ReviewEvidenceInput } from "@donordesk/contracts";

/**
 * A reviewer's decision about a piece of evidence: verify it, ask for a correction, reject it, archive it, or bring it back. The moves
 * allowed and the reasons required are one table (`checkEvidenceReview`). A file an approved or sent report relies on cannot be
 * rejected or archived; the refusal names the report. Every decision is audited with its reason.
 */
export class ReviewEvidenceHandler {
  constructor(private readonly repo: IEvidenceRepository, private readonly audit: IAuditLogger, private readonly use?: IEvidenceUseGuard) {}

  async handle(ctx: AuthenticatedContext, evidenceId: string, input: ReviewEvidenceInput): Promise<Result<{ status: string }, DomainError>> {
    const found = await this.repo.findById(evidenceId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return { ok: false, error: DomainError.notFound("Evidence", evidenceId) };
    const evidence = found.value;
    const verdict = checkEvidenceReview(evidence.verificationStatus, input.action, input.note);
    if (!verdict.ok) return { ok: false, error: DomainError.validation(verdict.reason) };
    if (verdict.checkReportUse && this.use) {
      const used = await this.use.reportUsing(evidenceId, ctx.tenant.tenantId);
      if (!used.ok) return used;
      if (used.value) {
        return { ok: false, error: DomainError.validation(`The report "${used.value.reportTitle}" relies on this file. Reopen the report first if it has to change.`) };
      }
    }
    const before = evidence.verificationStatus;
    evidence.applyReview(verdict.to, input.action === "REQUEST_CORRECTION" || input.action === "REJECT" ? input.note : undefined);
    const saved = await this.repo.update(evidence);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: `evidence.${input.action.toLowerCase()}`, entityType: "evidence",
      entityId: evidenceId, projectId: evidence.projectId, oldValue: before, newValue: JSON.stringify({ status: verdict.to, ...(input.note ? { note: input.note } : {}) }),
    });
    return { ok: true, value: { status: verdict.to } };
  }
}
