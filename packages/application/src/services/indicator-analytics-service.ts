import type { Result, VerifiedFinding, IndicatorUpdate, ReportingPeriod, TenantId } from "@donordesk/domain";
import { CADENCE_REPORT_TYPES, DomainError, LIFE_OF_PROJECT_REPORT_TYPES, comparableReportTypes, computeLifeOfProject, computeIndicator, evaluatePerformance, inferIndicatorSemantics, periodComparability, selectComparablePeriods } from "@donordesk/domain";
import type { IIndicatorAnalyticsService } from "../ports/reporting.js";
import type { IReportingPeriodRepository } from "../ports/reporting.js";
import type { IIndicatorRepository, IIndicatorUpdateRepository, ILogframeRepository } from "../ports/logframe.js";

/** Candidate periods read before choosing the comparable ones. */
const PREVIOUS_PERIOD_WINDOW = 20;

/**
 * Deterministic indicator analytics. The sole authority over indicator
 * mathematics: it aggregates verified indicator updates through the domain
 * calculator and performs period-on-period comparisons. No LLM is involved;
 * the service is fully testable without any provider.
 */
export class IndicatorAnalyticsService implements IIndicatorAnalyticsService {
  constructor(
    private readonly periods: IReportingPeriodRepository,
    private readonly indicators: IIndicatorRepository,
    private readonly updates: IIndicatorUpdateRepository,
    private readonly logframe?: ILogframeRepository,
  ) {}

  async computeFindings(input: {
    reportingPeriodId: string;
    projectId: string;
    tenantId: TenantId;
  }): Promise<Result<VerifiedFinding[], DomainError>> {
    const periodResult = await this.periods.findById(input.reportingPeriodId, input.tenantId);
    if (!periodResult.ok) return periodResult;
    if (!periodResult.value) {
      return { ok: false, error: DomainError.notFound("ReportingPeriod", input.reportingPeriodId) };
    }

    const indicatorsResult = await this.indicators.findByProject(input.projectId, input.tenantId);
    if (!indicatorsResult.ok) return indicatorsResult;

    const levelByItem = new Map<string, string>();
    if (this.logframe) {
      const items = await this.logframe.findByProject(input.projectId, input.tenantId);
      if (items.ok) for (const item of items.value) levelByItem.set(item.id, item.level);
    }

    const currentUpdatesResult = await this.updates.findByReportingPeriod(input.reportingPeriodId, input.tenantId);
    if (!currentUpdatesResult.ok) return currentUpdatesResult;

    // Deltas are against reports of the same kind (a quarter is not compared with a
    // monthly or activity report inside it); types without a comparison keep all history.
    const comparability = periodComparability(periodResult.value.reportType, periodResult.value.scope);
    const previousPeriodsResult = await this.periods.findPreviousPeriods(
      input.projectId,
      input.reportingPeriodId,
      input.tenantId,
      comparability ? PREVIOUS_PERIOD_WINDOW : 4,
      comparability ? { reportTypes: comparableReportTypes(comparability) } : undefined,
    );
    if (!previousPeriodsResult.ok) return previousPeriodsResult;
    const previousPeriods = comparability ? selectComparablePeriods(previousPeriodsResult.value, comparability, 4) : previousPeriodsResult.value;

    const previousUpdatesByPeriod = new Map<string, IndicatorUpdate[]>();
    for (const prev of previousPeriods) {
      const result = await this.updates.findByReportingPeriod(prev.id, input.tenantId);
      if (result.ok) previousUpdatesByPeriod.set(prev.id, result.value);
    }

    const currentUpdates = currentUpdatesResult.value;
    const indicators = indicatorsResult.value;
    const findings: VerifiedFinding[] = [];

    for (const ind of indicators) {
      const semantics = ind.semantics ?? inferIndicatorSemantics({ type: ind.type, unit: ind.unit, name: ind.name });
      const indUpdates = currentUpdates.filter((u) => u.indicatorId === ind.id);

      let comparisonPeriodId: string | undefined;
      let comparisonValue: string | undefined;
      for (const [prevPeriodId, prevUpdates] of previousUpdatesByPeriod) {
        const matches = prevUpdates.filter((u) => u.indicatorId === ind.id);
        if (matches.length === 0) continue;
        const prevFinding = computeIndicator({
          indicatorId: ind.id,
          indicatorCode: ind.code,
          indicatorName: ind.name,
          indicatorType: ind.type,
          unit: ind.unit,
          baseline: ind.baseline,
          target: ind.target,
          semantics,
          disaggregationRequired: ind.disaggregationRequired,
          updates: matches,
        });
        comparisonPeriodId = prevPeriodId;
        comparisonValue = prevFinding.value;
        break;
      }

      let numeratorValues: string[] | undefined;
      let denominatorValues: string[] | undefined;
      if (semantics.numeratorIndicatorId || semantics.denominatorIndicatorId) {
        const numInd = indicators.find((i) => i.id === semantics.numeratorIndicatorId);
        const denInd = indicators.find((i) => i.id === semantics.denominatorIndicatorId);
        if (numInd) {
          numeratorValues = currentUpdates
            .filter((u) => u.indicatorId === numInd.id && u.verificationStatus === "VERIFIED")
            .map((u) => u.periodAchievement);
        }
        if (denInd) {
          denominatorValues = currentUpdates
            .filter((u) => u.indicatorId === denInd.id && u.verificationStatus === "VERIFIED")
            .map((u) => u.periodAchievement);
        }
      }

      const finding = computeIndicator({
        indicatorId: ind.id,
        indicatorCode: ind.code,
        indicatorName: ind.name,
        indicatorType: ind.type,
        unit: ind.unit,
        baseline: ind.baseline,
        target: ind.target,
        semantics,
        disaggregationRequired: ind.disaggregationRequired,
        updates: indUpdates,
        comparisonPeriodId,
        comparisonPeriodFindingValue: comparisonValue,
        numeratorValues,
        denominatorValues,
      });
      const level = levelByItem.get(ind.logframeItemId);
      findings.push({ ...finding, reportingPeriodId: input.reportingPeriodId, ...(level ? { level } : {}) });
    }

    if (LIFE_OF_PROJECT_REPORT_TYPES.has(periodResult.value.reportType)) {
      return this.addLifeOfProject(findings, periodResult.value, input);
    }

    return { ok: true, value: findings };
  }

