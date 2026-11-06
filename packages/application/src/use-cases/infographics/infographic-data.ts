import {
  DomainError,
  beneficiaryCounts,
  effectiveIndicatorSemantics,
  financeAppliesTo,
  isPeriodLocked,
  isRateIndicator,
  localDate,
  ok,
  periodSheetLabel,
  toPlainDate,
  activitiesByLocation,
  indicatorLocationRows,
  locationTargetActual,
  locationTrends,
  uniqueReach,
  NO_DELIVERY,
  type ActivitiesByLocation,
  type DisaggregationEntry,
  type IndicatorLocationView,
  type LocationTargetActualView,
  type LocationTrendsView,
  type UniqueReach,
  type Result,
} from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IClock } from "../../ports/core.js";
import type { IProjectRepository } from "../../ports/projects.js";
import type { ILogframeRepository, IIndicatorRepository, IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { IReportingPeriodRepository } from "../../ports/reporting.js";
import type { IPeriodFinancialRepository } from "../../ports/finance.js";
import type { IFinanceInputs } from "../../services/finance-inputs.js";
import type { IBeneficiaryRepository, IBeneficiaryLinkRepository, IDeliveryFactsReader, IPlanContextReader, IPlannedActivityRepository } from "../../ports/workplan.js";
import { toWorkPlanRow } from "../workplan/work-plan-row.js";

const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * One read for the Infographic Studio (Phase 31): the project's periods, indicators (each with its
 * per-location view), beneficiary reach, plan activities by location and verified finance — the
 * same records the Data Center reads, composed once so templates and the Data Center cannot
 * disagree. Every number comes from what was recorded; the domain's location functions decide what
 * may be summed, and gaps stay gaps.
 */
export class GetProjectInfographicDataHandler {
  constructor(
    private readonly projects: IProjectRepository,
    private readonly periods: IReportingPeriodRepository,
    private readonly indicators: IIndicatorRepository,
    private readonly updates: IIndicatorUpdateRepository,
    private readonly finance: IFinanceInputs,
    private readonly summaries: IPeriodFinancialRepository,
    private readonly beneficiaries: IBeneficiaryRepository,
    private readonly links: IBeneficiaryLinkRepository,
    private readonly plan: IPlannedActivityRepository,
    private readonly facts: IDeliveryFactsReader,
    private readonly planContext: IPlanContextReader,
    private readonly clock: IClock,
  ) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<ProjectInfographicDataDto, DomainError>> {
    const tenantId = ctx.tenant.tenantId;
    const project = await this.projects.findById(projectId, tenantId);
    if (!project.ok) return project;
    if (!project.value || project.value.archivedAt) return { ok: false, error: DomainError.notFound("Project", projectId) };

    const [periodsResult, indicatorsResult, mode, beneficiariesResult, linksResult, planResult, factsResult, covered] = await Promise.all([
      this.periods.findByProject(projectId, tenantId),
      this.indicators.findByProject(projectId, tenantId),
      this.finance.modeFor(projectId, tenantId),
      this.beneficiaries.findByProject(projectId, tenantId),
      this.links.findByProject(projectId, tenantId),
      this.plan.findByProject(projectId, tenantId),
      this.facts.factsByPlannedActivity(projectId, tenantId),
      this.planContext.reportCoveredRanges(projectId, tenantId),
    ]);
    if (!periodsResult.ok) return periodsResult;
    if (!indicatorsResult.ok) return indicatorsResult;
    if (!mode.ok) return mode;
    if (!beneficiariesResult.ok) return beneficiariesResult;
    if (!linksResult.ok) return linksResult;
    if (!planResult.ok) return planResult;
    if (!factsResult.ok) return factsResult;
    if (!covered.ok) return covered;

    const periods = [...periodsResult.value].sort((a, b) => a.duration.start.getTime() - b.duration.start.getTime());
    const periodOrder = periods.map((p) => p.id);
    const values = await this.updates.findByReportingPeriods(periodOrder, tenantId);
    if (!values.ok) return values;

    const updatesByIndicator = new Map<string, typeof values.value>();
    for (const update of values.value) {
      const bucket = updatesByIndicator.get(update.indicatorId);
      if (bucket) bucket.push(update);
      else updatesByIndicator.set(update.indicatorId, [update]);
    }
    const today = await todayFor(this.clock, this.planContext, projectId, tenantId);

    const indicators = indicatorsResult.value.map((indicator) => {
      const updates = [...(updatesByIndicator.get(indicator.id) ?? [])].sort(
        (a, b) => periodOrder.indexOf(a.reportingPeriodId) - periodOrder.indexOf(b.reportingPeriodId),
      );
      const locationInputs = updates.map((u) => ({
        reportingPeriodId: u.reportingPeriodId,
        periodAchievement: u.periodAchievement,
        cumulativeAchievement: u.cumulativeAchievement,
        verificationStatus: u.verificationStatus,
        disaggregation: u.disaggregation,
      }));
      const lowerIsBetter = effectiveIndicatorSemantics({ type: indicator.type, name: indicator.name, unit: indicator.unit, semantics: indicator.semantics }).direction === "LOWER_IS_BETTER";
      const base = {
        id: indicator.id,
        code: indicator.code,
        name: indicator.name,
        type: indicator.type,
        unit: indicator.unit,
        baseline: indicator.baseline,
        target: indicator.target,
        isRate: isRateIndicator({ type: indicator.type, unit: indicator.unit }),
        ...(lowerIsBetter ? { lowerIsBetter: true } : {}),
        targetBreakdowns: indicator.targetBreakdowns,
      };
      const latest = updates[updates.length - 1];
      return {
        ...base,
        location: indicatorLocationRows(base, locationInputs),
        targetActual: locationTargetActual({ ...base, lowerIsBetter }, locationInputs),
        trends: locationTrends(base, locationInputs, periodOrder),
        projectWideValue: latest
          ? {
              latestPeriodId: latest.reportingPeriodId,
              periodValue: latest.periodAchievement,
              cumulativeValue: latest.cumulativeAchievement,
              verified: updates.every((u) => u.verificationStatus === "VERIFIED"),
            }
          : null,
      };
    });

    const planRows = planResult.value.map((item) =>
      toWorkPlanRow(item, factsResult.value.get(item.id) ?? NO_DELIVERY, today, covered.value.some((r) => r.start <= item.plannedEnd && r.end >= item.plannedStart)),
    );

    const reach = uniqueReach({
      beneficiaries: beneficiariesResult.value.map((b) => ({ id: b.id, location: b.location })),
      links: linksResult.value,
      activities: planRows.map((r) => ({ plannedActivityId: r.id, location: r.location ?? "" })),
    });
    const counts = beneficiaryCounts(beneficiariesResult.value);

    const activities: ActivitiesByLocation = activitiesByLocation(planRows.map((r) => ({ location: r.location, signal: r.signal })));

    const financeEnabled = mode.value !== "DISABLED";
    const financeRows: ProjectInfographicDataDto["finance"]["rows"] = [];
    if (financeEnabled) {
      for (const p of periods) {
        if (!financeAppliesTo(mode.value, p.reportType)) continue;
        const found = await this.summaries.findByPeriod(p.id, tenantId);
        if (!found.ok) return found;
        if (!found.value) continue;
        const view = found.value.view();
        financeRows.push({
          periodId: p.id,
          currency: view.currency,
          budget: view.budget,
          expenditure: view.expenditure,
          ...(view.committed ? { committed: view.committed } : {}),
          balance: view.balance,
          ...(view.burnRatePercent ? { burnRatePercent: view.burnRatePercent } : {}),
          verified: found.value.isVerified,
        });
      }
    }

    const budget = project.value.budget;
    return {
      ok: true,
      value: {
        projectId,
        project: {
          title: project.value.title,
          projectCode: project.value.projectCode,
          donorName: project.value.donorName,
          sector: project.value.sector,
          country: project.value.country,
          ...(project.value.region ? { region: project.value.region } : {}),
          ...(project.value.district ? { district: project.value.district } : {}),
          start: isoDay(project.value.duration.start),
          end: isoDay(project.value.duration.end),
          ...(budget ? { budgetAmount: budget.amount, budgetCurrency: budget.currency } : {}),
          status: project.value.status,
        },
        periods: periods.map((p) => {
          const start = isoDay(p.duration.start);
          const end = isoDay(p.duration.end);
          return { id: p.id, label: periodSheetLabel(start, end), start, end, reportType: p.reportType, locked: isPeriodLocked(p.status.value), reportStatus: p.status.value };
        }),
        periodOrder,
        indicators,
        reach: { ...reach, registeredTotal: beneficiariesResult.value.length, bySex: counts.bySex, byAgeGroup: counts.byAgeGroup },
        activities,
        finance: { enabled: financeEnabled, rows: financeRows },
        provenance: {
          generatedAt: this.clock.now().toISOString(),
          unverifiedValues: values.value.filter((u) => u.verificationStatus !== "VERIFIED").length,
          locationTrackedIndicators: indicators.filter((i) => i.location.kind !== "PROJECT_WIDE").length,
          projectWideIndicators: indicators.filter((i) => i.location.kind === "PROJECT_WIDE").length,
        },
      },
    };
  }
}

