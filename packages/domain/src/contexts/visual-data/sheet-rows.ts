import { periodsInRange } from "../reporting/data-charts.js";
import { hasShareOfTarget, indexCells, type DataSheet, type DataSheetIndicator } from "../reporting/data-sheet.js";
import type { Cell, VisualRow } from "./shape.js";

/**
 * The data sheet as catalogue rows (Phase 48.17). One function per source the sheet answers; each returns rows keyed by field id and
 * carries whether the figure is verified. Nothing is computed here beyond the sheet's own rules (a rate has no percent of target; a
 * rate's value is in `rate_value` and is never in `period_value`, so a total of period values can never add a rate).
 */
const VERIFIED = "VERIFIED";
const NOT_APPLICABLE = "Not applicable";

const toNumber = (s: string | undefined): number | null => {
  if (s === undefined || s.trim() === "") return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

export interface SheetReadOptions { fromPeriodId?: string | undefined; toPeriodId?: string | undefined; indicatorIds?: ReadonlyArray<string> | undefined }

function chosen(sheet: DataSheet, o: SheetReadOptions): { indicators: DataSheetIndicator[]; periods: ReturnType<typeof periodsInRange> } {
  const wanted = o.indicatorIds && o.indicatorIds.length > 0 ? new Set(o.indicatorIds) : null;
  return { indicators: sheet.indicators.filter((i) => !wanted || wanted.has(i.id)), periods: periodsInRange(sheet, o.fromPeriodId, o.toPeriodId) };
}

export function indicatorValueRows(sheet: DataSheet, o: SheetReadOptions = {}): VisualRow[] {
  const cells = indexCells(sheet);
  const { indicators, periods } = chosen(sheet, o);
  const rows: VisualRow[] = [];
  for (const ind of indicators) for (const p of periods) {
    const cell = cells.get(`${ind.id}|${p.id}`);
    const na = cell?.notApplicable === true;
    const period = toNumber(cell?.periodValue);
    const cumulative = toNumber(cell?.cumulativeValue);
    const target = toNumber(ind.target);
    const shareOk = hasShareOfTarget(ind);
    const values: Record<string, Cell> = {
      indicator: ind.name, period: p.label, level: ind.level ?? null,
      status: na ? NOT_APPLICABLE : (cell?.status ?? ""),
      period_value: ind.isRate || na ? null : period,
      rate_value: ind.isRate && !na ? (period ?? cumulative) : null,
      cumulative: ind.isRate || na ? null : cumulative,
      target: ind.isRate ? null : target, baseline: ind.isRate ? null : toNumber(ind.baseline),
      percent_of_target: shareOk && !na && target ? Math.round(((cumulative ?? period ?? NaN) / target) * 1000) / 10 : null,
    };
    if (values["percent_of_target"] !== null && !Number.isFinite(values["percent_of_target"] as number)) values["percent_of_target"] = null;
    rows.push({ values, verified: cell ? cell.status === VERIFIED : undefined });
  }
  return rows;
}

export function disaggregationRows(sheet: DataSheet, o: SheetReadOptions = {}): VisualRow[] {
  const cells = indexCells(sheet);
  const { indicators, periods } = chosen(sheet, o);
  const rows: VisualRow[] = [];
  for (const ind of indicators) for (const p of periods) {
    const cell = cells.get(`${ind.id}|${p.id}`);
    for (const b of cell?.breakdown ?? []) rows.push({ values: { indicator: ind.name, period: p.label, dimension: b.dimension, category: b.category, group_value: toNumber(b.value) }, verified: cell?.status === VERIFIED });
  }
  return rows;
}

export function periodRows(sheet: DataSheet, o: SheetReadOptions = {}): VisualRow[] {
  return periodsInRange(sheet, o.fromPeriodId, o.toPeriodId).map((p) => ({ values: { period_label: p.label } }));
}