  /**
   * Adds progress since the project started to each finding: aggregated over the
   * project's cadence periods up to the end of this one (ad-hoc reports may
   * overlap cadence periods, so their updates are never counted twice).
   */
  private async addLifeOfProject(
    findings: VerifiedFinding[],
    current: ReportingPeriod,
    input: { projectId: string; tenantId: TenantId },
  ): Promise<Result<VerifiedFinding[], DomainError>> {
    const projectPeriods = await this.periods.findByProject(input.projectId, input.tenantId);
    if (!projectPeriods.ok) return projectPeriods;
    const periodEnd = new Map<string, Date>();
    for (const p of projectPeriods.value) {
      if (CADENCE_REPORT_TYPES.has(p.reportType) && p.duration.end.getTime() <= current.duration.end.getTime()) periodEnd.set(p.id, p.duration.end);
    }

    const enriched: VerifiedFinding[] = [];
    for (const finding of findings) {
      const semantics = finding.semantics;
      if (!semantics) {
        enriched.push(finding);
        continue;
      }
      const updates = await this.updates.findByIndicator(finding.indicatorId, input.tenantId);
      if (!updates.ok) return updates;
      const lifeOfProject = computeLifeOfProject(
        semantics,
        updates.value.flatMap((u) => {
          const end = periodEnd.get(u.reportingPeriodId);
          return end
            ? [{ periodId: u.reportingPeriodId, periodEnd: end, periodAchievement: u.periodAchievement, cumulativeAchievement: u.cumulativeAchievement, verificationStatus: u.verificationStatus, disaggregation: u.disaggregation }]
            : [];
        }),
      );
      // A roll-up report judges progress against the project's targets, so it is the life-of-project figure
      // that is evaluated: this period's value alone (the last month of a final report) is not what the
      // target measures, and would read "below expectation" for an indicator that met its target.
      enriched.push(
        lifeOfProject
          ? { ...finding, status: "REPORTED" as const, lifeOfProject, performanceEvaluation: evaluatePerformance({ value: lifeOfProject.value, baseline: finding.baseline, target: finding.target, semantics }) }
          : finding,
      );
    }
    return { ok: true, value: enriched };
  }
}
