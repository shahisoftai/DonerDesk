import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IChecklistRepository } from "../../ports/compliance.js";
import type { IEvidenceRepository } from "../../ports/evidence.js";
import type { IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { IIndicatorRepository } from "../../ports/logframe.js";
import type { IActivityUpdateRepository } from "../../ports/activities.js";
import type { IDonorTemplateRepository } from "../../ports/templates.js";
import type {
  IReportingPeriodRepository,
  IReportDraftRepository,
  IReportSectionRepository,
} from "../../ports/reporting.js";
import { calculateReadiness, type ReadinessBreakdown } from "@donordesk/domain";

export class CalculateReadinessHandler {
  constructor(
    private readonly periods: IReportingPeriodRepository,
    private readonly drafts: IReportDraftRepository,
    private readonly sections: IReportSectionRepository,
    private readonly indicators: IIndicatorRepository,
    private readonly updates: IIndicatorUpdateRepository,
    private readonly evidence: IEvidenceRepository,
    private readonly activities: IActivityUpdateRepository,
    private readonly checklist: IChecklistRepository,
    private readonly templates: IDonorTemplateRepository,
  ) {}

  async handle(ctx: AuthenticatedContext, reportingPeriodId: string): Promise<Result<ReadinessBreakdown & { reportingPeriodId: string }, DomainError>> {
    const draftsResult = await this.drafts.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId);
    if (!draftsResult.ok) return draftsResult;
    const draft = draftsResult.value[0];
    let totalSections = 0;
    let approvedSections = 0;
    let totalIndicators = 0;
    let verifiedIndicators = 0;
    let attachedEvidenceCount = 0;
    let totalChecklistItems = 0;
    let resolvedOrAcceptedItems = 0;
    let approvalProgress = 0;

    if (draft) {
      const s = await this.sections.findByReportDraft(draft.id, ctx.tenant.tenantId);
      if (s.ok) {
        totalSections = s.value.length;
        approvedSections = s.value.filter((sec) => sec.status === "APPROVED").length;
      }
      if (draft.status === "UNDER_REVIEW") {
        approvalProgress = 50;
      }
      if (draft.status === "APPROVED" || draft.status === "EXPORTED" || draft.status === "SUBMITTED") {
        approvalProgress = 100;
      }
    }

    const indUpdates = await this.updates.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId);
    if (indUpdates.ok) {
      totalIndicators = indUpdates.value.length;
      verifiedIndicators = indUpdates.value.filter((u) => u.verificationStatus === "VERIFIED").length;
    }

    // Evidence coverage counts every file that supports this period's report,
    // not only files tagged directly to the period: evidence attached to the
    // period's indicator updates and activity updates counts as well, matching
    // the evidence set the generation run actually consumes.
    const evidenceIds = new Set<string>();
    const periodTagged = await this.evidence.search({ reportingPeriodId, pageSize: 500 }, ctx.tenant.tenantId);
    if (periodTagged.ok) {
      for (const item of periodTagged.value.items) evidenceIds.add(item.id);
    }
    if (indUpdates.ok) {
      for (const u of indUpdates.value) {
        for (const id of u.attachedEvidenceIds) evidenceIds.add(id);
      }
    }
    const activityUpdates = await this.activities.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId);
    if (activityUpdates.ok) {
      for (const a of activityUpdates.value) {
        for (const id of a.attachedEvidenceIds) evidenceIds.add(id);
      }
    }
    attachedEvidenceCount = evidenceIds.size;

    const cl = await this.checklist.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId);
    if (cl.ok) {
      totalChecklistItems = cl.value.length;
      resolvedOrAcceptedItems = cl.value.filter(
        (i) => i.status === "RESOLVED" || i.status === "ACCEPTED_RISK" || i.status === "NOT_APPLICABLE",
      ).length;
    }

    // Evidence requirement is driven by the donor template's required annexes
    // (authoritative), falling back to a baseline of one so the score stays
    // meaningful before a template is attached.
    let requiredEvidenceCount = 1;
    const periodResult = await this.periods.findById(reportingPeriodId, ctx.tenant.tenantId);
    const period = periodResult.ok ? periodResult.value : null;
    if (period?.donorTemplateId) {
      const templateResult = await this.templates.findById(period.donorTemplateId, ctx.tenant.tenantId);
      if (templateResult.ok && templateResult.value) {
        requiredEvidenceCount = Math.max(1, templateResult.value.requiredAnnexes.length);
      }
    }

    const breakdown = calculateReadiness({
      totalSections,
      approvedSections,
      totalIndicators,
      verifiedIndicators,
      requiredEvidenceCount,
      attachedEvidenceCount,
      totalChecklistItems,
      resolvedOrAcceptedItems,
      approvalProgress,
    });

    return { ok: true, value: { ...breakdown, reportingPeriodId } };
  }
}
