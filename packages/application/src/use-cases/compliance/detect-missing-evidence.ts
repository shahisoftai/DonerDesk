import type { Result } from "@donordesk/domain";
import type { ActivityUpdate, ReportingPeriod } from "@donordesk/domain";
import { DomainError, ChecklistItem, LIFE_OF_PROJECT_REPORT_TYPES, checklistTemplateForReportType, comparableReportTypes, periodComparability, isConcernTracked, isSatisfiedByFacts, stateItemsToClose, type ChecklistFacts, type Severity, type TemplateRequirements } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IChecklistRepository, IChecklistDetector } from "../../ports/compliance.js";
import type { IIdGenerator, IAuditLogger } from "../../ports/core.js";
import type {
  IReportingPeriodRepository,
  IReportDraftRepository,
  IReportSectionRepository,
} from "../../ports/reporting.js";
import { resolvePeriodActivities, periodIndicatorScope, inIndicatorScope } from "../../services/period-activities.js";
import type { IActivityUpdateRepository } from "../../ports/activities.js";
import type { IEvidenceRepository } from "../../ports/evidence.js";
import type { IDonorTemplateRepository } from "../../ports/templates.js";
import type { IIndicatorUpdateRepository, IIndicatorRepository } from "../../ports/logframe.js";
import type { IIndicatorAnalyticsService } from "../../ports/reporting.js";
import type { IFinanceInputs } from "../../services/finance-inputs.js";
import { semanticsReviewItems, confirmedSemanticsIndicatorIds, activityEvidenceItems, activityRecordAcceptedItems, cumulativeDataItems, financeItems, priorReportItem, type ChecklistSuggestion, type PriorPeriodStatus } from "../../services/report-type-checklist.js";

