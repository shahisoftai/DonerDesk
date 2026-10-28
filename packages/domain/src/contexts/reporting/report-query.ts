/**
 * Saved reports (Phase 34.5): a table across several indicators, asked as one sentence —
 * "Showing results for [indicators] from [period] to [period]; display [measure] by [rows], broken down by [columns]".
 * The query is stored, never the figures: a report is run against the project's data sheet each time, so it cannot go stale.
 * The rows and columns are indicators and periods; the other of the two is the breakdown. A gap is a gap, never 0, nothing
 * is added across indicators (different units, rates), and a figure that is not verified is counted and said.
 */
import { CHART_MEASURES, type ChartMeasure } from "./data-sheet.js";
import type { DatasetQuery, DatasetResult } from "./dataset-query.js";

export type ReportRows = "INDICATOR" | "PERIOD";
export const REPORT_ROWS: readonly ReportRows[] = ["INDICATOR", "PERIOD"];
export const MAX_REPORT_INDICATORS = 30;
export const MAX_REPORT_NAME = 120;

export interface ReportQuery {
  indicatorIds: string[];
  fromPeriodId?: string | undefined;
  toPeriodId?: string | undefined;
  measure: ChartMeasure;
  /** What the rows are; the columns are the other one. */
  rows: ReportRows;
  includeDraft: boolean;
  /**
   * Break each indicator down by one dimension (sex, age group …): the columns become that dimension's groups, for the last period in
   * the range. Only the period's own value is split, so the measure must be the period value and the rows indicators.
   */
  breakdown?: ReportDimension | undefined;
}

export type ReportDimension = "SEX" | "AGE_GROUP" | "DISABILITY" | "LOCATION" | "OTHER";
export const REPORT_DIMENSIONS: readonly ReportDimension[] = ["SEX", "AGE_GROUP", "DISABILITY", "LOCATION", "OTHER"];
export const REPORT_DIMENSION_WORDS: Record<ReportDimension, string> = { SEX: "sex", AGE_GROUP: "age group", DISABILITY: "disability", LOCATION: "location", OTHER: "other group" };

export interface ReportProblem { code: "NO_INDICATOR" | "TOO_MANY_INDICATORS" | "UNKNOWN_MEASURE" | "UNKNOWN_ROWS" | "DUPLICATE_INDICATOR" | "UNKNOWN_DIMENSION" | "BREAKDOWN_NEEDS_PERIOD_VALUE"; message: string }

export function validateReportQuery(q: ReportQuery): ReportProblem[] {
  const out: ReportProblem[] = [];
  if (q.indicatorIds.length === 0) out.push({ code: "NO_INDICATOR", message: "Choose at least one indicator." });
  if (q.indicatorIds.length > MAX_REPORT_INDICATORS) out.push({ code: "TOO_MANY_INDICATORS", message: `A report holds at most ${MAX_REPORT_INDICATORS} indicators.` });
  if (new Set(q.indicatorIds).size !== q.indicatorIds.length) out.push({ code: "DUPLICATE_INDICATOR", message: "An indicator is listed twice." });
  if (!CHART_MEASURES.includes(q.measure)) out.push({ code: "UNKNOWN_MEASURE", message: "What to show is not known." });
  if (!REPORT_ROWS.includes(q.rows)) out.push({ code: "UNKNOWN_ROWS", message: "What the rows are is not known." });
  if (q.breakdown !== undefined) {
    if (!REPORT_DIMENSIONS.includes(q.breakdown)) out.push({ code: "UNKNOWN_DIMENSION", message: "What to break down by is not known." });
    else if (q.measure !== "PERIOD" || q.rows !== "INDICATOR") out.push({ code: "BREAKDOWN_NEEDS_PERIOD_VALUE", message: "A breakdown shows the period value of each indicator, with indicators as the rows." });
  }
  return out;
}

export const REPORT_MEASURE_WORDS: Record<ChartMeasure, string> = { PERIOD: "the value for each period", CUMULATIVE: "the cumulative value to date", PERCENT_OF_TARGET: "the percent of target" };

/** The query as the sentence the builder shows. Names are passed in (the query holds ids). */
export function describeReportQuery(q: ReportQuery, names: { periods: (id: string | undefined) => string; indicatorCount?: number }): string {
  const n = names.indicatorCount ?? q.indicatorIds.length;
  if (q.breakdown && REPORT_DIMENSIONS.includes(q.breakdown)) {
    const when = q.toPeriodId ? names.periods(q.toPeriodId) : "the last period";
    return `Showing results for ${n} indicator${n === 1 ? "" : "s"} for ${when}; display the value for the period by indicator, broken down by ${REPORT_DIMENSION_WORDS[q.breakdown]}${q.includeDraft ? ", including values not yet verified" : ", verified values only"}.`;
  }
  const range = q.fromPeriodId || q.toPeriodId ? `from ${names.periods(q.fromPeriodId)} to ${names.periods(q.toPeriodId)}` : "for every period";
  const by = q.rows === "INDICATOR" ? "indicator, broken down by period" : "period, broken down by indicator";
  return `Showing results for ${n} indicator${n === 1 ? "" : "s"} ${range}; display ${REPORT_MEASURE_WORDS[q.measure]} by ${by}${q.includeDraft ? ", including values not yet verified" : ", verified values only"}.`;
}

