import { optionForType, type ChartType, type ResolvedChartData } from "./chart-config.js";
import { indexCells, type DataSheet, type DataSheetIndicator, type DataSheetPeriod, type PivotMeasure } from "./data-sheet.js";

/**
 * Data Center charts: a chart is a small spec (template + indicators + measure + period range) drawn from the project's
 * data sheet. Pure and deterministic, so the browser and any later export draw the same picture. A missing value is a gap
 * (null), never 0; indicators with different units never share a raw axis; a rate is never judged as "% of target".
 */

export type DataChartTemplate =
  | "INDICATOR_OVER_TIME"
  | "INDICATOR_VS_TARGET"
  | "INDICATORS_PROGRESS"
  | "INDICATORS_OVER_TIME"
  | "STATUS_DISTRIBUTION"
  | "FINANCE_BUDGET_VS_SPEND"
  | "FINANCE_BURN_RATE";

export interface DataChartSpec {
  template: DataChartTemplate;
  indicatorIds: string[];
  measure: PivotMeasure;
  type: ChartType;
  fromPeriodId?: string | undefined;
  toPeriodId?: string | undefined;
  /** Draw the indicator's target as a reference line (over-time charts of one indicator). */
  showTarget: boolean;
  title?: string | undefined;
  /** Hex colours (#rrggbb) for the series (or pie slices), in order; absent: the standard palette. */
  colors?: string[] | undefined;
}