export class DetectMissingEvidenceHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly checklist: IChecklistRepository,
    private readonly detector: IChecklistDetector,
    private readonly periods: IReportingPeriodRepository,
    private readonly drafts: IReportDraftRepository,
    private readonly templates: IDonorTemplateRepository,
    private readonly indicatorUpdates: IIndicatorUpdateRepository,
    private readonly sections: IReportSectionRepository,
    private readonly activities: IActivityUpdateRepository,
    private readonly evidence: IEvidenceRepository,
    private readonly audit: IAuditLogger,
    private readonly analytics: IIndicatorAnalyticsService,
    /** Absent when the deployment has no finance support: no finance items are raised. */
    private readonly finance?: IFinanceInputs,
    /** Absent in legacy wiring: no "confirm this calculation" items are raised. */
    private readonly indicators?: IIndicatorRepository,
  ) {}

  /**
   * `SCAN` (the default) raises what is missing and closes what the data now satisfies. `RECONCILE` only closes: it is
   * what runs when someone looks at the checklist, so reading never creates work and nothing needs a manual scan.
   */
  async handle(ctx: AuthenticatedContext, reportingPeriodId: string, options: { mode?: "SCAN" | "RECONCILE" } = {}): Promise<Result<{ created: number; closed: number }, DomainError>> {
    const reconcileOnly = options.mode === "RECONCILE";
    const periodResult = await this.periods.findById(reportingPeriodId, ctx.tenant.tenantId);
    if (!periodResult.ok) return periodResult;
    if (!periodResult.value) return { ok: false, error: DomainError.notFound("ReportingPeriod", reportingPeriodId) };
    const period = periodResult.value;

    const requiredAnnexes: string[] = [];
    const donorRules: DonorRuleItem[] = [];
    if (period.donorTemplateId) {
      const t = await this.templates.findById(period.donorTemplateId, ctx.tenant.tenantId);
      if (t.ok && t.value) {
        requiredAnnexes.push(...t.value.requiredAnnexes);
        donorRules.push(...donorRequirementItems(t.value.requirements));
      }
    }

    const allUpdates = await this.indicatorUpdates.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId);
    if (!allUpdates.ok) return allUpdates;
    const indicatorScope = await periodIndicatorScope(this.activities, period, ctx.tenant.tenantId);
    if (!indicatorScope.ok) return indicatorScope;
    const updates = { ok: true as const, value: allUpdates.value.filter((u) => inIndicatorScope(indicatorScope.value, u.indicatorId)) };
    const verified = updates.value.filter((u) => u.verificationStatus === "VERIFIED").length;

    // A roll-up report (semi-annual, annual, final) reports on the project's life, so its evidence is the project's;
    // counting only the closing period's files would flag a well-evidenced project as short of evidence.
    const evidenceFilter = LIFE_OF_PROJECT_REPORT_TYPES.has(period.reportType) ? { projectId: period.projectId } : { projectId: period.projectId, reportingPeriodId };
    const ev = await this.evidence.search({ ...evidenceFilter, pageSize: 200 }, ctx.tenant.tenantId);
    if (!ev.ok) return ev;
    const evidenceCount = ev.value.total;

    const draftsResult = await this.drafts.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId);
    let sectionStatuses: Array<{ sectionId: string; status: string; hasUnsupportedClaims: boolean }> = [];
    const firstDraft = draftsResult.ok ? draftsResult.value[0] : undefined;
    if (firstDraft) {
      const sectionsResult = await this.sections.findByReportDraft(firstDraft.id, ctx.tenant.tenantId);
      sectionStatuses = sectionsResult.ok
        ? sectionsResult.value.map((s) => ({
            sectionId: s.id,
            status: s.status,
            hasUnsupportedClaims: s.unsupportedClaims.length > 0,
          }))
        : [];
    }

    const activitiesResult = await resolvePeriodActivities(this.activities, period, ctx.tenant.tenantId);
    const activitiesCount = activitiesResult.ok ? activitiesResult.value.length : 0;

    const suggestions = await this.detector.detect({
      reportingPeriodId,
      projectId: period.projectId,
      tenantId: ctx.tenant.tenantId,
      requiredAnnexes,
      requiredActivities: [],
      requiredIndicators: [],
      activitiesCount,
      verifiedIndicatorCount: verified,
      totalIndicatorCount: updates.value.length,
      evidenceCount,
      requiredEvidenceCount: requiredAnnexes.length * 2 + 5,
      sectionStatuses,
    });

    // Baseline items configured for the report type are part of every period's
    // compliance checklist (config-driven; see checklist-template.ts).
    const baseline = checklistTemplateForReportType(period.reportType).items.map((t) => ({
      type: t.type,
      title: t.title,
      description: t.description,
      severity: t.severity as Severity,
      relatedEntityType: undefined as string | undefined,
      relatedEntityId: undefined as string | undefined,
    }));
    const typeItems = await this.reportTypeItems(ctx, period, activitiesResult.ok ? activitiesResult.value : []);
    if (!typeItems.ok) return typeItems;
    const combined: ChecklistSuggestion[] = [...baseline, ...typeItems.value.items, ...suggestions, ...donorRules];

    // What the data says right now. A state concern the data already satisfies is not raised, and an open one is closed;
    // attestations are never touched by data, only a person decides those.
    const facts: ChecklistFacts = {
      evidenceCount,
      requiredEvidenceCount: requiredAnnexes.length * 2 + 5,
      activityCount: activitiesCount,
      verifiedIndicatorCount: verified,
      totalIndicatorCount: updates.value.length,
      ...(activitiesResult.ok ? { activityStatusById: new Map(activitiesResult.value.map((a) => [a.id, a.status])) } : {}),
      ...typeItems.value.facts,
    };
    if (this.indicators) {
      const all = await this.indicators.findByProject(period.projectId, ctx.tenant.tenantId);
      if (all.ok) {
        facts.confirmedSemanticsIds = confirmedSemanticsIndicatorIds(all.value);
        const scoped = all.value.filter((i) => i.disaggregationRequired && inIndicatorScope(indicatorScope.value, i.id));
        const withBreakdown = new Set(updates.value.filter((u) => u.disaggregation.length > 0).map((u) => u.indicatorId));
        facts.missingBreakdownCount = scoped.filter((i) => !withBreakdown.has(i.id)).length;
      }
    }
    // Dedupe: never create a second OPEN/IN_PROGRESS item for the same
    // (type, relatedEntityId) concern already tracked in this period.
    const existingResult = await this.checklist.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId);
    if (!existingResult.ok) return existingResult;
    const existingActiveKeys = new Set(
      existingResult.value
        .filter((i) => i.status === "OPEN" || i.status === "IN_PROGRESS")
        .map((i) => `${i.type}:${i.relatedEntityId ?? ""}`),
    );
    // Items raised before these concerns had their own type are still the same concern.
    const alreadyTracked = (suggestion: ChecklistSuggestion): boolean =>
      existingActiveKeys.has(`${suggestion.type}:${suggestion.relatedEntityId ?? ""}`) ||
      (LEGACY_TYPE[suggestion.type] !== undefined && existingActiveKeys.has(`${LEGACY_TYPE[suggestion.type]}:${suggestion.relatedEntityId ?? ""}`)) ||
      // A person's decision on an attestation stands until a new cause (a different item) is raised.
      isConcernTracked(existingResult.value, suggestion);
    const seenKeys = new Set<string>();

    let created = 0;
    for (const s of reconcileOnly ? [] : combined) {
      const key = `${s.type}:${s.relatedEntityId ?? ""}`;
      if (isSatisfiedByFacts(s.type, facts, s.relatedEntityId)) continue;
      if (alreadyTracked(s)) continue;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      const id = this.ids.generate();
      const item = ChecklistItem.create({
        id,
        tenantId: ctx.tenant.tenantId.toString(),
        projectId: period.projectId,
        reportingPeriodId,
        type: s.type,
        title: s.title,
        description: s.description,
        severity: s.severity,
        relatedEntityType: s.relatedEntityType,
        relatedEntityId: s.relatedEntityId,
      });
      const saved = await this.checklist.create(item);
      if (saved.ok) created++;
    }

    let closed = 0;
    for (const { item, reason } of stateItemsToClose(existingResult.value, facts)) {
      item.resolve(reason);
      const updated = await this.checklist.update(item);
      if (!updated.ok) continue;
      closed += 1;
      await this.audit.record({
        tenantId: ctx.tenant.tenantId,
        actorId: ctx.tenant.userId,
        eventType: "checklist.closed_by_data",
        entityType: "checklist_item",
        entityId: item.id,
        projectId: period.projectId,
        newValue: JSON.stringify({ type: item.type, reason, reportingPeriodId }),
      });
    }

    if (!reconcileOnly) {
      await this.audit.record({
        tenantId: ctx.tenant.tenantId,
        actorId: ctx.tenant.userId,
        eventType: "compliance.checklist.detected",
        entityType: "reporting_period",
        entityId: reportingPeriodId,
        projectId: period.projectId,
        newValue: `created=${created};closed=${closed}`,
      });
    }

    return { ok: true, value: { created, closed } };
  }

  /** The items that follow from the kind of report (what it covers and builds on). */
  private async reportTypeItems(ctx: AuthenticatedContext, period: ReportingPeriod, activities: ActivityUpdate[]): Promise<Result<{ items: ChecklistSuggestion[]; facts: ChecklistFacts }, DomainError>> {
    const items: ChecklistSuggestion[] = [];
    const facts: ChecklistFacts = {};
    if (period.reportType === "ACTIVITY") {
      items.push(...activityEvidenceItems(activities), ...activityRecordAcceptedItems(activities));
    }
    if (LIFE_OF_PROJECT_REPORT_TYPES.has(period.reportType)) {
      const findings = await this.analytics.computeFindings({ reportingPeriodId: period.id, projectId: period.projectId, tenantId: ctx.tenant.tenantId });
      if (!findings.ok) return findings;
      const gaps = cumulativeDataItems(findings.value, period.reportType);
      items.push(...gaps);
      facts.cumulativeGapIds = new Set(gaps.flatMap((g) => (g.relatedEntityId ? [g.relatedEntityId] : [])));
    }
    if (this.finance) {
      const status = await this.finance.statusFor(period, ctx.tenant.tenantId);
      if (!status.ok) return status;
      items.push(...financeItems(status.value));
      facts.financeStatus = status.value;
    }
    const prior = await this.priorReportStatuses(ctx, period);
    if (!prior.ok) return prior;
    const priorItem = priorReportItem(period, prior.value);
    if (priorItem) items.push(priorItem);
    facts.priorReportLinked = priorItem === undefined;
    if (this.indicators) {
      const all = await this.indicators.findByProject(period.projectId, ctx.tenant.tenantId);
      if (!all.ok) return all;
      const scope = await periodIndicatorScope(this.activities, period, ctx.tenant.tenantId);
      if (!scope.ok) return scope;
      items.push(...semanticsReviewItems(all.value.filter((i) => inIndicatorScope(scope.value, i.id))));
    }
    return { ok: true, value: { items, facts } };
  }

  /** Earlier reports this one may be compared with, newest first, and whether each is finished. */
  private async priorReportStatuses(ctx: AuthenticatedContext, period: ReportingPeriod): Promise<Result<PriorPeriodStatus[], DomainError>> {
    const comparability = periodComparability(period.reportType, period.scope);
    if (!comparability) return { ok: true, value: [] };
    const previous = await this.periods.findPreviousPeriods(period.projectId, period.id, ctx.tenant.tenantId, 20, {
      reportTypes: comparableReportTypes(comparability),
      ...(comparability.eventKey ? { eventKey: comparability.eventKey } : {}),
    });
    if (!previous.ok) return previous;
    const statuses: PriorPeriodStatus[] = [];
    for (const p of previous.value) {
      const drafts = await this.drafts.findByReportingPeriod(p.id, ctx.tenant.tenantId);
      if (!drafts.ok) return drafts;
      statuses.push({ period: p, finished: drafts.value.some((d) => d.status === "APPROVED" || d.status === "EXPORTED" || d.status === "SUBMITTED") });
    }
    return { ok: true, value: statuses };
  }
}