export const toDatasetQuery = (q: ReportQuery): DatasetQuery => ({ indicatorIds: q.indicatorIds, measure: q.measure, fromPeriodId: q.fromPeriodId, toPeriodId: q.toPeriodId, includeDraft: q.includeDraft });

export interface ReportRow { label: string; cells: Array<string | null> }
export interface ReportTable { columns: string[]; rows: ReportRow[]; notes: string[] }

const group = (n: number, decimals: number) => n.toLocaleString("en-US", { maximumFractionDigits: decimals, minimumFractionDigits: 0 });
const cell = (v: number | null, measure: ChartMeasure): string | null => (v === null ? null : measure === "PERCENT_OF_TARGET" ? `${group(v, 1)}%` : group(v, 2));

/** The pivot. A missing cell is `null` (the screen says "Not measured"); the order of indicators is the order asked for. */
export function runReport(data: DatasetResult, q: ReportQuery): ReportTable {
  const order = q.indicatorIds.map((id) => data.indicators.find((i) => i.id === id)).filter((i): i is NonNullable<typeof i> => !!i);
  const unit = (u: string | undefined) => (u && u.trim() ? ` (${u.trim()})` : "");
  const indLabel = (i: (typeof order)[number]) => `${i.code} ${i.name}${unit(i.unit)}`;
  const at = new Map(data.points.map((p) => [`${p.indicatorId}|${p.periodId}`, p.value]));
  const get = (i: string, p: string) => cell(at.get(`${i}|${p}`) ?? null, q.measure);
  const notes = [...data.notes];
  if (data.provenance.unverified > 0) notes.push(`${data.provenance.unverified} of ${data.provenance.points} figures are not verified yet.`);
  if (data.missingIndicatorIds.length > 0) notes.push(`${data.missingIndicatorIds.length} chosen indicator${data.missingIndicatorIds.length === 1 ? " is" : "s are"} no longer in the project.`);
  if (q.breakdown) {
    const period = data.periods[data.periods.length - 1];
    if (!period) return { columns: ["Indicator"], rows: [], notes: [...notes, "There is no period in this range."] };
    notes.push(`Groups are shown for ${period.label}.`);
    const split = new Map<string, Map<string, string>>();
    const cats: string[] = [];
    for (const i of order) {
      const point = data.points.find((p) => p.indicatorId === i.id && p.periodId === period.id);
      const m = new Map<string, string>();
      for (const e of point?.breakdown ?? []) if (e.dimension === q.breakdown) { m.set(e.category, e.value); if (!cats.includes(e.category)) cats.push(e.category); }
      split.set(i.id, m);
    }
    const shown = (v: string | undefined): string | null => { if (v === undefined || v.trim() === "") return null; const n = Number(v.replace(/,/g, "")); return Number.isFinite(n) ? group(n, 2) : v; };
    if (cats.length === 0) notes.push(`No ${REPORT_DIMENSION_WORDS[q.breakdown]} split was recorded for these indicators in ${period.label}.`);
    return { columns: ["Indicator", ...cats, "Recorded total"], rows: order.map((i) => ({ label: indLabel(i), cells: [...cats.map((c) => shown(split.get(i.id)?.get(c))), get(i.id, period.id)] })), notes };
  }
  if (q.rows === "INDICATOR") {
    return { columns: ["Indicator", ...data.periods.map((p) => p.label)], rows: order.map((i) => ({ label: indLabel(i), cells: data.periods.map((p) => get(i.id, p.id)) })), notes };
  }
  return { columns: ["Period", ...order.map(indLabel)], rows: data.periods.map((p) => ({ label: p.label, cells: order.map((i) => get(i.id, p.id)) })), notes };
}

const csv = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
/** The table as CSV; an empty cell stays empty (never 0), and a leading =, +, - or @ is defused so a spreadsheet does not run it. */
export function reportCsv(t: ReportTable): string {
  const safe = (s: string) => (/^[=+\-@]/.test(s) ? `'${s}` : s);
  return [t.columns, ...t.rows.map((r) => [r.label, ...r.cells.map((c) => c ?? "")])].map((row) => row.map((c) => csv(safe(c))).join(",")).join("\r\n") + "\r\n";
}
