/**
 * User-chosen chart configuration attached to a report section. The chart is
 * rendered interactively in the report workspace (client) and identically as a
 * static image in exported DOCX/PDF/Excel. `type` selects the chart family;
 * `dataBinding` selects which chartable dataset the section visualises.
 */

export type ChartType = "BAR" | "LINE" | "PIE" | "AREA" | "RADAR" | "GAUGE";

export const CHART_TYPES: ChartType[] = ["BAR", "LINE", "PIE", "AREA", "RADAR", "GAUGE"];

export type ChartDataBinding =
  // Baseline vs target vs period achievement for every indicator.
  | "INDICATOR_COMPARISON"
  // Period achievement per indicator (simple value chart).
  | "INDICATOR_ACHIEVEMENT"
  // Share of indicators by status (verified / needs review / draft).
  | "STATUS_DISTRIBUTION";

export const CHART_DATA_BINDINGS: ChartDataBinding[] = [
  "INDICATOR_COMPARISON",
  "INDICATOR_ACHIEVEMENT",
  "STATUS_DISTRIBUTION",
];

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
  dataBinding: ChartDataBinding;
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

const BINDING_TITLES: Record<ChartDataBinding, string> = {
  INDICATOR_COMPARISON: "Indicator baseline vs target vs achievement",
  INDICATOR_ACHIEVEMENT: "Indicator achievement",
  STATUS_DISTRIBUTION: "Indicator verification status",
};

/**
 * Pure, deterministic chart data builder. No I/O and no LLM: given the period
 * indicator rows it emits ECharts-ready series. Numeric strings are parsed
 * defensively; non-numeric values become `null` so the chart can skip or
 * annotate them.
 */
export function resolveChartData(input: ChartIndicatorInput[], config: ChartConfig): ResolvedChartData {
  const categories = input.map((i) => i.code || i.name || "—");
  const parse = (value: string | undefined): number | null => {
    if (value === undefined || value === null || value.trim() === "") return null;
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : null;
  };

  const base: ResolvedChartData = {
    type: config.type,
    dataBinding: config.dataBinding,
    categories,
    series: [],
    unit: input.find((i) => i.unit)?.unit,
    title: BINDING_TITLES[config.dataBinding],
  };

  switch (config.dataBinding) {
    case "INDICATOR_COMPARISON":
      base.series = [
        { name: "Baseline", data: input.map((i) => parse(i.baseline)) },
        { name: "Target", data: input.map((i) => parse(i.target)) },
        { name: "Achievement", data: input.map((i) => parse(i.achievement)) },
      ];
      break;
    case "INDICATOR_ACHIEVEMENT":
      base.series = [
        { name: "Achievement", data: input.map((i) => parse(i.achievement)) },
        { name: "Target", data: input.map((i) => parse(i.target)) },
      ];
      break;
    case "STATUS_DISTRIBUTION":
      base.categories = [];
      base.series = [];
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
      break;
    default:
      base.series = [];
  }

  return base;
}

// ---------------------------------------------------------------------------
// ECharts option builder (shared by the interactive client and SSR->PNG export)
// ---------------------------------------------------------------------------

const ECHARTS_PALETTE = ["#2f7be8", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444", "#06b6d4"];

/**
 * Pure builder for an ECharts option object. The same function runs in the
 * browser (interactive panel) and in the Node export renderer (SSR -> PNG), so
 * the finalized chart is pixel-identical to what the user approved.
 */
export function buildChartOption(
  input: ChartIndicatorInput[],
  config: ChartConfig,
): Record<string, unknown> {
  const resolved = resolveChartData(input, config);
  const unit = input.find((i) => i.unit)?.unit ?? "";
  const parse = (value: string | undefined): number | null => {
    if (value === undefined || value === null || value.trim() === "") return null;
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : null;
  };

  if (config.type === "PIE") {
    const data = resolved.categories.map((name, i) => ({ name, value: (resolved.series[i]?.data[0] as number) ?? 0 }));
    return {
      color: ECHARTS_PALETTE,
      tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
      legend: { type: "scroll", bottom: 0 },
      series: [{ type: "pie", radius: ["32%", "68%"], avoidLabelOverlap: true, itemStyle: { borderRadius: 6, borderColor: "#fff", borderWidth: 2 }, label: { formatter: "{b}" }, data }],
    };
  }

  if (config.type === "GAUGE") {
    const value = parse(input[0]?.achievement) ?? 0;
    return {
      series: [{
        type: "gauge",
        progress: { show: true, width: 14 },
        axisLine: { lineStyle: { width: 14 } },
        axisLabel: { fontSize: 10 },
        detail: { valueAnimation: true, formatter: unit ? `{value} ${unit}` : "{value}" },
        data: [{ value }],
      }],
    };
  }

  if (config.type === "RADAR") {
    const radarValues = resolved.series[0]?.data ?? [];
    return {
      tooltip: {},
      legend: { bottom: 0 },
      radar: { indicator: resolved.categories.map((name) => ({ name, max: 100 })), radius: "65%" },
      series: [{ type: "radar", areaStyle: { opacity: 0.15 }, data: [{ value: radarValues, name: "Achievement" }] }],
    };
  }

  const isLine = config.type === "LINE" || config.type === "AREA";
  const seriesList = resolved.series.map((s, i) => ({
    name: s.name,
    type: isLine ? "line" : "bar",
    data: s.data,
    smooth: isLine,
    areaStyle: config.type === "AREA" ? { opacity: 0.18 } : undefined,
    itemStyle: { color: ECHARTS_PALETTE[i % ECHARTS_PALETTE.length] },
  }));

  return {
    color: ECHARTS_PALETTE,
    tooltip: { trigger: "axis" },
    legend: { bottom: 0 },
    grid: { left: 56, right: 24, top: 24, bottom: 56, containLabel: true },
    xAxis: { type: "category", data: resolved.categories, axisLabel: { rotate: resolved.categories.length > 6 ? 30 : 0 } },
    yAxis: { type: "value", axisLabel: { formatter: unit ? `{value} ${unit}` : "{value}" } },
    series: seriesList,
  };
}
