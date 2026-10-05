/**
 * User-chosen chart configuration attached to a report section. The chart is
 * rendered interactively in the report workspace (client) and identically as a
 * static image in exported DOCX/PDF/Excel. `type` selects the chart family;
 * `dataBinding` selects which chartable dataset the section visualises.
 */

export type ChartType = "BAR" | "LINE" | "PIE" | "AREA" | "RADAR" | "GAUGE";

export const CHART_TYPES: ChartType[] = ["BAR", "LINE", "PIE", "AREA", "RADAR", "GAUGE"];

export type ChartDataBinding =
  // Progress of every indicator as a percentage of its own target (comparable across units).
  | "INDICATOR_PROGRESS"
  // Baseline vs target vs achievement for every indicator (raw values for one unit, % of target when units differ).
  | "INDICATOR_COMPARISON"
  // Achievement per indicator (simple value chart).
  | "INDICATOR_ACHIEVEMENT"
  // Share of indicators by status (verified / needs review / draft).
  | "STATUS_DISTRIBUTION";

export const CHART_DATA_BINDINGS: ChartDataBinding[] = [
  "INDICATOR_PROGRESS",
  "INDICATOR_COMPARISON",
  "INDICATOR_ACHIEVEMENT",
  "STATUS_DISTRIBUTION",
];

/** Bindings a chart derived from a table of the section carries (never chosen by hand). */
export type DerivedChartBinding = "TABLE_INDICATOR_PROGRESS" | "TABLE_FINANCE_BY_LINE" | "TABLE_ACTIVITY_PARTICIPANTS";

/**
 * Which chart types a binding can honestly be drawn as. A pie of baseline/target/achievement, a line joining unrelated
 * indicators, or a radar of raw counts says nothing, so those combinations do not exist.
 */
export const CHART_BINDING_TYPES: Record<ChartDataBinding | DerivedChartBinding, ChartType[]> = {
  INDICATOR_PROGRESS: ["BAR", "RADAR", "GAUGE"],
  INDICATOR_COMPARISON: ["BAR"],
  INDICATOR_ACHIEVEMENT: ["BAR"],
  STATUS_DISTRIBUTION: ["PIE", "BAR"],
  TABLE_INDICATOR_PROGRESS: ["BAR", "RADAR"],
  TABLE_FINANCE_BY_LINE: ["BAR"],
  TABLE_ACTIVITY_PARTICIPANTS: ["BAR"],
};

/** The chart types allowed for a binding; a gauge needs exactly one thing to show. */
export function allowedChartTypes(binding: ChartDataBinding | DerivedChartBinding, categoryCount?: number): ChartType[] {
  return CHART_BINDING_TYPES[binding].filter((t) => t !== "GAUGE" || categoryCount === undefined || categoryCount === 1);
}

export function isChartTypeAllowed(binding: ChartDataBinding | DerivedChartBinding, type: ChartType, categoryCount?: number): boolean {
  return allowedChartTypes(binding, categoryCount).includes(type);
}

/** The requested type when the binding allows it, otherwise the binding's first allowed type (never an error at render time). */
export function coerceChartType(binding: ChartDataBinding | DerivedChartBinding, type: ChartType, categoryCount?: number): ChartType {
  const allowed = allowedChartTypes(binding, categoryCount);
  return allowed.includes(type) ? type : allowed[0]!;
}

const FINANCE_TITLE_RE = /financ|budget|expenditure|procurement|burn/i;
const ANNEX_TITLE_RE = /\b(annex|appendix|attachment)\b/i;

/**
 * The manual (indicator) chart bindings that make sense for a section, by its title. A financial section has no indicator chart to
 * draw (its chart comes from its own finance table), and neither does an evidence log or an annex.
 */
export function bindingsForSection(title: string): ChartDataBinding[] {
  if (FINANCE_TITLE_RE.test(title) || ANNEX_TITLE_RE.test(title) || /evidence/i.test(title)) return [];
  return ["INDICATOR_PROGRESS", "INDICATOR_COMPARISON", "INDICATOR_ACHIEVEMENT", "STATUS_DISTRIBUTION"];
}

