import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type {
  IReportSectionRepository,
  IReportRevisionRepository,
  IReportAssuranceService,
  AssessRevisionResult,
} from "../../ports/reporting.js";
import type { IAuditLogger } from "../../ports/core.js";

/**
 * Re-runs the assurance pipeline for a revision (extract -> reconcile ->
 * verify -> persist -> set assurance). Without a revision id, reassesses the
 * section's current revision. Used after evidence changes or manual review.
 */
export class ReassessReportRevisionHandler {
  constructor(
    private readonly sections: IReportSectionRepository,
    private readonly revisions: IReportRevisionRepository,
    private readonly assuranceService: IReportAssuranceService,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, sectionId: string, revisionId?: string): Promise<Result<AssessRevisionResult, DomainError>> {
    const sectionResult = await this.sections.findById(sectionId, ctx.tenant.tenantId);
    if (!sectionResult.ok) return sectionResult;
    const section = sectionResult.value;
    if (!section) return { ok: false, error: DomainError.notFound("ReportSection", sectionId) };

    const targetRevisionId = revisionId ?? section.currentRevisionId;
    if (!targetRevisionId) {
      return { ok: false, error: DomainError.invariant("Section has no revision to reassess") };
    }

    const assessed = await this.assuranceService.assessRevision({
      ctx: { tenantId: ctx.tenant.tenantId, userId: ctx.tenant.userId },
      sectionId,
      revisionId: targetRevisionId,
    });
    if (!assessed.ok) return assessed;

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "report.revision.reassessed",
      entityType: "report_revision",
      entityId: targetRevisionId,
      projectId: undefined,
      newValue: JSON.stringify({
        assuranceState: assessed.value.assuranceState,
        blocked: assessed.value.blocked,
        blockReasons: assessed.value.blockReasons,
        totalAssertions: assessed.value.coverage.totalAssertions,
        materialAssertions: assessed.value.coverage.materialAssertions,
      }),
    });

    return { ok: true, value: assessed.value };
  }
}
