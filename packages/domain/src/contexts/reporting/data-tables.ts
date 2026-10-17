import { cellPercentOfTarget, indexCells, PIVOT_MEASURE_LABEL, type DataSheet, type DataSheetCell, type DataSheetIndicator, type PivotMeasure } from "./data-sheet.js";
import { periodsInRange } from "./data-charts.js";

/**
 * Data Center tables: a table of recorded indicator values a person inserts into a report section. A small spec (layout +
 * indicators + period range) drawn from the project's data sheet; pure and deterministic. The result is a GFM table, the one
 * table form every exporter renders, so once inserted it is ordinary section text (editable, checked and charted like any table).
 * A missing value is "Not measured", never 0; a rate has no "% of target" ("—").
 */

export type DataTableLayout = "SUMMARY" | "OVER_TIME";

export interface DataTableSpec {
  layout: DataTableLayout;
  indicatorIds: string[];
  /** OVER_TIME only: what each period column shows. */
  measure: PivotMeasure;
  fromPeriodId?: string | undefined;
  toPeriodId?: string | undefined;
}

export const DATA_TABLE_LAYOUTS: Record<DataTableLayout, { label: string; description: string }> = {
  SUMMARY: {
    label: "Progress to date",
    description: "One row per indicator: baseline, target, latest cumulative value and % of target.",
  },
  OVER_TIME: {
    label: "Period by period",
    description: "Indicators down the side, one column per reporting period.",
  },
};

export const NOT_MEASURED = "Not measured";
const NOT_APPLICABLE = "—";

export type DataTableResult =
  | { ok: true; headers: string[]; rows: string[][]; markdown: string; notes: string[]; points: number; unverified: number }
  | { ok: false; reason: string };

/** A pipe or line break would split a GFM row (the editor's parser does not read `\|`), so each becomes a space or a slash. */
const cell = (value: string): string => value.replace(/\r?\n/g, " ").replace(/\s*\|\s*/g, " / ").trim();

const recorded = (c: DataSheetCell | undefined): c is DataSheetCell => !!c && (c.periodValue.trim() !== "" || c.cumulativeValue.trim() !== "");

function toMarkdown(headers: string[], rows: string[][]): string {
  const line = (cols: string[]): string => `| ${cols.map(cell).join(" | ")} |`;
  return [line(headers), `| ${headers.map(() => "---").join(" | ")} |`, ...rows.map(line)].join("\n");
}

export function buildDataTable(sheet: DataSheet, spec: DataTableSpec): DataTableResult {
  const chosen = new Set(spec.indicatorIds);
  const indicators = sheet.indicators.filter((i) => chosen.has(i.id));
  if (indicators.length === 0) return { ok: false, reason: "Choose at least one indicator." };
  const periods = periodsInRange(sheet, spec.fromPeriodId, spec.toPeriodId);
  if (periods.length === 0) return { ok: false, reason: "This project has no reporting periods yet." };
  const cells = indexCells(sheet);
  const at = (indicator: DataSheetIndicator, periodId: string): DataSheetCell | undefined => cells.get(`${indicator.id}|${periodId}`);
  const notes: string[] = [];
  let points = 0;
  let unverified = 0;
  const count = (c: DataSheetCell): void => {
    points += 1;
    if (c.status !== "VERIFIED") unverified += 1;
  };

  let headers: string[];
  let rows: string[][];
  if (spec.layout === "SUMMARY") {
    headers = ["Code", "Indicator", "Unit", "Baseline", "Target", "Cumulative to date", "% of target"];
    rows = indicators.map((indicator) => {
      // The latest period in the range that has a recorded value.
      const latest = [...periods].reverse().map((p) => at(indicator, p.id)).find(recorded);
      if (latest) count(latest);
      const value = latest ? (latest.cumulativeValue.trim() !== "" ? latest.cumulativeValue : latest.periodValue) : NOT_MEASURED;
      const pct = latest ? cellPercentOfTarget(indicator, latest) : "";
      return [indicator.code, indicator.name, indicator.unit ?? "", indicator.baseline, indicator.target, value, pct !== "" ? pct : NOT_APPLICABLE];
    });
    const last = periods[periods.length - 1]!;
    notes.push(`Latest recorded value up to ${last.label}.`);
  } else {
    headers = ["Code", "Indicator", "Unit", ...periods.map((p) => p.label)];
    rows = indicators.map((indicator) => [
      indicator.code,
      indicator.name,
      indicator.unit ?? "",
      ...periods.map((p) => {
        const c = at(indicator, p.id);
        if (!recorded(c)) return NOT_MEASURED;
        count(c);
        const shown = spec.measure === "PERIOD" ? c.periodValue : spec.measure === "CUMULATIVE" ? c.cumulativeValue : cellPercentOfTarget(indicator, c);
        if (shown.trim() === "") return spec.measure === "PERCENT_OF_TARGET" ? NOT_APPLICABLE : NOT_MEASURED;
        return shown;
      }),
    ]);
    notes.push(`${PIVOT_MEASURE_LABEL[spec.measure]} for each period.`);
  }
  if (indicators.some((i) => i.isRate)) notes.push("Rates have no % of target.");
  if (unverified > 0) notes.push(`${unverified} of ${points} values are not verified yet.`);
  return { ok: true, headers, rows, markdown: toMarkdown(headers, rows), notes, points, unverified };
}
