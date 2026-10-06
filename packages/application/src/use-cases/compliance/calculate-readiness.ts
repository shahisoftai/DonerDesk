import { PeriodEvidenceScope } from "../../services/period-evidence-scope-service.js";
import type { Result } from "@donordesk/domain";
import { DomainError, lintReportContradictions, toLintFindingData, calculateReadiness, readinessStageFor, rankReadinessBlockers, DATA_QUALITY_PENALTY, type ReadinessBlocker, type ReadinessWeights, type ReadinessBreakdown, type ContradictionLintFindingData } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ILintGrounding } from "../../services/lint-grounding.js";
import type { IChecklistRepository, IChecklistReconciler } from "../../ports/compliance.js";
import type { IEvidenceRepository } from "../../ports/evidence.js";
import type { IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { IIndicatorRepository } from "../../ports/logframe.js";
import { resolvePeriodActivities, periodIndicatorScope, inIndicatorScope } from "../../services/period-activities.js";
import type { IActivityUpdateRepository } from "../../ports/activities.js";
import type { IDonorTemplateRepository } from "../../ports/templates.js";
import type {
  IReportingPeriodRepository,
  IReportDraftRepository,
  IReportSectionRepository,
  IIndicatorAnalyticsService,
} from "../../ports/reporting.js";

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
    /**
     * Optional analytics enabling the quality dimension: unresolved
     * cross-section contradiction blockers degrade `qualityScore` and cap
     * `overall`. Absent for legacy callers, whose scores are unchanged.
     */
    private readonly analytics?: IIndicatorAnalyticsService,
    /** Figures the project's own records state, so the quality lint does not flag them. */
    private readonly lintGrounding?: ILintGrounding,
    /** Closes the checklist items the data now satisfies before they are counted (single-period reads only). */
    private readonly reconciler?: IChecklistReconciler,
  ) {}

  async handle(
    ctx: AuthenticatedContext,
    reportingPeriodId: string,
    options: { reconcile?: boolean } = {},
  ): Promise<Result<ReadinessBreakdown & { reportingPeriodId: string; weights: ReadinessWeights; dataQualityPenalty: number; topBlockers: ReadinessBlocker[]; totalSections: number }, DomainError>> {
    if (options.reconcile) await this.reconciler?.reconcile(ctx, reportingPeriodId);
    const periodResult = await this.periods.findById(reportingPeriodId, ctx.tenant.tenantId);
    const period = periodResult.ok ? periodResult.value : null;
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
    let cleanSections = 0;

    if (draft) {
      const s = await this.sections.findByReportDraft(draft.id, ctx.tenant.tenantId);
      if (s.ok) {
        totalSections = s.value.length;
        approvedSections = s.value.filter((sec) => sec.status === "APPROVED").length;
        cleanSections = s.value.filter((sec) => sec.status === "APPROVED" || sec.unsupportedClaims.length === 0).length;
      }
      if (draft.status === "UNDER_REVIEW") {
        approvalProgress = 50;
      }
      if (draft.status === "APPROVED" || draft.status === "EXPORTED" || draft.status === "SUBMITTED") {
        approvalProgress = 100;
      }
    }

    const allIndUpdates = await this.updates.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId);
    // Only the indicators this report speaks about count (an activity report: its
    // activities' indicators; a situation report: none).
    const indicatorScope = period ? await periodIndicatorScope(this.activities, period, ctx.tenant.tenantId) : null;
    const indUpdates = allIndUpdates.ok && indicatorScope?.ok
      ? { ok: true as const, value: allIndUpdates.value.filter((u) => inIndicatorScope(indicatorScope.value, u.indicatorId)) }
      : allIndUpdates;
    if (indUpdates.ok) {
      totalIndicators = indUpdates.value.length;
      verifiedIndicators = indUpdates.value.filter((u) => u.verificationStatus === "VERIFIED").length;
    }

    // Evidence coverage counts every file that supports this period's report,
    // not only files tagged directly to the period: evidence attached to the
    // period's indicator updates and activity updates counts as well, matching
    // the evidence set the generation run actually consumes.
    const evidenceIds = new Set<string>();
    if (indUpdates.ok) {
      for (const u of indUpdates.value) {
        for (const id of u.attachedEvidenceIds) evidenceIds.add(id);
      }
    }
    const activityUpdates = period
      ? await resolvePeriodActivities(this.activities, period, ctx.tenant.tenantId)
      : await this.activities.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId);
    if (activityUpdates.ok) {
      for (const a of activityUpdates.value) {
        for (const id of a.attachedEvidenceIds) evidenceIds.add(id);
      }
    }
    if (period) {
      const scoped = await new PeriodEvidenceScope(this.evidence).filesFor(
        ctx.tenant.tenantId,
        period,
        activityUpdates.ok ? activityUpdates.value.map((a) => a.id) : [],
      );
      if (scoped.ok) for (const item of scoped.value) evidenceIds.add(item.id);
    } else {
      const periodTagged = await this.evidence.search({ reportingPeriodId, pageSize: 500 }, ctx.tenant.tenantId);
      if (periodTagged.ok) for (const item of periodTagged.value.items) evidenceIds.add(item.id);
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
    if (period?.donorTemplateId) {
      const templateResult = await this.templates.findById(period.donorTemplateId, ctx.tenant.tenantId);
      if (templateResult.ok && templateResult.value) {
        requiredEvidenceCount = Math.max(1, templateResult.value.requiredAnnexes.length);
      }
    }

    // Quality dimension: run the cross-section contradiction lint over the
    // current draft sections. "Readiness 100" must not be reachable while the
    // report text contradicts the verified data.
    let dataQualityBlockers: number | undefined;
    if (draft && this.analytics) {
      const s = await this.sections.findByReportDraft(draft.id, ctx.tenant.tenantId);
      if (s.ok && s.value.length > 0) {
        let lintFindingsData: ContradictionLintFindingData[] = [];
        const computed = await this.analytics.computeFindings({
          reportingPeriodId,
          projectId: draft.projectId,
          tenantId: ctx.tenant.tenantId,
        });
        let groundedFigures: string[] = [];
        if (computed.ok) {
          lintFindingsData = computed.value.map((f) => toLintFindingData(f));
          if (this.lintGrounding) {
            groundedFigures = await this.lintGrounding.figures({ tenantId: ctx.tenant.tenantId, projectId: draft.projectId, reportingPeriodId, findings: computed.value });
          }
        }
        const lintPeriod = await this.periods.findById(reportingPeriodId, ctx.tenant.tenantId);
        const lintPeriodValue = lintPeriod.ok ? lintPeriod.value : null;
        const lint = lintReportContradictions({
          sections: s.value.map((sec) => ({ id: sec.id, title: sec.sectionTitle, content: sec.content })),
          findings: lintFindingsData,
          groundedFigures,
          periodStart: lintPeriodValue?.duration?.start?.toISOString(),
          periodEnd: lintPeriodValue?.duration?.end?.toISOString(),
        });
        dataQualityBlockers = lint.blockers;
      }
    }

    const stage = readinessStageFor(draft?.status);
    const input = {
      totalSections,
      approvedSections,
      cleanSections,
      stage,
      totalIndicators,
      verifiedIndicators,
      requiredEvidenceCount,
      attachedEvidenceCount,
      totalChecklistItems,
      resolvedOrAcceptedItems,
      approvalProgress,
      dataQualityBlockers,
    };
    const breakdown = calculateReadiness(input);
    const uncappedOverall = (dataQualityBlockers ?? 0) > 0 ? calculateReadiness({ ...input, dataQualityBlockers: undefined }).overall : breakdown.overall;

    const openChecklist = cl.ok
      ? cl.value.filter((i) => i.status === "OPEN" || i.status === "IN_PROGRESS")
      : [];
    const topBlockers = rankReadinessBlockers(breakdown, {
      totalSections,
      sectionsNeedingAttention: Math.max(0, totalSections - (stage === "DRAFTING" ? cleanSections : approvedSections)),
      unverifiedIndicators: Math.max(0, totalIndicators - verifiedIndicators),
      unconfirmedCalculations: openChecklist.filter((i) => i.type === "INDICATOR_SEMANTICS_UNREVIEWED").length,
      openChecklistItems: openChecklist.length,
      evidenceShortfall: Math.max(0, requiredEvidenceCount - attachedEvidenceCount),
      openContradictions: dataQualityBlockers ?? 0,
      uncappedOverall,
    });

    return { ok: true, value: { ...breakdown, reportingPeriodId, dataQualityPenalty: DATA_QUALITY_PENALTY, topBlockers, totalSections } };
  }
}
