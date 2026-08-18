import type { Result, VerifiedFinding, IndicatorUpdate, TenantId } from "@donordesk/domain";
import { DomainError, computeIndicator, inferIndicatorSemantics } from "@donordesk/domain";
import type { IIndicatorAnalyticsService } from "../ports/reporting.js";
import type { IReportingPeriodRepository } from "../ports/reporting.js";
import type { IIndicatorRepository, IIndicatorUpdateRepository } from "../ports/logframe.js";

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

    const currentUpdatesResult = await this.updates.findByReportingPeriod(input.reportingPeriodId, input.tenantId);
    if (!currentUpdatesResult.ok) return currentUpdatesResult;

    const previousPeriodsResult = await this.periods.findPreviousPeriods(input.projectId, input.reportingPeriodId, input.tenantId, 4);
    if (!previousPeriodsResult.ok) return previousPeriodsResult;

    const previousUpdatesByPeriod = new Map<string, IndicatorUpdate[]>();
    for (const prev of previousPeriodsResult.value) {
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
      findings.push({ ...finding, reportingPeriodId: input.reportingPeriodId });
    }

    return { ok: true, value: findings };
  }
}
