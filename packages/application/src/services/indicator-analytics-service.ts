import type { Indicator, OutcomeNode, Result, VerifiedFinding, ReportingPeriod, TenantId } from "@donordesk/domain";
import { CADENCE_REPORT_TYPES, IndicatorUpdate, deriveFormulaCells, DomainError, LIFE_OF_PROJECT_REPORT_TYPES, comparableReportTypes, computeLifeOfProject, computeIndicator, evaluatePerformance, inferIndicatorSemantics, owningOutcome, periodComparability, selectComparablePeriods, varianceAgainst, withPeriodTarget } from "@donordesk/domain";
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
/**
 * A calculated indicator has no typed values: its updates are worked out here from the updates of the indicators it
 * comes from, so a drafted report reads it exactly as the Data Center shows it. Each calculated update is VERIFIED
 * only when every term was (`deriveFormulaCells`); it carries no breakdown, no evidence and no comment.
 */
export function withCalculatedUpdates(indicators: ReadonlyArray<Indicator>, updates: readonly IndicatorUpdate[], tenantId: TenantId): IndicatorUpdate[] {
  const formulaIds = new Set(indicators.filter((i) => i.formula).map((i) => i.id));
  if (formulaIds.size === 0) return [...updates];
  const typed = updates.filter((u) => !formulaIds.has(u.indicatorId));
  const periodIds = [...new Set(typed.map((u) => u.reportingPeriodId))];
  const derived = deriveFormulaCells(
    indicators.map((i) => ({ id: i.id, formula: i.formula })),
    typed.map((u) => ({ indicatorId: u.indicatorId, periodId: u.reportingPeriodId, periodValue: u.periodAchievement, cumulativeValue: u.cumulativeAchievement, status: u.verificationStatus })),
    periodIds,
  );
  return [
    ...typed,
    ...derived.map((c) => IndicatorUpdate.rehydrate({
      id: `calculated:${c.indicatorId}:${c.periodId}`, tenantId: tenantId.toString(), createdAt: new Date(0),
      props: { indicatorId: c.indicatorId, reportingPeriodId: c.periodId, periodAchievement: c.periodValue, cumulativeAchievement: c.cumulativeValue, attachedEvidenceIds: [], verificationStatus: c.status as IndicatorUpdate["verificationStatus"], createdById: "calculated" },
    })),
  ];
}

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
    let logframeNodes: OutcomeNode[] = [];
    if (this.logframe) {
      const items = await this.logframe.findByProject(input.projectId, input.tenantId);
      if (items.ok) {
        for (const item of items.value) levelByItem.set(item.id, item.level);
        logframeNodes = items.value.map((i) => ({ id: i.id, parentId: i.parentId, level: i.level, code: i.code, title: i.title }));
      }
    }

    const currentUpdatesResult = await this.updates.findByReportingPeriod(input.reportingPeriodId, input.tenantId);
    if (!currentUpdatesResult.ok) return currentUpdatesResult;
    const calculated = (list: IndicatorUpdate[]) => withCalculatedUpdates(indicatorsResult.value, list, input.tenantId);

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
      if (result.ok) previousUpdatesByPeriod.set(prev.id, calculated(result.value));
    }

    const currentUpdates = calculated(currentUpdatesResult.value);
    const indicators = indicatorsResult.value;
    const findings: VerifiedFinding[] = [];

    for (const ind of indicators) {
      const semantics = ind.semantics ?? inferIndicatorSemantics({ type: ind.type, unit: ind.unit, name: ind.name });
      const indUpdates = currentUpdates.filter((u) => u.indicatorId === ind.id);
      // "Not applicable this period" is an answer, not a gap: the indicator is left out of the period's findings
      // (so it is neither written about nor listed as not measured). A roll-up report still reads its life-of-project figure.
      if (!LIFE_OF_PROJECT_REPORT_TYPES.has(periodResult.value.reportType) && indUpdates.some((u) => u.isNotApplicable && u.verificationStatus !== "REJECTED" && u.verificationStatus !== "NEEDS_CORRECTION")) continue;

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
      const outcome = owningOutcome(logframeNodes, ind.logframeItemId);
      const periodEndDay = periodResult.value.duration.end.toISOString().slice(0, 10);
      findings.push({ ...withPeriodTarget(finding, ind.targetSchedule, periodEndDay), reportingPeriodId: input.reportingPeriodId, ...(ind.targetBreakdowns.length ? { targetBreakdowns: ind.targetBreakdowns.map((e) => ({ ...e })) } : {}), ...(level ? { level } : {}), ...(ind.frequency ? { frequency: ind.frequency } : {}), ...(outcome?.code ? { outcomeCode: outcome.code } : {}), ...(outcome ? { outcomeTitle: outcome.title } : {}) });
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

    const indicatorsForLife = await this.indicators.findByProject(input.projectId, input.tenantId);
    if (!indicatorsForLife.ok) return indicatorsForLife;
    const allIndicators = indicatorsForLife.value;
    const byId = new Map(allIndicators.map((i) => [i.id, i]));
    const enriched: VerifiedFinding[] = [];
    for (const finding of findings) {
      const semantics = finding.semantics;
      if (!semantics) {
        enriched.push(finding);
        continue;
      }
      const own = byId.get(finding.indicatorId);
      let updatesList: IndicatorUpdate[];
      if (own?.formula) {
        // Calculated: work out each period from the updates of every indicator the formula (transitively) comes from.
        const needed = new Set<string>();
        const walk = (id: string) => { if (needed.has(id)) return; needed.add(id); for (const t of byId.get(id)?.formula?.terms ?? []) walk(t); };
        walk(own.id);
        const gathered: IndicatorUpdate[] = [];
        for (const id of needed) {
          if (byId.get(id)?.formula) continue;
          const got = await this.updates.findByIndicator(id, input.tenantId);
          if (!got.ok) return got;
          gathered.push(...got.value);
        }
        updatesList = withCalculatedUpdates(allIndicators, gathered, input.tenantId).filter((u) => u.indicatorId === own.id);
      } else {
        const updates = await this.updates.findByIndicator(finding.indicatorId, input.tenantId);
        if (!updates.ok) return updates;
        updatesList = updates.value;
      }
      const lifeOfProject = computeLifeOfProject(
        semantics,
        updatesList.flatMap((u) => {
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
          ? { ...finding, status: "REPORTED" as const, lifeOfProject, performanceEvaluation: evaluatePerformance({ value: lifeOfProject.value, baseline: finding.baseline, target: finding.periodTarget?.target ?? finding.target, semantics }), ...(finding.periodTarget ? (() => { const v = varianceAgainst(lifeOfProject.value, finding.periodTarget.target); return v ? { variance: v } : {}; })() : {}) }
          : finding,
      );
    }
    return { ok: true, value: enriched };
  }
}
