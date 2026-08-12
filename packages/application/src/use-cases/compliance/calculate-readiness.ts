import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IChecklistRepository } from "../../ports/compliance.js";
import type { IEvidenceRepository } from "../../ports/evidence.js";
import type { IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { IIndicatorRepository } from "../../ports/logframe.js";
import type { IReportDraftRepository, IReportSectionRepository } from "../../ports/reporting.js";
import { calculateReadiness, type ReadinessBreakdown } from "@donordesk/domain";

export class CalculateReadinessHandler {
  constructor(
    private readonly drafts: IReportDraftRepository,
    private readonly sections: IReportSectionRepository,
    private readonly indicators: IIndicatorRepository,
    private readonly updates: IIndicatorUpdateRepository,
    private readonly evidence: IEvidenceRepository,
    private readonly checklist: IChecklistRepository,
  ) {}

  async handle(ctx: AuthenticatedContext, reportingPeriodId: string): Promise<Result<ReadinessBreakdown & { reportingPeriodId: string }, DomainError>> {
    const draftsResult = await this.drafts.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId);
    if (!draftsResult.ok) return draftsResult;
    const draft = draftsResult.value[0];
    let totalSections = 0;
    let approvedSections = 0;
    let totalIndicators = 0;
    let verifiedIndicators = 0;
    let requiredEvidenceCount = 0;
    let attachedEvidenceCount = 0;
    let totalChecklistItems = 0;
    let resolvedOrAcceptedItems = 0;
    let approvalCompleted = false;

    if (draft) {
      const s = await this.sections.findByReportDraft(draft.id, ctx.tenant.tenantId);
      if (s.ok) {
        totalSections = s.value.length;
        approvedSections = s.value.filter((sec) => sec.status === "APPROVED").length;
      }
      if (draft.status === "APPROVED" || draft.status === "EXPORTED" || draft.status === "SUBMITTED") {
        approvalCompleted = true;
      }
    }

    const indUpdates = await this.updates.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId);
    if (indUpdates.ok) {
      totalIndicators = indUpdates.value.length;
      verifiedIndicators = indUpdates.value.filter((u) => u.verificationStatus === "VERIFIED").length;
    }

    const ev = await this.evidence.search({ reportingPeriodId, pageSize: 1 }, ctx.tenant.tenantId);
    if (ev.ok) attachedEvidenceCount = ev.value.total;

    const cl = await this.checklist.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId);
    if (cl.ok) {
      totalChecklistItems = cl.value.length;
      resolvedOrAcceptedItems = cl.value.filter(
        (i) => i.status === "RESOLVED" || i.status === "ACCEPTED_RISK" || i.status === "NOT_APPLICABLE",
      ).length;
    }

    requiredEvidenceCount = Math.max(1, Math.round(totalChecklistItems * 1.5));

    const breakdown = calculateReadiness({
      totalSections,
      approvedSections,
      totalIndicators,
      verifiedIndicators,
      requiredEvidenceCount,
      attachedEvidenceCount,
      totalChecklistItems,
      resolvedOrAcceptedItems,
      approvalCompleted,
    });

    return { ok: true, value: { ...breakdown, reportingPeriodId } };
  }
}