export function defaultBindingForSection(title: string): ChartDataBinding | null {
  return bindingsForSection(title)[0] ?? null;
}

export interface ChartConfig {
  type: ChartType;
  dataBinding: ChartDataBinding;
  /** Free-form ECharts option overrides (colors, stacking, labels, etc.). */
  options?: Record<string, unknown>;
}

export function createChartConfig(input: {
  type?: ChartType;
  dataBinding?: ChartDataBinding;
  options?: Record<string, unknown>;
}): ChartConfig {
  return {
    type: input.type ?? "BAR",
    dataBinding: input.dataBinding ?? "INDICATOR_COMPARISON",
    options: input.options ?? {},
  };
}

export function parseChartConfig(json: string | null | undefined): ChartConfig | null {
  if (!json) return null;
  try {
    const raw = JSON.parse(json) as {
      type?: unknown;
      dataBinding?: unknown;
      options?: Record<string, unknown>;
    };
    const type = raw.type as ChartType;
    const dataBinding = raw.dataBinding as ChartDataBinding;
    if (!CHART_TYPES.includes(type) || !CHART_DATA_BINDINGS.includes(dataBinding)) return null;
    return { type, dataBinding, options: raw.options ?? {} };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Deterministic chart data resolution
// ---------------------------------------------------------------------------

/**
 * A serialisable, ECharts-ready chart dataset. The same shape is consumed by
 * the interactive client renderer and by the server-side SSR->PNG renderer so
 * the finalized report matches the exported image exactly.
 */
export interface ResolvedChartData {
  type: ChartType;
  dataBinding: ChartDataBinding | DerivedChartBinding;
  /** X-axis / category labels (indicator codes, statuses, etc.). */
  categories: string[];
  /** One or more named series; each series maps to an ECharts series. */
  series: Array<{
    name: string;
    data: Array<string | number | null>;
  }>;
  /** Optional secondary measure per category (e.g. target for a bar chart). */
  unit?: string;
  /** Human-readable chart title derived from the binding. */
  title: string;
  /** Stack the series of a bar chart (e.g. male + female participants). */
  stacked?: boolean;
  /** A horizontal reference line (the 100% target of a progress chart). */
  referenceLine?: { name: string; value: number };
  /** Set when the chart shows only the first `shown` of `total` categories. */
  truncated?: { shown: number; total: number };
}

export interface ChartIndicatorInput {
  code: string;
  name: string;
  baseline: string;
  target: string;
  unit?: string;
  achievement: string;
  status: string;
}

/**
 * The value a chart plots for an indicator. A roll-up report (semi-annual, annual, final) states progress since the project
 * started, so it plots the cumulative figure against the project target; a rate (percentage, ratio) is never cumulative.
 * Missing data is an empty string, never "0".
 */
export function chartAchievement(input: { reportType?: string; indicatorType?: string; periodValue?: string; cumulativeValue?: string }): string {
  const rollUp = input.reportType === "SEMI_ANNUAL" || input.reportType === "ANNUAL" || input.reportType === "FINAL";
  const rate = input.indicatorType === "PERCENTAGE" || input.indicatorType === "RATIO";
  const cumulative = (input.cumulativeValue ?? "").trim();
  if (rollUp && !rate && cumulative !== "") return cumulative;
  return (input.periodValue ?? "").trim();
}

const MAX_CATEGORIES = 12;

const BINDING_TITLES: Record<ChartDataBinding, string> = {
  INDICATOR_PROGRESS: "Progress against target (% of target)",
  INDICATOR_COMPARISON: "Indicator baseline vs target vs achievement",
  INDICATOR_ACHIEVEMENT: "Indicator achievement",
  STATUS_DISTRIBUTION: "Indicator verification status",
};

const parseNumber = (value: string | undefined): number | null => {
  if (value === undefined || value === null || value.trim() === "") return null;
  const n = Number.parseFloat(value.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * Pure, deterministic chart data builder. No I/O and no LLM: given the report's indicator rows it emits ECharts-ready series.
 * An indicator with no value is left out (never drawn as zero); at most 12 categories are shown; indicators of different
 * units are never put on one raw axis, so they are drawn as a percentage of their own target.
 */
export function resolveChartData(input: ChartIndicatorInput[], config: ChartConfig): ResolvedChartData {
  const base: ResolvedChartData = {
    type: config.type,
    dataBinding: config.dataBinding,
    categories: [],
    series: [],
    title: BINDING_TITLES[config.dataBinding],
  };

  if (config.dataBinding === "STATUS_DISTRIBUTION") {
    const counts = new Map<string, number>();
    for (const i of input) {
      const status = i.status && i.status !== "" ? i.status : "DRAFT";
      counts.set(status, (counts.get(status) ?? 0) + 1);
    }
    for (const [status, count] of counts) {
      base.categories.push(status.replace(/_/g, " "));
      base.series.push({ name: status.replace(/_/g, " "), data: [count] });
    }
    if (base.series.length === 0) {
      base.categories = ["No data"];
      base.series = [{ name: "No data", data: [0] }];
    }
    return base;
  }

  const withValue = input.filter((i) => parseNumber(i.achievement) !== null);
  const shown = withValue.slice(0, MAX_CATEGORIES);
  if (withValue.length > shown.length) base.truncated = { shown: shown.length, total: withValue.length };
  const label = (i: ChartIndicatorInput): string => i.code || i.name || "—";
  const pctOfTarget = (value: number | null, target: number | null): number | null =>
    value === null || target === null || target <= 0 ? null : round1((value / target) * 100);

  if (config.dataBinding === "INDICATOR_PROGRESS") {
    const rows = shown.filter((i) => pctOfTarget(parseNumber(i.achievement), parseNumber(i.target)) !== null);
    base.categories = rows.map(label);
    base.series = [{ name: "% of target", data: rows.map((i) => pctOfTarget(parseNumber(i.achievement), parseNumber(i.target))) }];
    base.unit = "%";
    base.referenceLine = { name: "Target (100%)", value: 100 };
    return base;
  }

  const units = new Set(shown.map((i) => (i.unit ?? "").trim()).filter(Boolean));
  const mixedUnits = units.size > 1;
  if (mixedUnits) {
    // Counts of children, teachers and kits cannot share an axis: each indicator is drawn against its own target.
    const rows = shown.filter((i) => pctOfTarget(parseNumber(i.achievement), parseNumber(i.target)) !== null);
    base.categories = rows.map(label);
    base.unit = "%";
    base.referenceLine = { name: "Target (100%)", value: 100 };
    base.title = `${BINDING_TITLES[config.dataBinding]} (% of target)`;
    base.series =
      config.dataBinding === "INDICATOR_COMPARISON"
        ? [
            { name: "Baseline (% of target)", data: rows.map((i) => pctOfTarget(parseNumber(i.baseline), parseNumber(i.target))) },
            { name: "Achievement (% of target)", data: rows.map((i) => pctOfTarget(parseNumber(i.achievement), parseNumber(i.target))) },
          ]
        : [{ name: "Achievement (% of target)", data: rows.map((i) => pctOfTarget(parseNumber(i.achievement), parseNumber(i.target))) }];
    return base;
  }

  base.categories = shown.map(label);
  base.unit = [...units][0];
  base.series =
    config.dataBinding === "INDICATOR_COMPARISON"
      ? [
          { name: "Baseline", data: shown.map((i) => parseNumber(i.baseline)) },
          { name: "Target", data: shown.map((i) => parseNumber(i.target)) },
          { name: "Achievement", data: shown.map((i) => parseNumber(i.achievement)) },
        ]
      : [
          { name: "Achievement", data: shown.map((i) => parseNumber(i.achievement)) },
          { name: "Target", data: shown.map((i) => parseNumber(i.target)) },
        ];
  return base;
}

// ---------------------------------------------------------------------------
// ECharts option builder (shared by the interactive client and SSR->PNG export)
// ---------------------------------------------------------------------------

const ECHARTS_PALETTE = ["#2f7be8", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444", "#06b6d4"];

const numeric = (d: string | number | null | undefined): number => (typeof d === "number" ? d : d === null || d === undefined ? 0 : Number.parseFloat(String(d)) || 0);

/**
 * Pure ECharts option for already-resolved chart data. The requested type is coerced to one the binding allows, so a stored or
 * hand-picked type that cannot show this data (a pie of three series, a line over unrelated indicators) is drawn as a bar instead.
 */
export function optionFromResolved(resolved: ResolvedChartData, requestedType: ChartType): Record<string, unknown> {
  const type = coerceChartType(resolved.dataBinding, requestedType, resolved.categories.length);
  const unit = resolved.unit ?? "";

  if (type === "PIE") {
    const data = resolved.categories.map((name, i) => ({ name, value: numeric(resolved.series[i]?.data[0]) }));
    return {
      color: ECHARTS_PALETTE,
      tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
      legend: { type: "scroll", bottom: 0 },
      series: [{ type: "pie", radius: ["32%", "68%"], avoidLabelOverlap: true, itemStyle: { borderRadius: 6, borderColor: "#fff", borderWidth: 2 }, label: { formatter: "{b}" }, data }],
    };
  }

  if (type === "GAUGE") {
    const value = numeric(resolved.series[0]?.data[0]);
    const max = Math.max(resolved.referenceLine?.value ?? 100, Math.ceil(value / 10) * 10);
    return {
      series: [{
        type: "gauge",
        min: 0,
        max,
        progress: { show: true, width: 14 },
        axisLine: { lineStyle: { width: 14 } },
        axisLabel: { fontSize: 10 },
        title: { show: true, offsetCenter: [0, "70%"], fontSize: 12 },
        detail: { valueAnimation: true, formatter: unit ? `{value}${unit === "%" ? "%" : ` ${unit}`}` : "{value}" },
        data: [{ value, name: resolved.categories[0] ?? "" }],
      }],
    };
  }

  if (type === "RADAR") {
    const peak = Math.max(100, ...resolved.series.flatMap((s) => s.data.map(numeric)));
    return {
      color: ECHARTS_PALETTE,
      tooltip: {},
      legend: { bottom: 0 },
      radar: { indicator: resolved.categories.map((name) => ({ name, max: Math.ceil(peak / 10) * 10 })), radius: "65%" },
      series: [{ type: "radar", areaStyle: { opacity: 0.15 }, data: resolved.series.map((s) => ({ value: s.data.map(numeric), name: s.name })) }],
    };
  }

  const isLine = type === "LINE" || type === "AREA";
  const seriesList = resolved.series.map((s, i) => ({
    name: s.name,
    type: isLine ? "line" : "bar",
    data: s.data,
    smooth: isLine,
    stack: resolved.stacked ? "total" : undefined,
    areaStyle: type === "AREA" ? { opacity: 0.18 } : undefined,
    itemStyle: { color: ECHARTS_PALETTE[i % ECHARTS_PALETTE.length] },
    ...(i === 0 && resolved.referenceLine
      ? { markLine: { silent: true, symbol: "none", label: { formatter: resolved.referenceLine.name, position: "insideEndTop" }, lineStyle: { color: "#ef4444", type: "dashed" }, data: [{ yAxis: resolved.referenceLine.value }] } }
      : {}),
  }));

  return {
    color: ECHARTS_PALETTE,
    tooltip: { trigger: "axis" },
    legend: { bottom: 0, itemGap: 24 },
    grid: { left: 56, right: 24, top: 24, bottom: 56, containLabel: true },
    // Every category is labelled: long names (budget lines, activities) wrap instead of being skipped.
    xAxis: { type: "category", data: resolved.categories, axisLabel: { interval: 0, width: resolved.categories.length > 6 ? 70 : 110, overflow: "break", rotate: resolved.categories.length > 8 ? 30 : 0 } },
    yAxis: { type: "value", axisLabel: { formatter: unit ? (unit === "%" ? "{value}%" : `{value} ${unit}`) : "{value}" } },
    series: seriesList,
  };
}

/**
 * Pure builder for an ECharts option from indicator rows. The same function runs in the browser (interactive panel) and in the
 * Node export renderer (SSR -> PNG), so the finalized chart is pixel-identical to what the user approved.
 */
export function buildChartOption(input: ChartIndicatorInput[], config: ChartConfig): Record<string, unknown> {
  return optionFromResolved(resolveChartData(input, config), config.type);
}
