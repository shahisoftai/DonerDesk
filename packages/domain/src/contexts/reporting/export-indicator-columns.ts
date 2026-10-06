import { ROLL_UP_REPORT_TYPES } from "./period-type-rules.js";

/**
 * The indicator table of an export, defined once for the spreadsheet, the Word table and the PDF: a monthly report
 * keeps its columns; a roll-up report (semi-annual, annual, final) also shows the life-of-project value and the
 * percentage of target, so the file agrees with the report's own table.
 */
export interface ExportIndicatorRow {
  code: string;
  name: string;
  baseline: string;
  target: string;
  achievement: string;
  unit?: string | undefined;
  status: string;
  /** Roll-up reports only. */
  periodValue?: string | undefined;
  lifeOfProjectValue?: string | undefined;
  percentOfTarget?: string | undefined;
}

export type IndicatorColumnKey = "code" | "name" | "baseline" | "target" | "achievement" | "periodValue" | "lifeOfProjectValue" | "percentOfTarget" | "unit" | "status";

export interface IndicatorColumn {
  key: IndicatorColumnKey;
  header: string;
  width: number;
}

const BASE_COLUMNS: ReadonlyArray<IndicatorColumn> = [
  { key: "code", header: "Code", width: 14 },
  { key: "name", header: "Indicator", width: 32 },
  { key: "baseline", header: "Baseline", width: 12 },
  { key: "target", header: "Target", width: 12 },
  { key: "achievement", header: "Achievement", width: 14 },
  { key: "unit", header: "Unit", width: 10 },
  { key: "status", header: "Status", width: 12 },
];

const ROLL_UP_COLUMNS: ReadonlyArray<IndicatorColumn> = [
  { key: "code", header: "Code", width: 14 },
  { key: "name", header: "Indicator", width: 32 },
  { key: "baseline", header: "Baseline", width: 12 },
  { key: "target", header: "Target", width: 12 },
  { key: "periodValue", header: "This period", width: 14 },
  { key: "lifeOfProjectValue", header: "Life of project to date", width: 22 },
  { key: "percentOfTarget", header: "% of target", width: 12 },
  { key: "unit", header: "Unit", width: 10 },
  { key: "status", header: "Status", width: 12 },
];

/** A roll-up export is recognised by its rows: the report type already decided whether they carry a life-of-project value. */
export function isRollUpIndicatorTable(rows: ReadonlyArray<ExportIndicatorRow>): boolean {
  return rows.some((r) => r.lifeOfProjectValue !== undefined);
}

export function indicatorExportColumns(rows: ReadonlyArray<ExportIndicatorRow>): ReadonlyArray<IndicatorColumn> {
  return isRollUpIndicatorTable(rows) ? ROLL_UP_COLUMNS : BASE_COLUMNS;
}

export function indicatorExportCell(row: ExportIndicatorRow, key: IndicatorColumnKey): string {
  return String(row[key] ?? "");
}

const parseNumber = (value: string | undefined): number | null => {
  if (value === undefined || value.trim() === "") return null;
  const n = Number.parseFloat(value.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

/** Percentage of the project target reached; empty when either figure is missing or the target is not positive. */
export function percentOfTarget(value: string | undefined, target: string | undefined): string {
  const v = parseNumber(value);
  const t = parseNumber(target);
  if (v === null || t === null || t <= 0) return "";
  return `${Math.round((v / t) * 100)}%`;
}

/**
 * One indicator's row. Monthly (cadence) reports are exactly as before. For a roll-up report the life-of-project value is
 * the recorded cumulative figure; a rate (percentage, ratio) is not cumulative, so its own value stands for the life of the
 * project. A missing value stays empty rather than becoming 0.
 */
export function indicatorExportRow(input: {
  reportType: string;
  indicator: { code: string; name: string; baseline: string; target: string; unit?: string | undefined; type: string };
  update?: { periodAchievement: string; cumulativeAchievement: string; verificationStatus: string } | undefined;
}): ExportIndicatorRow {
  const { indicator, update } = input;
  const base = {
    code: indicator.code,
    name: indicator.name,
    baseline: indicator.baseline,
    target: indicator.target,
    unit: indicator.unit,
    status: update?.verificationStatus ?? "DRAFT",
  };
  if (!ROLL_UP_REPORT_TYPES.has(input.reportType)) return { ...base, achievement: update?.periodAchievement ?? "0" };

  const rate = indicator.type === "PERCENTAGE" || indicator.type === "RATIO";
  const period = (update?.periodAchievement ?? "").trim();
  const cumulative = (update?.cumulativeAchievement ?? "").trim();
  const life = rate ? period : cumulative !== "" ? cumulative : period;
  return {
    ...base,
    achievement: life,
    periodValue: period,
    lifeOfProjectValue: life,
    percentOfTarget: percentOfTarget(life, indicator.target),
  };
}
