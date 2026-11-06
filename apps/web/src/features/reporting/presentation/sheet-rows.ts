import type { PeriodIndicatorRow } from "@/lib/server/schemas";
import type { SheetRow } from "@/features/reporting/domain/entry-sheet";

/** The sheet engine's view of one period row (a structural subset: the engine never sees the server's wider type). */
export function toSheetRow(row: PeriodIndicatorRow): SheetRow {
  return {
    id: row.id, code: row.code, name: row.name, type: row.type, unit: row.unit, baseline: row.baseline, target: row.target, aggregation: row.aggregation,
    calculation: row.calculation, previousCumulative: row.previous?.cumulativeAchievement, disaggregationRequired: row.disaggregationRequired,
    update: row.update ? { verificationStatus: row.update.verificationStatus, updatedAt: row.update.updatedAt, notApplicableReason: row.update.notApplicableReason } : null,
  };
}
