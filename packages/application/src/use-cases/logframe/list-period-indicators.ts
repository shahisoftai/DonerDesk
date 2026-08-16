import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ILogframeRepository, IIndicatorRepository, IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { IReportingPeriodRepository } from "../../ports/reporting.js";

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
  logframeLevel: string | null;
  logframeCode: string | null;
  logframeTitle: string | null;
  update: {
    id: string;
    periodAchievement: string;
    cumulativeAchievement: string;
    comments?: string;
    dataSource?: string;
    verificationStatus: string;
    verifiedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
}

export class ListPeriodIndicatorsHandler {
  constructor(
    private readonly periods: IReportingPeriodRepository,
    private readonly logframe: ILogframeRepository,
    private readonly indicators: IIndicatorRepository,
    private readonly updates: IIndicatorUpdateRepository,
  ) {}

  async handle(ctx: AuthenticatedContext, reportingPeriodId: string): Promise<Result<{ periodId: string; projectId: string; indicators: PeriodIndicatorRow[] }, DomainError>> {
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

    const itemsById = new Map(itemsResult.value.map((item) => [item.id, item]));
    const updatesByIndicator = new Map(updatesResult.value.map((u) => [u.indicatorId, u]));

    const rows: PeriodIndicatorRow[] = indicatorsResult.value.map((ind) => {
      const item = ind.logframeItemId ? itemsById.get(ind.logframeItemId) : undefined;
      const update = updatesByIndicator.get(ind.id);
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
        logframeLevel: item?.level ?? null,
        logframeCode: item?.code ?? null,
        logframeTitle: item?.title ?? null,
        update: update
          ? {
              id: update.id,
              periodAchievement: update.periodAchievement,
              cumulativeAchievement: update.cumulativeAchievement,
              comments: update.comments,
              dataSource: update.dataSource,
              verificationStatus: update.verificationStatus,
              verifiedAt: update.verifiedAt ?? null,
              createdAt: update.createdAt,
              updatedAt: update.updatedAt,
            }
          : null,
      };
    });

    return { ok: true, value: { periodId: period.id, projectId: period.projectId, indicators: rows } };
  }
}
