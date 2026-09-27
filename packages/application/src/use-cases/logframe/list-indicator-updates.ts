import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IIndicatorRepository, IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { IReportingPeriodRepository } from "../../ports/reporting.js";
import { toIndicatorUpdateView, type IndicatorUpdateView } from "./indicator-update-view.js";

export interface IndicatorUpdateHistoryRow extends IndicatorUpdateView {
  reportingPeriodId: string;
  periodReportType: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
}

/** Chronological (oldest period first) update history of one indicator across reporting periods. */
export class ListIndicatorUpdatesHandler {
  constructor(
    private readonly indicators: IIndicatorRepository,
    private readonly updates: IIndicatorUpdateRepository,
    private readonly periods: IReportingPeriodRepository,
  ) {}

  async handle(
    ctx: AuthenticatedContext,
    indicatorId: string,
  ): Promise<Result<{ indicatorId: string; projectId: string; updates: IndicatorUpdateHistoryRow[] }, DomainError>> {
    const found = await this.indicators.findById(indicatorId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return { ok: false, error: DomainError.notFound("Indicator", indicatorId) };
    const indicator = found.value;

    const [updatesResult, periodsResult] = await Promise.all([
      this.updates.findByIndicator(indicatorId, ctx.tenant.tenantId),
      this.periods.findByProject(indicator.projectId, ctx.tenant.tenantId),
    ]);
    if (!updatesResult.ok) return updatesResult;
    if (!periodsResult.ok) return periodsResult;

    const periodsById = new Map(periodsResult.value.map((p) => [p.id, p]));
    const rows: IndicatorUpdateHistoryRow[] = updatesResult.value.map((update) => {
      const period = periodsById.get(update.reportingPeriodId);
      return {
        ...toIndicatorUpdateView(update),
        reportingPeriodId: update.reportingPeriodId,
        periodReportType: period?.reportType ?? null,
        periodStart: period?.duration.start ?? null,
        periodEnd: period?.duration.end ?? null,
      };
    });
    rows.sort(
      (a, b) =>
        (a.periodStart?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.periodStart?.getTime() ?? Number.MAX_SAFE_INTEGER) ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    );
    return { ok: true, value: { indicatorId, projectId: indicator.projectId, updates: rows } };
  }
}