/** Ready-made colour sets for the picker; the first is the app's standard palette. */
export const CHART_PALETTES: ReadonlyArray<{ id: string; label: string; colors: string[] }> = [
  { id: "STANDARD", label: "Standard", colors: ["#2f7be8", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444", "#06b6d4"] },
  { id: "COLOUR_BLIND", label: "Colour-blind safe", colors: ["#0072B2", "#E69F00", "#009E73", "#CC79A7", "#D55E00", "#56B4E9"] },
  { id: "OCEAN", label: "Ocean", colors: ["#0b3c5d", "#1d6fa5", "#328cc1", "#5aaed6", "#8fcae6", "#c3e4f2"] },
  { id: "FOREST", label: "Forest", colors: ["#1b4332", "#2d6a4f", "#40916c", "#52b788", "#74c69d", "#b7e4c7"] },
  { id: "WARM", label: "Warm", colors: ["#7f1d1d", "#c2410c", "#ea580c", "#f59e0b", "#fbbf24", "#fde68a"] },
  { id: "GREYS", label: "Greys (prints well)", colors: ["#1f2937", "#4b5563", "#6b7280", "#9ca3af", "#d1d5db", "#e5e7eb"] },
];

export const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/;

export interface DataChartTemplateInfo {
  label: string;
  description: string;
  /** How many indicators the template takes: exactly one, one or more, or none (finance, status). */
  indicators: "one" | "many" | "none";
  types: ChartType[];
  usesMeasure: boolean;
}

export const DATA_CHART_TEMPLATES: Record<DataChartTemplate, DataChartTemplateInfo> = {
  INDICATOR_OVER_TIME: {
    label: "One indicator over time",
    description: "Monthly (or per-period) achievement of a single indicator, optionally against its target.",
    indicators: "one",
    types: ["BAR", "LINE", "AREA"],
    usesMeasure: true,
  },
  INDICATOR_VS_TARGET: {
    label: "One indicator: baseline, target and achievement",
    description: "The latest recorded achievement of one indicator beside its baseline and target.",
    indicators: "one",
    types: ["BAR", "GAUGE"],
    usesMeasure: false,
  },
  INDICATORS_PROGRESS: {
    label: "Progress of several indicators",
    description: "Latest cumulative achievement of each chosen indicator as a percentage of its own target.",
    indicators: "many",
    types: ["BAR", "RADAR"],
    usesMeasure: false,
  },
  INDICATORS_OVER_TIME: {
    label: "Several indicators over time",
    description: "Compare indicators period by period. Indicators must share one unit, or be shown as % of target.",
    indicators: "many",
    types: ["LINE", "BAR", "AREA"],
    usesMeasure: true,
  },
  STATUS_DISTRIBUTION: {
    label: "Verification status of values",
    description: "How many recorded values are verified, in review or still draft.",
    indicators: "none",
    types: ["PIE", "BAR"],
    usesMeasure: false,
  },
  FINANCE_BUDGET_VS_SPEND: {
    label: "Budget vs expenditure",
    description: "Budget and expenditure to date for each period.",
    indicators: "none",
    types: ["BAR", "LINE"],
    usesMeasure: false,
  },
  FINANCE_BURN_RATE: {
    label: "Burn rate over time",
    description: "Share of the budget spent, period by period.",
    indicators: "none",
    types: ["LINE", "BAR", "AREA"],
    usesMeasure: false,
  },
};

export const DATA_CHART_TEMPLATE_ORDER: DataChartTemplate[] = [
  "INDICATOR_OVER_TIME",
  "INDICATOR_VS_TARGET",
  "INDICATORS_PROGRESS",
  "INDICATORS_OVER_TIME",
  "STATUS_DISTRIBUTION",
  "FINANCE_BUDGET_VS_SPEND",
  "FINANCE_BURN_RATE",
];

/** How many plotted values there are and how many of them are not verified yet (a report must say so). */
export interface DataChartProvenance {
  points: number;
  unverified: number;
}

export type DataChartResult =
  | { ok: true; option: Record<string, unknown>; resolved: ResolvedChartData; title: string; notes: string[]; provenance: DataChartProvenance }
  | { ok: false; reason: string };

const num = (v: string | undefined): number | null => {
  if (v === undefined || v.trim() === "") return null;
  const n = Number.parseFloat(v.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};
const round1 = (n: number): number => Math.round(n * 10) / 10;
const pct = (value: number | null, target: number | null): number | null => (value === null || target === null || target <= 0 ? null : round1((value / target) * 100));

/** The periods between the chosen ends (inclusive); an unknown end is ignored. */
export function periodsInRange(sheet: DataSheet, fromId?: string, toId?: string): DataSheetPeriod[] {
  const from = fromId ? sheet.periods.findIndex((p) => p.id === fromId) : -1;
  const to = toId ? sheet.periods.findIndex((p) => p.id === toId) : -1;
  const lo = from >= 0 ? from : 0;
  const hi = to >= 0 ? to : sheet.periods.length - 1;
  return sheet.periods.slice(Math.min(lo, hi), Math.max(lo, hi) + 1);
}

const unitOf = (i: DataSheetIndicator): string => (i.unit ?? "").trim();

function draw(spec: DataChartSpec, data: Omit<ResolvedChartData, "type" | "dataBinding" | "title">, title: string): DataChartResult {
  const colors = (spec.colors ?? []).filter((c) => HEX_COLOUR.test(c));
  const resolved: ResolvedChartData = { ...data, type: spec.type, dataBinding: "DATA_CENTER", title, ...(colors.length > 0 ? { colors } : {}) };
  const option = optionForType(resolved, spec.type);
  return { ok: true, option, resolved, title: spec.title?.trim() || title, notes: [], provenance: { points: 0, unverified: 0 } };
}

/** The value of one cell under a measure, as a number (null when not recorded or not meaningful). */
function measureValue(cells: ReturnType<typeof indexCells>, indicator: DataSheetIndicator, period: DataSheetPeriod, measure: PivotMeasure): number | null {
  const cell = cells.get(`${indicator.id}|${period.id}`);
  if (!cell) return null;
  if (measure === "PERIOD") return num(cell.periodValue);
  if (measure === "CUMULATIVE") return num(cell.cumulativeValue);
  if (indicator.isRate) return null;
  return pct(num(cell.cumulativeValue) ?? num(cell.periodValue), num(indicator.target));
}

/** Draws a chart from the data sheet. Draft values are plotted too; `provenance` says how many are not verified yet. */
export function buildDataChart(sheet: DataSheet, spec: DataChartSpec): DataChartResult {
  const result = buildDataChartCore(sheet, spec);
  if (!result.ok) return result;
  const provenance = plottedProvenance(sheet, spec);
  return {
    ...result,
    provenance,
    notes: provenance.unverified > 0 ? [...result.notes, `${provenance.unverified} of ${provenance.points} plotted ${provenance.points === 1 ? "value is" : "values are"} not verified yet.`] : result.notes,
  };
}

function plottedProvenance(sheet: DataSheet, spec: DataChartSpec): DataChartProvenance {
  const cells = indexCells(sheet);
  const periods = periodsInRange(sheet, spec.fromPeriodId, spec.toPeriodId);
  const chosen = spec.indicatorIds.map((id) => sheet.indicators.find((i) => i.id === id)).filter((i): i is DataSheetIndicator => Boolean(i));
  let points = 0;
  let unverified = 0;
  const count = (indicator: DataSheetIndicator, period: DataSheetPeriod, measure: PivotMeasure): boolean => {
    if (measureValue(cells, indicator, period, measure) === null) return false;
    points += 1;
    if (cells.get(`${indicator.id}|${period.id}`)?.status !== "VERIFIED") unverified += 1;
    return true;
  };
  switch (spec.template) {
    case "INDICATOR_OVER_TIME": {
      const ind = chosen[0];
      if (ind) for (const p of periods) count(ind, p, ind.isRate && spec.measure === "PERCENT_OF_TARGET" ? "PERIOD" : spec.measure);
      break;
    }
    case "INDICATORS_OVER_TIME": {
      const mixed = new Set(chosen.map(unitOf)).size > 1;
      const measure: PivotMeasure = mixed && spec.measure !== "PERCENT_OF_TARGET" ? "PERCENT_OF_TARGET" : spec.measure;
      for (const i of chosen) if (!(measure === "PERCENT_OF_TARGET" && i.isRate)) for (const p of periods) count(i, p, measure);
      break;
    }
    case "INDICATOR_VS_TARGET": {
      const ind = chosen[0];
      if (!ind) break;
      for (const p of [...periods].reverse()) {
        if (count(ind, p, ind.isRate ? "PERIOD" : "CUMULATIVE") || count(ind, p, "PERIOD")) break;
      }
      break;
    }
    case "INDICATORS_PROGRESS":
      for (const i of chosen) if (!i.isRate) for (const p of [...periods].reverse()) if (count(i, p, "PERCENT_OF_TARGET")) break;
      break;
    case "FINANCE_BUDGET_VS_SPEND":
    case "FINANCE_BURN_RATE": {
      const inRange = new Set(periods.map((p) => p.id));
      for (const f of sheet.finance) {
        if (!inRange.has(f.periodId)) continue;
        points += 1;
        if (!f.verified) unverified += 1;
      }
      break;
    }
    case "STATUS_DISTRIBUTION":
      break;
  }
  return { points, unverified };
}

function buildDataChartCore(sheet: DataSheet, spec: DataChartSpec): DataChartResult {
  const info = DATA_CHART_TEMPLATES[spec.template];
  if (!info.types.includes(spec.type)) return { ok: false, reason: `${info.label} cannot be drawn as a ${spec.type.toLowerCase()} chart.` };
  const cells = indexCells(sheet);
  const periods = periodsInRange(sheet, spec.fromPeriodId, spec.toPeriodId);
  const chosen = spec.indicatorIds.map((id) => sheet.indicators.find((i) => i.id === id)).filter((i): i is DataSheetIndicator => Boolean(i));

  if (info.indicators === "one" && chosen.length !== 1) return { ok: false, reason: "Choose one indicator." };
  if (info.indicators === "many" && chosen.length === 0) return { ok: false, reason: "Choose at least one indicator." };

  switch (spec.template) {
    case "INDICATOR_OVER_TIME": {
      const indicator = chosen[0]!;
      const measure = indicator.isRate && spec.measure === "PERCENT_OF_TARGET" ? "PERIOD" : spec.measure;
      const data = periods.map((p) => measureValue(cells, indicator, p, measure));
      if (data.every((d) => d === null)) return { ok: false, reason: `No ${measure === "PERCENT_OF_TARGET" ? "% of target" : "values"} are recorded for ${indicator.code} in these periods.` };
      const target = num(indicator.target);
      const label = measure === "PERCENT_OF_TARGET" ? "% of target" : measure === "CUMULATIVE" ? "Cumulative" : "Period value";
      const result = draw(
        spec,
        {
          categories: periods.map((p) => p.label),
          series: [{ name: label, data }],
          ...(measure === "PERCENT_OF_TARGET" ? { unit: "%", referenceLine: { name: "Target (100%)", value: 100 } } : unitOf(indicator) ? { unit: unitOf(indicator) } : {}),
          // A target line is only comparable with a cumulative figure or a percentage, never a single period's value.
          ...(measure === "CUMULATIVE" && spec.showTarget && target !== null ? { referenceLine: { name: "Target", value: target } } : {}),
        },
        `${indicator.code} ${indicator.name}`,
      );
      if (result.ok && indicator.isRate && spec.measure === "PERCENT_OF_TARGET") result.notes.push("This indicator is a rate, so its period value is shown instead of % of target.");
      return result;
    }

    case "INDICATOR_VS_TARGET": {
      const indicator = chosen[0]!;
      const latest = [...periods].reverse().map((p) => ({ p, v: measureValue(cells, indicator, p, indicator.isRate ? "PERIOD" : "CUMULATIVE") ?? measureValue(cells, indicator, p, "PERIOD") })).find((x) => x.v !== null);
      if (!latest) return { ok: false, reason: `No value is recorded for ${indicator.code} in these periods.` };
      const title = `${indicator.code} ${indicator.name}`;
      if (spec.type === "GAUGE") {
        const p = pct(latest.v, num(indicator.target));
        if (p === null || indicator.isRate) return { ok: false, reason: "A gauge needs a numeric target and a count indicator (not a rate)." };
        return draw(spec, { categories: [indicator.code], series: [{ name: "% of target", data: [p] }], unit: "%", referenceLine: { name: "Target (100%)", value: 100 } }, title);
      }
      const result = draw(
        spec,
        {
          categories: ["Baseline", "Target", `Achievement (${latest.p.label})`],
          series: [{ name: indicator.code, data: [num(indicator.baseline), num(indicator.target), latest.v] }],
          ...(unitOf(indicator) ? { unit: unitOf(indicator) } : {}),
        },
        title,
      );
      return result;
    }

    case "INDICATORS_PROGRESS": {
      const usable = chosen.filter((i) => !i.isRate);
      const skipped = chosen.filter((i) => i.isRate).map((i) => i.code);
      const rows = usable
        .map((i) => {
          const latest = [...periods].reverse().map((p) => measureValue(cells, i, p, "PERCENT_OF_TARGET")).find((v) => v !== null) ?? null;
          return { code: i.code, value: latest };
        })
        .filter((r) => r.value !== null);
      if (rows.length === 0) return { ok: false, reason: "None of the chosen indicators has a value and a numeric target to compare." };
      const result = draw(spec, { categories: rows.map((r) => r.code), series: [{ name: "% of target", data: rows.map((r) => r.value) }], unit: "%", referenceLine: { name: "Target (100%)", value: 100 } }, "Progress against target (% of target)");
      if (result.ok && skipped.length > 0) result.notes.push(`Left out because they are rates, not progress toward a count: ${skipped.join(", ")}.`);
      if (result.ok && rows.length < usable.length) result.notes.push("Indicators with no recorded value or numeric target are left out.");
      return result;
    }

    case "INDICATORS_OVER_TIME": {
      const units = new Set(chosen.map(unitOf));
      const mixed = units.size > 1;
      const measure: PivotMeasure = mixed && spec.measure !== "PERCENT_OF_TARGET" ? "PERCENT_OF_TARGET" : spec.measure;
      const series = chosen
        .filter((i) => !(measure === "PERCENT_OF_TARGET" && i.isRate))
        .map((i) => ({ name: i.code, data: periods.map((p) => measureValue(cells, i, p, measure)) }))
        .filter((s) => s.data.some((d) => d !== null));
      if (series.length === 0) return { ok: false, reason: "No values are recorded for the chosen indicators in these periods." };
      const result = draw(
        spec,
        {
          categories: periods.map((p) => p.label),
          series,
          ...(measure === "PERCENT_OF_TARGET" ? { unit: "%", referenceLine: { name: "Target (100%)", value: 100 } } : units.size === 1 && [...units][0] ? { unit: [...units][0]! } : {}),
        },
        measure === "PERCENT_OF_TARGET" ? "Indicators over time (% of target)" : "Indicators over time",
      );
      if (result.ok && mixed && spec.measure !== "PERCENT_OF_TARGET") result.notes.push("The indicators use different units, so they are shown as % of target instead of on one raw axis.");
      return result;
    }

    case "STATUS_DISTRIBUTION": {
      const inRange = new Set(periods.map((p) => p.id));
      const scope = new Set(chosen.map((i) => i.id));
      const counts = new Map<string, number>();
      for (const c of sheet.cells) {
        if (!inRange.has(c.periodId) || (scope.size > 0 && !scope.has(c.indicatorId))) continue;
        if (c.periodValue.trim() === "" && c.cumulativeValue.trim() === "") continue;
        const status = (c.status || "DRAFT").replace(/_/g, " ");
        counts.set(status, (counts.get(status) ?? 0) + 1);
      }
      if (counts.size === 0) return { ok: false, reason: "No values are recorded yet." };
      return draw(spec, { categories: [...counts.keys()], series: [...counts].map(([name, count]) => ({ name, data: [count] })) }, "Verification status of recorded values");
    }

    case "FINANCE_BUDGET_VS_SPEND":
    case "FINANCE_BURN_RATE": {
      const byPeriod = new Map(sheet.finance.map((f) => [f.periodId, f]));
      const rows = periods.map((p) => ({ p, f: byPeriod.get(p.id) })).filter((x) => x.f);
      if (rows.length === 0) return { ok: false, reason: "No finance figures are recorded for these periods." };
      const currencies = new Set(rows.map((r) => r.f!.currency));
      if (currencies.size > 1) return { ok: false, reason: "The periods use different currencies, which cannot share an axis." };
      const currency = [...currencies][0]!;
      const unverified = rows.some((r) => !r.f!.verified);
      const result =
        spec.template === "FINANCE_BUDGET_VS_SPEND"
          ? draw(
              spec,
              {
                categories: rows.map((r) => r.p.label),
                series: [
                  { name: "Budget", data: rows.map((r) => num(r.f!.budget)) },
                  { name: "Expenditure to date", data: rows.map((r) => num(r.f!.expenditure)) },
                ],
                unit: currency,
              },
              "Budget vs expenditure",
            )
          : draw(spec, { categories: rows.map((r) => r.p.label), series: [{ name: "Burn rate", data: rows.map((r) => num(r.f!.burnRatePercent ?? "")) }], unit: "%" }, "Burn rate (% of budget spent)");
      if (result.ok && unverified) result.notes.push("Some of these finance figures are not verified yet.");
      return result;
    }
  }
}