/** New item type → the generic type the same concern was raised as before it had its own. */
const LEGACY_TYPE: Readonly<Record<string, string>> = {
  ACTIVITY_RECORD_ACCEPTED: "MISSING_APPROVAL",
  AFFECTED_FIGURES_CONFIRMED: "MISSING_APPROVAL",
};

type DonorRuleItem = {
  type: "DONOR_REQUIREMENT";
  title: string;
  description: string;
  severity: Severity;
  relatedEntityType: string | undefined;
  relatedEntityId: string | undefined;
};

const RULE_SEVERITY: Record<TemplateRequirements["compliance"][number]["severity"], Severity> = { BLOCK: "HIGH", WARN: "MEDIUM", INFO: "LOW" };

/** Each donor compliance rule becomes a trackable checklist item (deduped by rule id). */
export function donorRequirementItems(requirements: TemplateRequirements): DonorRuleItem[] {
  return requirements.compliance.map((rule) => ({
    type: "DONOR_REQUIREMENT",
    title: rule.text.length > 120 ? `${rule.text.slice(0, 117)}…` : rule.text,
    description: `${rule.severity === "BLOCK" ? "Mandatory donor rule" : "Donor rule"}: ${rule.text}`,
    severity: RULE_SEVERITY[rule.severity],
    relatedEntityType: "template_requirement",
    relatedEntityId: rule.id,
  }));
}
