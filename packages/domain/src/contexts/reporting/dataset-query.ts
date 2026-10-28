import { measureValue } from "./data-charts.js";
import { indexCells, type ChartMeasure, type DataSheet, type DataSheetIndicator, type DataSheetPeriod } from "./data-sheet.js";

/**
 * Datasets (Phase 34.0): the one way a chart, a sheet, a dashboard tile or a map asks the data sheet for figures. A query names
 * indicators, a measure and a period range; the answer is a long list of points (one per indicator and period) with a gap, never
 * a 0, wherever nothing is recorded. Pure: the same query on the same sheet always gives the same answer.
 */

/** Data that is not in the data sheet and is attached by the server when a chart asks for it. */
export type DatasetSource = "PLAN" | "ACTIVITY_DAYS" | "BUDGET" | "PLACES";

export interface DatasetPlanRow { id: string; title: string; kind: "ACTIVITY" | "MILESTONE"; start: string; end: string; status: string; signal: string; signalLabel: string }
/** One day and how many activities were completed on it (a record spanning days counts on its first day). */
export interface DatasetDay { date: string; count: number }
/** One budget line: who funds it, its cost category, what is budgeted and what is spent (major units of one currency). */
export interface DatasetBudgetLine { donor: string; category: string; currency: string; budgeted: number; spent: number }

/** One place's value of an indicator at the chosen level of the organisation's place tree (rates are shown, never combined). */
export interface DatasetPlace {
  name: string;
  /** "Rabak › White Nile › Sudan". */
  path: string;
  level: number;
  /** null when nothing is recorded or the type cannot be combined across places. */
  value: number | null;
  partly: boolean;
  latitude?: number | undefined;
  longitude?: number | undefined;
}

export interface DatasetQuery {
  /** PLACES: how deep in the place tree to read (0 country, 1 first-level area …); the first indicator is the one read. */
  placeLevel?: number | undefined;
  /** Extra data to attach (the plan, activity days, the budget); the sheet's own figures are always there. */
  sources?: DatasetSource[] | undefined;
  indicatorIds: string[];
  measure: ChartMeasure;
  fromPeriodId?: string | undefined;
  toPeriodId?: string | undefined;
  /** Draft and handed-in values are returned only when this is on; otherwise they are withheld and counted. */
  includeDraft: boolean;
}

export interface DatasetPoint {
  indicatorId: string;
  periodId: string;
  periodLabel: string;
  /** null = nothing recorded, not meaningful under this measure, or withheld because it is not verified. Never 0. */
  value: number | null;
  /** The cell's status when something is recorded ("" when nothing is). */
  status: string;
  verified: boolean;
  /** The period value split by group, as recorded (only when the point carries a value and a split was recorded). */
  breakdown?: Array<{ dimension: string; category: string; value: string }> | undefined;
}

/** One period's finance figures, to the period end (expenditure is cumulative to date), or nulls when none are recorded. */
export interface DatasetFinanceRow {
  periodId: string;
  periodLabel: string;
  currency: string;
  budget: number | null;
  expenditure: number | null;
  burnRatePercent: number | null;
  verified: boolean;
}

export interface DatasetResult {
  indicators: DataSheetIndicator[];
  periods: DataSheetPeriod[];
  points: DatasetPoint[];
  /** Asked for but not in the sheet (archived, or from another project). */
  missingIndicatorIds: string[];
  /** The chosen indicators use more than one unit: they cannot share a raw axis. */
  mixedUnits: boolean;
  /** Attached when asked for through `DatasetQuery.sources`; undefined when not asked for or not allowed for this viewer. */
  plan?: DatasetPlanRow[] | undefined;
  activityDays?: DatasetDay[] | undefined;
  budget?: DatasetBudgetLine[] | undefined;
  places?: DatasetPlace[] | undefined;
  /** Finance figures for the periods in range (only periods that have some); verified ones only when drafts are not asked for. */
  finance: DatasetFinanceRow[];
  /** Values that exist but were left out because they are not verified and drafts were not asked for. */
  withheldDrafts: number;
  /** Points that carry a value, and how many of those are not verified. */
  provenance: { points: number; unverified: number };
  /** One sentence each, for the person: why something is a gap. */
  notes: string[];
}

const unitOf = (i: DataSheetIndicator): string => (i.unit ?? "").trim();

