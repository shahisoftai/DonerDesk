import type { Result } from "@donordesk/domain";
import { DomainError, disaggregationMustSum } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ILogframeRepository, IIndicatorRepository, IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { IReportingPeriodRepository } from "../../ports/reporting.js";
import { toIndicatorUpdateView, type IndicatorUpdateView } from "./indicator-update-view.js";
import type { IActivityUpdateRepository } from "../../ports/activities.js";
import { periodIndicatorScope, inIndicatorScope } from "../../services/period-activities.js";

export interface PeriodIndicatorRow {
  id: string;
  logframeItemId: string;
  code: string;
  name: string;
  type: string;
  baseline: string;
  target: string;
  unit?: string;
  dataSource?: string;
  frequency?: string;
  disaggregationRequired: boolean;
  /** Each breakdown dimension must add up to the period value (counts and amounts, not rates). */
  breakdownMustSum: boolean;
  /** Percentage/ratio indicators without a configured denominator indicator
   * cannot be independently calculated; their result stays unverifiable. */
  requiresDenominator: boolean;
  logframeLevel: string | null;
  logframeCode: string | null;
  logframeTitle: string | null;
  update: IndicatorUpdateView | null;
}

/** Activity/situation reports: the activities the report covers (absent for other types). */
export interface PeriodScopeSummary {
  activityCount: number;
  acceptedActivityCount: number;
}

export class ListPeriodIndicatorsHandler {
  constructor(
    private readonly periods: IReportingPeriodRepository,
    private readonly logframe: ILogframeRepository,
    private readonly indicators: IIndicatorRepository,
    private readonly updates: IIndicatorUpdateRepository,
    private readonly activities?: IActivityUpdateRepository,
  ) {}

  async handle(
    ctx: AuthenticatedContext,
    reportingPeriodId: string,
  ): Promise<Result<{ periodId: string; projectId: string; reportType: string; indicators: PeriodIndicatorRow[]; scope?: PeriodScopeSummary }, DomainError>> {
    const periodResult = await this.periods.findById(reportingPeriodId, ctx.tenant.tenantId);
    if (!periodResult.ok) return periodResult;
    if (!periodResult.value) return { ok: false, error: DomainError.notFound("ReportingPeriod", reportingPeriodId) };
    const period = periodResult.value;

    const [itemsResult, indicatorsResult, updatesResult] = await Promise.all([
      this.logframe.findByProject(period.projectId, ctx.tenant.tenantId),
      this.indicators.findByProject(period.projectId, ctx.tenant.tenantId),
      this.updates.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId),
    ]);
    if (!itemsResult.ok) return itemsResult;
    if (!indicatorsResult.ok) return indicatorsResult;
    if (!updatesResult.ok) return updatesResult;

    const scopeResult = await periodIndicatorScope(this.activities, period, ctx.tenant.tenantId);
    if (!scopeResult.ok) return scopeResult;
    const scope = scopeResult.value;

    const itemsById = new Map(itemsResult.value.map((item) => [item.id, item]));
    const updatesByIndicator = new Map(updatesResult.value.map((u) => [u.indicatorId, u]));

    const rows: PeriodIndicatorRow[] = indicatorsResult.value.filter((ind) => inIndicatorScope(scope, ind.id)).map((ind) => {
      const item = ind.logframeItemId ? itemsById.get(ind.logframeItemId) : undefined;
      const update = updatesByIndicator.get(ind.id);
      const requiresDenominator =
        (ind.type === "PERCENTAGE" || ind.type === "RATIO") &&
        !Boolean(ind.semantics?.denominatorIndicatorId) &&
        // A configured directly-reported rate (not calculated from counts) needs no denominator.
        !(ind.semantics?.status === "CONFIGURED" && ind.semantics.aggregation !== "PERCENTAGE" && ind.semantics.aggregation !== "RATIO");
      return {
        id: ind.id,
        logframeItemId: ind.logframeItemId,
        code: ind.code,
        name: ind.name,
        type: ind.type,
        baseline: ind.baseline,
        target: ind.target,
        unit: ind.unit,
        dataSource: ind.dataSource,
        frequency: ind.frequency,
        disaggregationRequired: ind.disaggregationRequired,
        breakdownMustSum: disaggregationMustSum(ind.type),
        requiresDenominator,
        logframeLevel: item?.level ?? null,
        logframeCode: item?.code ?? null,
        logframeTitle: item?.title ?? null,
        update: update ? toIndicatorUpdateView(update) : null,
      };
    });

    return {
      ok: true,
      value: {
        periodId: period.id,
        projectId: period.projectId,
        reportType: period.reportType,
        indicators: rows,
        ...(scope.activities
          ? { scope: { activityCount: scope.activities.length, acceptedActivityCount: scope.activities.filter((a) => a.status === "ACCEPTED").length } }
          : {}),
      },
    };
  }
}