async function todayFor(clock: IClock, planContext: IPlanContextReader, projectId: string, tenantId: import("@donordesk/domain").TenantId): Promise<import("@donordesk/domain").PlainDate> {
  const zone = planContext.timeZoneFor ? await planContext.timeZoneFor(projectId, tenantId) : undefined;
  return zone?.ok ? localDate(clock.now(), zone.value) : toPlainDate(clock.now())!;
}

export interface ProjectInfographicDataDto {
  projectId: string;
  project: {
    title: string;
    projectCode: string;
    donorName: string;
    sector: string;
    country: string;
    region?: string;
    district?: string;
    start: string;
    end: string;
    budgetAmount?: number;
    budgetCurrency?: string;
    status: string;
  };
  periods: Array<{ id: string; label: string; start: string; end: string; reportType: string; locked: boolean; reportStatus: string }>;
  periodOrder: string[];
  indicators: Array<{
    id: string;
    code: string;
    name: string;
    type: string;
    unit?: string;
    baseline: string;
    target: string;
    isRate: boolean;
    lowerIsBetter?: boolean;
    targetBreakdowns: DisaggregationEntry[];
    location: IndicatorLocationView;
    targetActual: LocationTargetActualView;
    trends: LocationTrendsView;
    projectWideValue: { latestPeriodId?: string; periodValue: string; cumulativeValue: string; verified: boolean } | null;
  }>;
  reach: UniqueReach & { registeredTotal: number; bySex: Record<string, number>; byAgeGroup: Record<string, number> };
  activities: ActivitiesByLocation;
  finance: {
    enabled: boolean;
    rows: Array<{ periodId: string; currency: string; budget: string; expenditure: string; committed?: string; balance: string; burnRatePercent?: string; verified: boolean }>;
  };
  provenance: { generatedAt: string; unverifiedValues: number; locationTrackedIndicators: number; projectWideIndicators: number };
}
