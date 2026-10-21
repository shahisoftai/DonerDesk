import type { Result, DataSheet, DataSheetImportPreview } from "@donordesk/domain";
import { DomainError, isPeriodLocked, isRateIndicator, periodSheetLabel, previewDataSheetImport, financeAppliesTo } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ILogframeRepository, IIndicatorRepository, IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { IReportingPeriodRepository } from "../../ports/reporting.js";
import type { IPeriodFinancialRepository } from "../../ports/finance.js";
import type { IFinanceInputs } from "../../services/finance-inputs.js";
import type { BulkUpsertIndicatorUpdatesHandler } from "../logframe/bulk-upsert-indicator-updates.js";

const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * Everything the Data Center shows for a project in one read: all (non-cancelled) periods, the project's live indicators,
 * every recorded value and each period's finance figures. Finance is included only when the project's finance mode is on.
 */
export class GetProjectDataSheetHandler {
  constructor(
    private readonly periods: IReportingPeriodRepository,
    private readonly logframe: ILogframeRepository,
    private readonly indicators: IIndicatorRepository,
    private readonly updates: IIndicatorUpdateRepository,
    private readonly finance: IFinanceInputs,
    private readonly summaries: IPeriodFinancialRepository,
  ) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<DataSheet & { financeEnabled: boolean }, DomainError>> {
    const tenantId = ctx.tenant.tenantId;
    const [periodsResult, itemsResult, indicatorsResult, mode] = await Promise.all([
      this.periods.findByProject(projectId, tenantId),
      this.logframe.findByProject(projectId, tenantId),
      this.indicators.findByProject(projectId, tenantId),
      this.finance.modeFor(projectId, tenantId),
    ]);
    if (!periodsResult.ok) return periodsResult;
    if (!itemsResult.ok) return itemsResult;
    if (!indicatorsResult.ok) return indicatorsResult;
    if (!mode.ok) return mode;

    const periods = [...periodsResult.value].sort((a, b) => a.duration.start.getTime() - b.duration.start.getTime());
    const values = await this.updates.findByReportingPeriods(periods.map((p) => p.id), tenantId);
    if (!values.ok) return values;

    const itemsById = new Map(itemsResult.value.map((i) => [i.id, i]));
    const liveIds = new Set(indicatorsResult.value.map((i) => i.id));
    const financeRows: DataSheet["finance"] = [];
    const financeEnabled = mode.value !== "DISABLED";
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

    return {
      ok: true,
      value: {
        projectId,
        financeEnabled,
        periods: periods.map((p) => {
          const start = isoDay(p.duration.start);
          const end = isoDay(p.duration.end);
          return { id: p.id, label: periodSheetLabel(start, end), start, end, reportType: p.reportType, locked: isPeriodLocked(p.status.value), reportStatus: p.status.value };
        }),
        indicators: indicatorsResult.value.map((i) => ({
          id: i.id,
          code: i.code,
          name: i.name,
          level: (i.logframeItemId ? itemsById.get(i.logframeItemId)?.level : undefined) ?? null,
          type: i.type,
          unit: i.unit,
          baseline: i.baseline,
          target: i.target,
          isRate: isRateIndicator({ type: i.type, unit: i.unit }),
          ...(i.targetSchedule?.length ? { targetSchedule: i.targetSchedule } : {}),
        })),
        cells: values.value
          .filter((u) => liveIds.has(u.indicatorId))
          .map((u) => ({
            indicatorId: u.indicatorId,
            periodId: u.reportingPeriodId,
            periodValue: u.periodAchievement,
            cumulativeValue: u.cumulativeAchievement,
            ...(u.dataSource ? { dataSource: u.dataSource } : {}),
            ...(u.comments ? { comments: u.comments } : {}),
            status: u.verificationStatus,
          })),
        finance: financeRows,
      },
    };
  }
}

export interface DataSheetImportOutcome {
  preview: DataSheetImportPreview;
  /** Values written (0 for a preview). */
  saved: number;
}

/**
 * Reads an uploaded table against the project's sheet. A preview changes nothing; applying saves the changed rows one
 * period at a time through the same bulk save the entry grid uses (closed periods refused, edits audited, evidence linked).
 */
export class ImportDataSheetHandler {
  constructor(
    private readonly sheet: GetProjectDataSheetHandler,
    private readonly bulk: BulkUpsertIndicatorUpdatesHandler,
  ) {}

  async handle(ctx: AuthenticatedContext, projectId: string, table: string[][], apply: boolean): Promise<Result<DataSheetImportOutcome, DomainError>> {
    if (table.length > 20_001) return { ok: false, error: DomainError.validation("The file has too many rows (the limit is 20,000).") };
    const sheet = await this.sheet.handle(ctx, projectId);
    if (!sheet.ok) return sheet;
    const preview = previewDataSheetImport(sheet.value, table);
    if (!apply) return { ok: true, value: { preview, saved: 0 } };
    if (preview.missingColumns.length > 0) return { ok: false, error: DomainError.validation(`The file is missing: ${preview.missingColumns.join(", ")}.`) };
    if (preview.errors > 0) return { ok: false, error: DomainError.validation("Fix the rows with problems (or remove them) before importing.") };

    const byPeriod = new Map<string, typeof preview.rows>();
    for (const row of preview.rows) {
      if (row.status !== "CHANGED" || !row.periodId) continue;
      byPeriod.set(row.periodId, [...(byPeriod.get(row.periodId) ?? []), row]);
    }
    let saved = 0;
    for (const [reportingPeriodId, rows] of byPeriod) {
      const result = await this.bulk.handle(ctx, {
        reportingPeriodId,
        updates: rows.map((r) => ({
          indicatorId: r.indicatorId!,
          periodAchievement: r.periodValue ?? "",
          cumulativeAchievement: r.cumulativeValue ?? "",
          ...(r.dataSource ? { dataSource: r.dataSource } : {}),
          ...(r.comments ? { comments: r.comments } : {}),
        })),
      });
      if (!result.ok) return result;
      saved += result.value.saved;
    }
    return { ok: true, value: { preview, saved } };
  }
}
