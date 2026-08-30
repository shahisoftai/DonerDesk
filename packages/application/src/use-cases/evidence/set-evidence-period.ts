import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IEvidenceRepository } from "../../ports/evidence.js";
import type { IReportingPeriodRepository } from "../../ports/reporting.js";
import type { IAuditLogger } from "../../ports/core.js";

/**
 * Links an evidence file to (or unlinks it from) a reporting period. The
 * period must belong to the same project as the evidence file, so evidence is
 * never tagged across projects. This drives the report readiness "Evidence"
 * score and the evidence packages used by report generation.
 */
export class SetEvidencePeriodHandler {
  constructor(
    private readonly evidence: IEvidenceRepository,
    private readonly periods: IReportingPeriodRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, evidenceId: string, input: { reportingPeriodId: string | null }): Promise<Result<void, DomainError>> {
    const evidenceResult = await this.evidence.findById(evidenceId, ctx.tenant.tenantId);
    if (!evidenceResult.ok) return evidenceResult;
    const evidence = evidenceResult.value;
    if (!evidence) return { ok: false, error: DomainError.notFound("EvidenceFile", evidenceId) };

    if (input.reportingPeriodId) {
      const periodResult = await this.periods.findById(input.reportingPeriodId, ctx.tenant.tenantId);
      if (!periodResult.ok) return periodResult;
      const period = periodResult.value;
      if (!period) return { ok: false, error: DomainError.notFound("ReportingPeriod", input.reportingPeriodId) };
      if (period.projectId !== evidence.projectId) {
        return { ok: false, error: DomainError.validation("The reporting period belongs to a different project than this evidence file") };
      }
    }

    evidence.updateMetadata({ reportingPeriodId: input.reportingPeriodId ?? undefined });
    const saved = await this.evidence.update(evidence);
    if (!saved.ok) return saved;

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: input.reportingPeriodId ? "evidence.linked_to_period" : "evidence.unlinked_from_period",
      entityType: "evidence_file",
      entityId: evidenceId,
      projectId: evidence.projectId,
      newValue: JSON.stringify({ reportingPeriodId: input.reportingPeriodId }),
    });
    return { ok: true, value: undefined };
  }
}
