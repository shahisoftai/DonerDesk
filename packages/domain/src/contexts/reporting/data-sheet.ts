import { percentOfTarget } from "./export-indicator-columns.js";

/**
 * The Data Center sheet: every indicator value (and finance figure) of a project across all its reporting periods, in one
 * table. Pure: building rows, CSV, the pivot and the import preview never touch I/O. A missing value is an empty string,
 * never "0".
 */

export interface DataSheetPeriod {
  id: string;
  /** "Jan 2026" for a calendar month, otherwise "1 Jan 2026 – 15 Feb 2026". */
  label: string;
  /** ISO dates (yyyy-mm-dd). */
  start: string;
  end: string;
  reportType: string;
  /** A CLOSED period cannot be edited or imported into. */
  locked: boolean;
}

export interface DataSheetIndicator {
  id: string;
  code: string;
  name: string;
  level: string | null;
  type: string;
  unit?: string | undefined;
  baseline: string;
  target: string;
  /** Percentage/ratio indicators: "% of target" is not meaningful. */
  isRate: boolean;
}

export interface DataSheetCell {
  indicatorId: string;
  periodId: string;
  periodValue: string;
  cumulativeValue: string;
  dataSource?: string | undefined;
  comments?: string | undefined;
  status: string;
}

export interface DataSheetFinanceRow {
  periodId: string;
  currency: string;
  budget: string;
  expenditure: string;
  committed?: string | undefined;
  balance: string;
  burnRatePercent?: string | undefined;
  verified: boolean;
}