/** The periods between the chosen ends (inclusive); an unknown end is ignored. */
function periodsBetween(sheet: DataSheet, fromId?: string, toId?: string): DataSheetPeriod[] {
  const from = fromId ? sheet.periods.findIndex((p) => p.id === fromId) : -1;
  const to = toId ? sheet.periods.findIndex((p) => p.id === toId) : -1;
  const lo = from >= 0 ? from : 0;
  const hi = to >= 0 ? to : sheet.periods.length - 1;
  return sheet.periods.slice(Math.min(lo, hi), Math.max(lo, hi) + 1);
}

export function resolveDataset(sheet: DataSheet, query: DatasetQuery): DatasetResult {
  const cells = indexCells(sheet);
  const periods = periodsBetween(sheet, query.fromPeriodId, query.toPeriodId);
  const byId = new Map(sheet.indicators.map((i) => [i.id, i]));
  const wanted = [...new Set(query.indicatorIds)];
  const indicators = wanted.map((id) => byId.get(id)).filter((i): i is DataSheetIndicator => Boolean(i));
  const missingIndicatorIds = wanted.filter((id) => !byId.has(id));

  const points: DatasetPoint[] = [];
  let withheldDrafts = 0;
  let valued = 0;
  let unverified = 0;
  const ratesAsked = new Set<string>();
  for (const indicator of indicators) {
    for (const period of periods) {
      const cell = cells.get(`${indicator.id}|${period.id}`);
      let value = measureValue(cells, indicator, period, query.measure);
      const verified = cell?.status === "VERIFIED";
      const recorded = value !== null;
      if (query.measure === "PERCENT_OF_TARGET" && indicator.isRate) ratesAsked.add(indicator.code);
      if (recorded && !verified && !query.includeDraft) {
        value = null;
        withheldDrafts += 1;
      }
      if (value !== null) {
        valued += 1;
        if (!verified) unverified += 1;
      }
      points.push({ indicatorId: indicator.id, periodId: period.id, periodLabel: period.label, value, status: recorded ? (cell?.status ?? "") : "", verified: recorded && verified, ...(recorded && cell?.breakdown?.length ? { breakdown: cell.breakdown } : {}) });
    }
  }

  const finance: DatasetFinanceRow[] = [];
  for (const period of periods) {
    const f = sheet.finance.find((x) => x.periodId === period.id);
    if (!f) continue;
    if (!f.verified && !query.includeDraft) { withheldDrafts += 1; continue; }
    const n = (v: string | undefined): number | null => { if (v === undefined || v.trim() === "") return null; const x = Number.parseFloat(v.replace(/,/g, "")); return Number.isFinite(x) ? x : null; };
    finance.push({ periodId: period.id, periodLabel: period.label, currency: f.currency, budget: n(f.budget), expenditure: n(f.expenditure), burnRatePercent: n(f.burnRatePercent), verified: f.verified });
  }

  const notes: string[] = [];
  if (missingIndicatorIds.length > 0) notes.push(`${missingIndicatorIds.length === 1 ? "An indicator is" : `${missingIndicatorIds.length} indicators are`} not in this project's data and ${missingIndicatorIds.length === 1 ? "is" : "are"} left out.`);
  if (ratesAsked.size > 0) notes.push(`A rate has no share of its target, so nothing is shown as % of target for: ${[...ratesAsked].join(", ")}.`);
  if (withheldDrafts > 0) notes.push(`${withheldDrafts} ${withheldDrafts === 1 ? "value is" : "values are"} left out because ${withheldDrafts === 1 ? "it is" : "they are"} not verified yet.`);
  const mixedUnits = new Set(indicators.map(unitOf)).size > 1;
  return { indicators, periods, points, finance, missingIndicatorIds, mixedUnits, withheldDrafts, provenance: { points: valued, unverified }, notes };
}

/** The figures as rows for a grid: one row per indicator, one column per period, `null` for a gap. */
export function datasetGrid(result: DatasetResult): Array<{ indicator: DataSheetIndicator; values: Array<number | null> }> {
  return result.indicators.map((indicator) => ({
    indicator,
    values: result.periods.map((p) => result.points.find((pt) => pt.indicatorId === indicator.id && pt.periodId === p.id)?.value ?? null),
  }));
}

/**
 * Groups requests by project so each project's data sheet is read once, however many charts, tiles or maps ask for it.
 * Order inside a group is the order given; groups come in first-seen order.
 */
export function groupByProject<T extends { projectId: string }>(requests: ReadonlyArray<T>): Array<{ projectId: string; requests: T[] }> {
  const groups = new Map<string, T[]>();
  for (const r of requests) groups.set(r.projectId, [...(groups.get(r.projectId) ?? []), r]);
  return [...groups].map(([projectId, items]) => ({ projectId, requests: items }));
}