export interface DataSheet {
  projectId: string;
  periods: DataSheetPeriod[];
  indicators: DataSheetIndicator[];
  cells: DataSheetCell[];
  finance: DataSheetFinanceRow[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const parts = (iso: string): { y: number; m: number; d: number } => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return { y: y ?? 0, m: (m ?? 1) - 1, d: d ?? 1 };
};

const daysInMonth = (y: number, m: number): number => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

/** A short, stable name for a period: the month when it is a whole calendar month, otherwise its dates. */
export function periodSheetLabel(startIso: string, endIso: string): string {
  const s = parts(startIso);
  const e = parts(endIso);
  if (s.y === e.y && s.m === e.m && s.d === 1 && e.d === daysInMonth(e.y, e.m)) return `${MONTHS[s.m]} ${s.y}`;
  const fmt = (p: { y: number; m: number; d: number }): string => `${p.d} ${MONTHS[p.m]} ${p.y}`;
  return `${fmt(s)} – ${fmt(e)}`;
}

export const INDICATOR_SHEET_HEADERS = [
  "Indicator code",
  "Indicator",
  "Level",
  "Type",
  "Unit",
  "Baseline",
  "Target",
  "Period",
  "Period start",
  "Period end",
  "Period value",
  "Cumulative value",
  "% of target",
  "Status",
  "Data source",
  "Comments",
] as const;

export const FINANCE_SHEET_HEADERS = ["Period", "Period start", "Period end", "Currency", "Budget", "Expenditure to date", "Committed", "Balance", "Burn rate %", "Verified"] as const;

const cellKey = (indicatorId: string, periodId: string): string => `${indicatorId}|${periodId}`;

export function indexCells(sheet: DataSheet): Map<string, DataSheetCell> {
  return new Map(sheet.cells.map((c) => [cellKey(c.indicatorId, c.periodId), c]));
}

/** What a sheet shows as the indicator's progress for a period: cumulative to date against the target, unless it is a rate. */
export function cellPercentOfTarget(indicator: DataSheetIndicator, cell: DataSheetCell | undefined): string {
  if (!cell || indicator.isRate) return "";
  const basis = cell.cumulativeValue.trim() !== "" ? cell.cumulativeValue : cell.periodValue;
  return percentOfTarget(basis, indicator.target);
}

/** One row per indicator per period (blank where nothing is recorded), so the exported file doubles as a template to fill in. */
export function indicatorSheetRows(sheet: DataSheet): string[][] {
  const cells = indexCells(sheet);
  const rows: string[][] = [];
  for (const indicator of sheet.indicators) {
    for (const period of sheet.periods) {
      const cell = cells.get(cellKey(indicator.id, period.id));
      rows.push([
        indicator.code,
        indicator.name,
        indicator.level ?? "",
        indicator.type,
        indicator.unit ?? "",
        indicator.baseline,
        indicator.target,
        period.label,
        period.start,
        period.end,
        cell?.periodValue ?? "",
        cell?.cumulativeValue ?? "",
        cellPercentOfTarget(indicator, cell),
        cell ? cell.status : "",
        cell?.dataSource ?? "",
        cell?.comments ?? "",
      ]);
    }
  }
  return rows;
}

export type PivotMeasure = "PERIOD" | "CUMULATIVE" | "PERCENT_OF_TARGET";

export const PIVOT_MEASURE_LABEL: Record<PivotMeasure, string> = {
  PERIOD: "Period value",
  CUMULATIVE: "Cumulative value",
  PERCENT_OF_TARGET: "% of target",
};

/** Indicators down the side, periods across the top: the "all months at a glance" view. */
export function pivotSheet(sheet: DataSheet, measure: PivotMeasure): { headers: string[]; rows: string[][] } {
  const cells = indexCells(sheet);
  const headers = ["Indicator code", "Indicator", "Unit", "Baseline", "Target", ...sheet.periods.map((p) => p.label)];
  const rows = sheet.indicators.map((indicator) => [
    indicator.code,
    indicator.name,
    indicator.unit ?? "",
    indicator.baseline,
    indicator.target,
    ...sheet.periods.map((period) => {
      const cell = cells.get(cellKey(indicator.id, period.id));
      if (!cell) return "";
      if (measure === "PERIOD") return cell.periodValue;
      if (measure === "CUMULATIVE") return cell.cumulativeValue;
      return cellPercentOfTarget(indicator, cell);
    }),
  ]);
  return { headers, rows };
}

export function financeSheetRows(sheet: DataSheet): string[][] {
  const periods = new Map(sheet.periods.map((p) => [p.id, p]));
  return sheet.finance.flatMap((f) => {
    const p = periods.get(f.periodId);
    if (!p) return [];
    return [[p.label, p.start, p.end, f.currency, f.budget, f.expenditure, f.committed ?? "", f.balance, f.burnRatePercent ?? "", f.verified ? "Yes" : "No"]];
  });
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

const NUMBERISH = /^-?\d[\d,]*(\.\d+)?%?$/;

/** A text cell that a spreadsheet would run as a formula is prefixed so it stays text (numbers are left alone). */
function neutralise(value: string): string {
  return /^[=+\-@\t\r]/.test(value) && !NUMBERISH.test(value.trim()) ? `'${value}` : value;
}

export function toCsv(table: ReadonlyArray<ReadonlyArray<string>>): string {
  const esc = (v: string): string => {
    const t = neutralise(v);
    return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return table.map((r) => r.map(esc).join(",")).join("\r\n");
}

/** Parses CSV text (comma, semicolon or tab separated; quoted fields; a leading BOM) into rows of strings. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const count = (ch: string): number => firstLine.split(ch).length - 1;
  const delimiter = [",", ";", "\t"].reduce((best, ch) => (count(ch) > count(best) ? ch : best), ",");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export type DataSheetImportStatus = "CHANGED" | "UNCHANGED" | "ERROR";

export interface DataSheetImportRow {
  /** 1-based row number in the file, header included. */
  rowNumber: number;
  indicatorCode: string;
  periodLabel: string;
  status: DataSheetImportStatus;
  /** Plain-language reason when status is ERROR. */
  error?: string;
  indicatorId?: string;
  periodId?: string;
  periodValue?: string;
  cumulativeValue?: string;
  dataSource?: string;
  comments?: string;
  /** What is stored now, for the preview. */
  previousPeriodValue?: string;
  previousCumulativeValue?: string;
}

export interface DataSheetImportPreview {
  /** Columns the file must carry that it does not. */
  missingColumns: string[];
  rows: DataSheetImportRow[];
  changed: number;
  unchanged: number;
  errors: number;
}

const norm = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, " ");

const COLUMN_ALIASES = {
  code: ["indicator code", "code", "indicator id"],
  periodStart: ["period start", "start", "from"],
  periodEnd: ["period end", "end", "to"],
  period: ["period", "month", "reporting period"],
  periodValue: ["period value", "this period", "achievement", "value"],
  cumulative: ["cumulative value", "cumulative", "to date", "life of project to date"],
  dataSource: ["data source", "source"],
  comments: ["comments", "comment", "notes"],
} as const;

/**
 * Compares an uploaded table with the stored sheet. Rows are matched on indicator code plus period (start and end dates,
 * or the period label). Only the period value, cumulative value, data source and comments are read; an empty cell never
 * clears a stored value, and a value that is not a number is refused. Nothing is saved here.
 */
export function previewDataSheetImport(sheet: DataSheet, table: ReadonlyArray<ReadonlyArray<string>>): DataSheetImportPreview {
  const headerRow = (table[0] ?? []).map(norm);
  const find = (aliases: readonly string[]): number => headerRow.findIndex((h) => aliases.includes(h));
  const idx = {
    code: find(COLUMN_ALIASES.code),
    start: find(COLUMN_ALIASES.periodStart),
    end: find(COLUMN_ALIASES.periodEnd),
    period: find(COLUMN_ALIASES.period),
    value: find(COLUMN_ALIASES.periodValue),
    cumulative: find(COLUMN_ALIASES.cumulative),
    source: find(COLUMN_ALIASES.dataSource),
    comments: find(COLUMN_ALIASES.comments),
  };

  const missingColumns: string[] = [];
  if (idx.code < 0) missingColumns.push("Indicator code");
  if (idx.period < 0 && (idx.start < 0 || idx.end < 0)) missingColumns.push("Period (or Period start and Period end)");
  if (idx.value < 0 && idx.cumulative < 0) missingColumns.push("Period value or Cumulative value");
  if (missingColumns.length > 0) return { missingColumns, rows: [], changed: 0, unchanged: 0, errors: 0 };

  const indicators = new Map(sheet.indicators.map((i) => [norm(i.code), i]));
  const periodsByDates = new Map(sheet.periods.map((p) => [`${p.start}|${p.end}`, p]));
  const periodsByLabel = new Map(sheet.periods.map((p) => [norm(p.label), p]));
  const cells = indexCells(sheet);
  const at = (row: ReadonlyArray<string>, i: number): string => (i >= 0 ? (row[i] ?? "").trim() : "");

  const rows: DataSheetImportRow[] = [];
  for (let r = 1; r < table.length; r += 1) {
    const row = table[r]!;
    const rowNumber = r + 1;
    const code = at(row, idx.code);
    const label = at(row, idx.period);
    const base = { rowNumber, indicatorCode: code, periodLabel: label || `${at(row, idx.start)} – ${at(row, idx.end)}` };
    const fail = (error: string): void => {
      rows.push({ ...base, status: "ERROR", error });
    };

    if (code === "") {
      fail("The indicator code is empty.");
      continue;
    }
    const indicator = indicators.get(norm(code));
    if (!indicator) {
      fail(`No indicator has the code "${code}".`);
      continue;
    }
    const start = at(row, idx.start).slice(0, 10);
    const end = at(row, idx.end).slice(0, 10);
    const period = (start && end ? periodsByDates.get(`${start}|${end}`) : undefined) ?? (label ? periodsByLabel.get(norm(label)) : undefined);
    if (!period) {
      fail("No reporting period of this project matches the period in this row.");
      continue;
    }
    if (period.locked) {
      fail(`${period.label} is closed and cannot be changed.`);
      continue;
    }
    const value = at(row, idx.value);
    const cumulative = at(row, idx.cumulative);
    const bad = [value, cumulative].find((v) => v !== "" && !NUMBERISH.test(v));
    if (bad !== undefined) {
      fail(`"${bad}" is not a number.`);
      continue;
    }
    const current = cells.get(cellKey(indicator.id, period.id));
    const nextValue = value !== "" ? value : (current?.periodValue ?? "");
    const nextCumulative = cumulative !== "" ? cumulative : (current?.cumulativeValue ?? "");
    const nextSource = at(row, idx.source) || current?.dataSource || "";
    const nextComments = at(row, idx.comments) || current?.comments || "";
    const same =
      nextValue === (current?.periodValue ?? "") &&
      nextCumulative === (current?.cumulativeValue ?? "") &&
      nextSource === (current?.dataSource ?? "") &&
      nextComments === (current?.comments ?? "");
    const nothing = nextValue === "" && nextCumulative === "" && !current;
    rows.push({
      ...base,
      status: same || nothing ? "UNCHANGED" : "CHANGED",
      indicatorId: indicator.id,
      periodId: period.id,
      periodValue: nextValue,
      cumulativeValue: nextCumulative,
      ...(nextSource ? { dataSource: nextSource } : {}),
      ...(nextComments ? { comments: nextComments } : {}),
      previousPeriodValue: current?.periodValue ?? "",
      previousCumulativeValue: current?.cumulativeValue ?? "",
    });
  }
  return {
    missingColumns: [],
    rows,
    changed: rows.filter((x) => x.status === "CHANGED").length,
    unchanged: rows.filter((x) => x.status === "UNCHANGED").length,
    errors: rows.filter((x) => x.status === "ERROR").length,
  };
}
