import { CHART_PALETTES, DATA_CHART_TEMPLATES, HEX_COLOUR } from "./data-charts.js";
import { CHART_KINDS, TEMPLATE_SHAPE, type ChartAnnotation, type ChartKind, type ChartShape, type ChartSize, type ChartSpecV2, type NumberFormat, type SeriesStyle } from "./chart-spec-v2.js";
import { planCounts } from "./plan-counts.js";
import type { DatasetBudgetLine, DatasetDay, DatasetFinanceRow, DatasetPlace, DatasetPlanRow, DatasetPoint, DatasetQuery, DatasetResult, DatasetSource } from "./dataset-query.js";
import { hasShareOfTarget, type DataSheetIndicator } from "./data-sheet.js";

/**
 * The Chart Studio's builder (Phase 34.1): a `ChartSpecV2` and the dataset it asks for in, a drawn chart out. Pure and deterministic,
 * so the browser and any later export draw the same picture. Every honesty rule lives here or in `validateChartSpec`: a missing
 * value is a gap (null), never 0; a rate is never added up, stacked or sliced; bars start at zero; different units never share one
 * raw axis; a distribution of too few values is refused rather than drawn.
 */

export interface ChartProvenance { points: number; unverified: number }

export type ChartBuild =
  | { ok: true; render: "ECHART"; option: Record<string, unknown>; title: string; notes: string[]; alt: string; aspect: number; provenance: ChartProvenance; /** Map names the screen must register before drawing (the bundled geography). */ maps?: string[]; /** Names to match against the map's regions: the screen says which it could not find. */ regionNames?: string[] }
  | { ok: true; render: "TABLE"; columns: string[]; rows: Array<Array<string | null>>; title: string; notes: string[]; alt: string; aspect: number; provenance: ChartProvenance }
  | { ok: false; reason: string };

/** Width over height of the drawing area for each size preset. */
export const CHART_ASPECT: Record<ChartSize, number> = { SQUARE: 1, WIDE: 2, TALL: 0.6, A4_HALF: 1.42, A4_FULL: 0.7, SLIDE: 1.78 };

type Num = number | null;
/** `ix` is the series' place before any were hidden: styling choices are keyed by it. */
interface NSeries { name: string; data: Num[]; unit: string; isRate: boolean; indicator?: DataSheetIndicator; ix?: number }
interface Norm {
  shape: ChartShape;
  categories: string[];
  series: NSeries[];
  /** TARGET_TRIPLE: the one indicator and its three figures. */
  triple?: { indicator: DataSheetIndicator; baseline: Num; target: Num; latest: Num; latestLabel: string };
  /** LATEST: the indicator behind each category, in order (a sunburst groups them by logframe level). */
  items?: DataSheetIndicator[];
  measure: ChartSpecV2["dataset"]["measure"];
}

const num = (v: string | undefined): Num => {
  if (v === undefined || v.trim() === "") return null;
  const n = Number.parseFloat(v.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};
const unitOf = (i: DataSheetIndicator): string => (i.unit ?? "").trim();
const sum = (xs: ReadonlyArray<number>): number => xs.reduce((a, b) => a + b, 0);
const values = (xs: ReadonlyArray<Num>): number[] => xs.filter((x): x is number => x !== null);

/** A number as the chart's number format asks: full (thousands separators), compact (1.2K), or one or two decimals. */
export function formatChartNumber(n: number, format: NumberFormat = "FULL"): string {
  switch (format) {
    case "COMPACT": return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
    case "DECIMAL_1": return n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    case "DECIMAL_2": return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    default: return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
}

const MEASURE_LABEL = { PERIOD: "Period value", CUMULATIVE: "Cumulative", PERCENT_OF_TARGET: "% of target" } as const;

function pointsOf(data: DatasetResult, indicatorId: string): DatasetPoint[] {
  return data.points.filter((p) => p.indicatorId === indicatorId);
}

function normalise(shape: ChartShape, spec: ChartSpecV2, data: DatasetResult): Norm | string {
  const measure = spec.dataset.measure;
  if (data.indicators.length === 0 && shape !== "STATUS" && shape !== "FINANCE") return "Choose at least one indicator that is in this project's data.";
  switch (shape) {
    case "SERIES_BY_PERIOD": {
      const series = data.indicators.map((i): NSeries => ({ name: i.code, unit: measure === "PERCENT_OF_TARGET" ? "%" : unitOf(i), isRate: i.isRate, indicator: i, data: data.periods.map((p) => data.points.find((x) => x.indicatorId === i.id && x.periodId === p.id)?.value ?? null) }));
      return { shape, categories: data.periods.map((p) => p.label), series, measure };
    }
    case "LATEST": {
      const rows = data.indicators.map((i) => {
        const pts = pointsOf(data, i.id);
        const latest = [...pts].reverse().find((p) => p.value !== null) ?? null;
        return { i, value: latest?.value ?? null, label: latest?.periodLabel ?? "" };
      });
      const unit = measure === "PERCENT_OF_TARGET" ? "%" : [...new Set(rows.map((r) => unitOf(r.i)))].length === 1 ? unitOf(rows[0]!.i) : "";
      return { shape, categories: rows.map((r) => r.i.code), items: rows.map((r) => r.i), series: [{ name: MEASURE_LABEL[measure], unit, isRate: rows.some((r) => r.i.isRate), data: rows.map((r) => r.value) }], measure };
    }
    case "TARGET_TRIPLE": {
      const indicator = data.indicators[0]!;
      const pts = pointsOf(data, indicator.id);
      const latestPoint = [...pts].reverse().find((p) => p.value !== null) ?? null;
      return {
        shape, measure, categories: ["Baseline", "Target", latestPoint ? `Result (${latestPoint.periodLabel})` : "Result"],
        series: [{ name: indicator.code, unit: unitOf(indicator), isRate: indicator.isRate, indicator, data: [num(indicator.baseline), num(indicator.target), latestPoint?.value ?? null] }],
        triple: { indicator, baseline: num(indicator.baseline), target: num(indicator.target), latest: latestPoint?.value ?? null, latestLabel: latestPoint?.periodLabel ?? "" },
      };
    }
    case "PLACES": {
      const places = data.places;
      if (places === undefined) return "This data is not available here (it needs the places list and permission to see the project).";
      if (places.length === 0) return "No places have a recorded value for this indicator at this level. Record values by location, or choose another level.";
      const indicator = data.indicators[0]!;
      const measureLabel = "Value by place";
      return { shape, measure, categories: places.map((p) => p.name), items: undefined, series: [{ name: measureLabel, unit: unitOf(indicator), isRate: indicator.isRate, indicator, data: places.map((p) => p.value) }] };
    }
    case "FINANCE": {
      if (data.finance.length === 0) return "No finance figures are recorded for this project in these periods (finance data may be switched off for it).";
      const currencies = [...new Set(data.finance.map((f) => f.currency))];
      if (currencies.length > 1) return `Finance is recorded in more than one currency (${currencies.join(", ")}), so it cannot share one axis.`;
      const byPeriod = new Map(data.finance.map((f) => [f.periodId, f]));
      const col = (get: (f: DatasetFinanceRow) => Num): Num[] => data.periods.map((p) => { const f = byPeriod.get(p.id); return f ? get(f) : null; });
      const currency = currencies[0] ?? "";
      const series: NSeries[] = spec.dataset.template === "FINANCE_BURN_RATE"
        ? [{ name: "Share of the budget spent", unit: "%", isRate: false, data: col((f) => f.burnRatePercent) }]
        : [{ name: "Budget", unit: currency, isRate: false, data: col((f) => f.budget) }, { name: "Expenditure to date", unit: currency, isRate: false, data: col((f) => f.expenditure) }];
      return { shape, categories: data.periods.map((p) => p.label), series, measure };
    }
    case "STATUS": {
      const counts = new Map<string, number>();
      for (const p of data.points) {
        if (p.status === "") continue;
        const key = p.status.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return { shape, measure, categories: [...counts.keys()], series: [{ name: "Recorded values", unit: "", isRate: false, data: [...counts.values()] }] };
    }
    default:
      // Plan, daily and budget shapes do not have a series by period; they are drawn by `buildExtraShape` before this is reached.
      return "This data cannot be drawn as a series.";
  }
}

/* ---------- series styling choices, sorting and top N ---------- */

const styleOf = (spec: ChartSpecV2, index: number): SeriesStyle | undefined => spec.series?.find((s) => s.index === index);

function applySeriesChoices(norm: Norm, spec: ChartSpecV2): Norm {
  const series = norm.series
    .map((s, i): NSeries => ({ ...s, ix: i, name: styleOf(spec, i)?.label?.trim() || s.name }))
    .filter((s) => styleOf(spec, s.ix!)?.hidden !== true);
  return { ...norm, series };
}

/** LATEST and STATUS: sort the categories and keep the largest N (the rest become "Other" only when adding them up means something). */
function sortAndLimit(norm: Norm, spec: ChartSpecV2, additive: boolean, notes: string[]): Norm {
  if (norm.shape !== "LATEST" && norm.shape !== "STATUS") return norm;
  const sort = spec.dataset.sort ?? "NONE";
  const top = spec.dataset.topN;
  if (sort === "NONE" && top === undefined) return norm;
  const s0 = norm.series[0]!;
  let rows = norm.categories.map((c, i) => ({ c, v: s0.data[i] ?? null }));
  if (sort === "ASC") rows.sort((a, b) => (a.v ?? Infinity) - (b.v ?? Infinity));
  else if (sort === "DESC" || (sort === "NONE" && top !== undefined)) rows.sort((a, b) => (b.v ?? -Infinity) - (a.v ?? -Infinity));
  else if (sort === "LABEL") rows.sort((a, b) => a.c.localeCompare(b.c, undefined, { numeric: true }));
  if (top !== undefined && rows.length > top) {
    const rest = rows.slice(top);
    rows = rows.slice(0, top);
    if (additive && !s0.isRate) {
      const restSum = sum(values(rest.map((r) => r.v)));
      rows.push({ c: "Other", v: rest.some((r) => r.v !== null) ? restSum : null });
      notes.push(`The ${rest.length} smallest are added together as "Other".`);
    } else notes.push(`Showing the largest ${top}; ${rest.length} more are left out.`);
  }
  return { ...norm, categories: rows.map((r) => r.c), series: [{ ...s0, data: rows.map((r) => r.v) }] };
}

/* ---------- option pieces ---------- */

function palette(spec: ChartSpecV2): string[] {
  const own = (spec.colors ?? []).filter((c) => HEX_COLOUR.test(c));
  if (own.length > 0) return own;
  return (CHART_PALETTES.find((p) => p.id === spec.paletteId) ?? CHART_PALETTES[0]!).colors;
}

const seriesColor = (spec: ChartSpecV2, i: number): string | undefined => {
  const c = styleOf(spec, i)?.color;
  return c && HEX_COLOUR.test(c) ? c : undefined;
};

function labelOf(spec: ChartSpecV2, unit: string, pie = false): Record<string, unknown> {
  const l = spec.labels;
  if (!l?.show) return { show: false };
  const fmt = l.numberFormat ?? "FULL";
  const fn = (p: { value?: unknown; name?: string; percent?: number }): string => {
    const raw = Array.isArray(p.value) ? p.value[p.value.length - 1] : p.value;
    const v = typeof raw === "number" ? `${formatChartNumber(raw, fmt)}${unit === "%" ? "%" : ""}` : "";
    switch (l.format) {
      case "NAME": return p.name ?? "";
      case "NAME_VALUE": return `${p.name ?? ""}: ${v}`;
      case "PERCENT": return pie && p.percent !== undefined ? `${Math.round(p.percent * 10) / 10}%` : v;
      default: return v;
    }
  };
  return { show: true, formatter: fn };
}

function legendOf(spec: ChartSpecV2, show: boolean): Record<string, unknown> {
  const pos = spec.legend?.position ?? "BOTTOM";
  if (!show || pos === "HIDDEN") return { show: false };
  const side = pos === "TOP" ? { top: 4 } : pos === "BOTTOM" ? { bottom: 0 } : pos === "LEFT" ? { left: 0, orient: "vertical", top: "middle" } : { right: 0, orient: "vertical", top: "middle" };
  return { show: true, type: "scroll", ...side };
}

function annotationsOf(spec: ChartSpecV2, horizontal: boolean, extra: ChartAnnotation[]): { markLine?: Record<string, unknown>; markArea?: Record<string, unknown>; graphic: Array<Record<string, unknown>> } {
  const all = [...extra, ...(spec.annotations ?? [])];
  const lines = all.filter((a): a is Extract<ChartAnnotation, { type: "LINE" }> => a.type === "LINE");
  const bands = all.filter((a): a is Extract<ChartAnnotation, { type: "BAND" }> => a.type === "BAND");
  const notes = all.filter((a): a is Extract<ChartAnnotation, { type: "NOTE" }> => a.type === "NOTE");
  const axis = horizontal ? "xAxis" : "yAxis";
  return {
    ...(lines.length > 0 ? { markLine: { symbol: "none", silent: true, data: lines.map((l) => ({ [axis]: l.value, name: l.text ?? "", lineStyle: { type: "dashed", ...(l.color && HEX_COLOUR.test(l.color) ? { color: l.color } : {}) }, label: { formatter: l.text ?? "{c}" } })) } } : {}),
    ...(bands.length > 0 ? { markArea: { silent: true, data: bands.map((b) => [{ [axis]: b.from, name: b.text ?? "", itemStyle: { color: b.color && HEX_COLOUR.test(b.color) ? `${b.color}33` : "rgba(120,120,120,0.12)" } }, { [axis]: b.to }]) } } : {}),
    graphic: notes.map((n, i) => ({ type: "text", left: 12, top: 36 + i * 18, silent: true, style: { text: n.text, fill: n.color && HEX_COLOUR.test(n.color) ? n.color : "#555", fontSize: 12 } })),
  };
}

function axisOf(a: NonNullable<ChartSpecV2["axes"]>["y"] | undefined, base: Record<string, unknown>): Record<string, unknown> {
  return {
    ...base,
    ...(a?.title ? { name: a.title, nameLocation: "middle", nameGap: 38 } : {}),
    ...(a?.min !== undefined ? { min: a.min } : {}),
    ...(a?.max !== undefined ? { max: a.max } : {}),
    ...(a?.scale === "LOG" ? { type: "log" } : {}),
    ...(a?.reversed ? { inverse: true } : {}),
    ...(a?.gridlines === false ? { splitLine: { show: false } } : {}),
  };
}

function baseOption(spec: ChartSpecV2, title: string, color: string[], legendShow: boolean, annot: ReturnType<typeof annotationsOf>): Record<string, unknown> {
  return {
    aria: { enabled: true },
    color,
    title: { text: title, ...(spec.subtitle ? { subtext: spec.subtitle } : {}), left: "center", textStyle: { fontSize: 14 } },
    tooltip: { trigger: "item" },
    legend: legendOf(spec, legendShow),
    ...(annot.graphic.length > 0 ? { graphic: annot.graphic } : {}),
  };
}

/* ---------- builders ---------- */

type Built = { option: Record<string, unknown>; notes?: string[] } | string;

const CARTESIAN_TYPE: Partial<Record<ChartKind, "bar" | "line">> = {
  BAR: "bar", BAR_HORIZONTAL: "bar", BAR_GROUPED: "bar", BAR_STACKED: "bar", BAR_STACKED_100: "bar", LOLLIPOP: "bar", BULLET: "bar", BAR_LINE_COMBO: "bar",
  LINE: "line", STEP_LINE: "line", AREA: "line", AREA_STACKED: "line", SPARKLINE: "line", DOT_PLOT: "line",
};

function cartesian(spec: ChartSpecV2, norm: Norm, title: string, ref: ChartAnnotation[]): Built {
  const kind = spec.kind;
  const horizontal = kind === "BAR_HORIZONTAL";
  const stacked = kind === "BAR_STACKED" || kind === "BAR_STACKED_100" || kind === "AREA_STACKED";
  const hundred = kind === "BAR_STACKED_100";
  const notes: string[] = [];
  let series = norm.series;
  let unit = series[0]?.unit ?? "";
  if (hundred) {
    series = series.map((s) => ({ ...s, data: s.data.map((v, ci) => { const total = sum(values(norm.series.map((x) => x.data[ci] ?? null))); return v === null || total <= 0 ? null : Math.round((v / total) * 1000) / 10; }) }));
    unit = "%";
    notes.push("Each bar shows shares of that period's total.");
  }
  const secondary = spec.series?.some((s) => s.axis === "SECONDARY") ?? false;
  const units = [...new Set(series.map((s) => s.unit))];
  const color = palette(spec);
  const lollipop = kind === "LOLLIPOP";
  const dot = kind === "DOT_PLOT";
  const out: Array<Record<string, unknown>> = [];
  const annot = annotationsOf(spec, horizontal, ref);
  series.forEach((s, i) => {
    const ix = s.ix ?? i;
    const st = styleOf(spec, ix);
    const asKind = st?.kind ?? (kind === "BAR_LINE_COMBO" && i > 0 ? "LINE" : kind);
    const base: "bar" | "line" = CARTESIAN_TYPE[asKind] ?? "line";
    const c = seriesColor(spec, ix);
    const common = {
      name: s.name, data: s.data, ...(st?.axis === "SECONDARY" ? { yAxisIndex: 1 } : {}),
      ...(c ? { itemStyle: { color: c }, lineStyle: { color: c } } : {}),
      label: st?.showLabels === undefined ? labelOf(spec, s.unit) : st.showLabels ? labelOf({ ...spec, labels: { show: true, format: spec.labels?.format ?? "VALUE", numberFormat: spec.labels?.numberFormat } }, s.unit) : { show: false },
      emphasis: { focus: "series" },
    } as Record<string, unknown>;
    const first = i === 0 ? { ...(annot.markLine ? { markLine: annot.markLine } : {}), ...(annot.markArea ? { markArea: annot.markArea } : {}) } : {};
    if (base === "bar") {
      if (lollipop) {
        out.push({ type: "bar", ...common, barWidth: 3, ...first });
        out.push({ type: "line", name: s.name, data: s.data, showSymbol: true, symbolSize: 12, lineStyle: { width: 0 }, tooltip: { show: false }, ...(c ? { itemStyle: { color: c } } : {}), silent: true });
      } else out.push({ type: "bar", ...common, ...(stacked ? { stack: "total" } : {}), ...first });
    } else {
      out.push({
        type: "line", ...common, ...(kind === "STEP_LINE" ? { step: "end" } : {}), ...(dot ? { lineStyle: { width: 0 }, symbolSize: 11 } : {}), ...(asKind === "AREA" || asKind === "AREA_STACKED" ? { areaStyle: { opacity: 0.25 } } : {}),
        ...(stacked ? { stack: "total" } : {}), ...(kind === "SPARKLINE" ? { smooth: true, showSymbol: false } : { showSymbol: s.data.filter((v) => v !== null).length < 40 }),
        connectNulls: false, ...first,
      });
    }
  });
  const hasNegative = values(series.flatMap((s) => s.data)).some((v) => v < 0);
  const zero = CHART_KINDS[kind].startsAtZero && !hasNegative;
  const catAxis = (axisSpec: unknown) => axisOf(axisSpec as never, { type: "category", data: norm.categories, boundaryGap: !CARTESIAN_TYPE[kind] || CARTESIAN_TYPE[kind] === "bar" });
  const valAxis = (a: unknown, name?: string) => axisOf(a as never, { type: "value", ...(zero ? { min: 0 } : {}), ...(name ? { name, nameLocation: "middle", nameGap: 42 } : {}), ...(hundred ? { max: 100 } : {}), axisLabel: { formatter: (v: number) => `${formatChartNumber(v, spec.labels?.numberFormat ?? "FULL")}${unit === "%" ? "%" : ""}` } });
  const yTitle = spec.axes?.y?.title ?? undefined;
  const valueAxes = secondary
    ? [valAxis(spec.axes?.y, yTitle ?? (units[0] ? units[0] : undefined)), { ...valAxis(spec.axes?.y2, spec.axes?.y2?.title), splitLine: { show: false } }]
    : valAxis(spec.axes?.y, yTitle ?? (unit ? unit : undefined));
  const sparkline = kind === "SPARKLINE";
  const option: Record<string, unknown> = {
    ...baseOption(spec, title, color, series.length > 1 && !sparkline, annot),
    tooltip: { trigger: "axis" },
    grid: sparkline ? { left: 4, right: 4, top: 28, bottom: 4 } : { left: 56, right: secondary ? 56 : 24, top: 56, bottom: series.length > 1 ? 52 : 40, containLabel: true },
    ...(sparkline ? { xAxis: { type: "category", show: false, data: norm.categories }, yAxis: { type: "value", show: false } } : horizontal ? { xAxis: valueAxes, yAxis: catAxis(spec.axes?.x) } : { xAxis: catAxis(spec.axes?.x), yAxis: valueAxes }),
    series: out,
  };
  return { option, notes };
}

function slope(spec: ChartSpecV2, norm: Norm, title: string): Built {
  const first = 0, last = norm.categories.length - 1;
  if (last < 1) return "A slope chart compares two periods: choose a range of at least two.";
  const color = palette(spec);
  return {
    option: {
      ...baseOption(spec, title, color, true, annotationsOf(spec, false, [])), tooltip: { trigger: "axis" },
      grid: { left: 80, right: 120, top: 56, bottom: 40 },
      xAxis: { type: "category", data: [norm.categories[first], norm.categories[last]], boundaryGap: false },
      yAxis: axisOf(spec.axes?.y, { type: "value" }),
      series: norm.series.map((s, i) => { const col = seriesColor(spec, s.ix ?? i); return { type: "line", name: s.name, data: [s.data[first] ?? null, s.data[last] ?? null], symbolSize: 9, label: { show: true, position: i % 2 ? "left" : "right", formatter: (p: { value: unknown; seriesName: string }) => (typeof p.value === "number" ? `${p.seriesName} ${formatChartNumber(p.value, spec.labels?.numberFormat ?? "FULL")}` : "") }, ...(col ? { itemStyle: { color: col }, lineStyle: { color: col } } : {}) }; }),
    },
  };
}

function partToWhole(spec: ChartSpecV2, norm: Norm, title: string): Built {
  const s = norm.series[0]!;
  const data = norm.categories.map((c, i) => ({ name: c, value: s.data[i] ?? null })).filter((d): d is { name: string; value: number } => d.value !== null);
  if (data.some((d) => d.value < 0)) return "Parts of a whole cannot be negative.";
  const positive = data.filter((d) => d.value > 0);
  if (positive.length === 0) return "Nothing above zero to show.";
  const color = palette(spec);
  const common = baseOption(spec, title, color, spec.kind !== "TREEMAP", annotationsOf(spec, false, []));
  if (spec.kind === "TREEMAP") return { option: { ...common, series: [{ type: "treemap", roam: false, breadcrumb: { show: false }, label: { show: true, formatter: "{b}\n{c}" }, data: positive }] } };
  return { option: { ...common, series: [{ type: "pie", radius: spec.kind === "DONUT" ? ["45%", "70%"] : "68%", data: positive, label: labelOf({ ...spec, labels: spec.labels ?? { show: true, format: "NAME_VALUE" } }, s.unit, true), avoidLabelOverlap: true }] } };
}

/** 100 squares shared between the parts by the largest-remainder method, so the squares always add to 100 and no part is lost or invented. */
export function waffleCells(values: ReadonlyArray<number>): number[] {
  const total = sum(values);
  if (total <= 0) return values.map(() => 0);
  const exact = values.map((v) => (v / total) * 100);
  const cells = exact.map(Math.floor);
  let left = 100 - sum(cells);
  [...exact.keys()].sort((a, b) => (exact[b]! - cells[b]!) - (exact[a]! - cells[a]!) || a - b).forEach((i) => { if (left > 0) { cells[i]! += 1; left -= 1; } });
  return cells;
}

function waffle(spec: ChartSpecV2, norm: Norm, title: string): Built {
  const s = norm.series[0]!;
  const parts = norm.categories.map((c, i) => ({ name: c, value: s.data[i] ?? null })).filter((d): d is { name: string; value: number } => d.value !== null && d.value > 0);
  if (parts.length < 2) return "A waffle needs at least two parts above zero.";
  const color = palette(spec);
  const cells = waffleCells(parts.map((p) => p.value));
  const owner: number[] = [];
  cells.forEach((n, i) => { for (let k = 0; k < n; k += 1) owner.push(i); });
  const data = owner.map((o, idx) => [idx % 10, 9 - Math.floor(idx / 10), o]);
  const total = sum(parts.map((p) => p.value));
  return {
    option: {
      ...baseOption(spec, title, color, false, annotationsOf(spec, false, [])),
      grid: { left: 24, right: 24, top: 64, bottom: 64 },
      xAxis: { type: "category", show: false, data: Array.from({ length: 10 }, (_, i) => i) }, yAxis: { type: "category", show: false, data: Array.from({ length: 10 }, (_, i) => i) },
      visualMap: { type: "piecewise", orient: "horizontal", left: "center", bottom: 0, itemGap: 12, pieces: parts.map((p, i) => ({ value: i, label: `${p.name} (${Math.round((cells[i]! ) )}%)`, color: color[i % color.length] })) },
      series: [{ type: "heatmap", data, itemStyle: { borderColor: "#fff", borderWidth: 3 }, emphasis: { itemStyle: { borderColor: "#333" } }, tooltip: { formatter: (p: { data: number[] }) => `${parts[p.data[2]!]!.name}: ${formatChartNumber(parts[p.data[2]!]!.value)} of ${formatChartNumber(total)}` } }],
    },
    notes: ["Each square is 1% of the total."],
  };
}

function sunburst(spec: ChartSpecV2, norm: Norm, title: string): Built {
  const s = norm.series[0]!;
  const groups = new Map<string, Array<{ name: string; value: number }>>();
  norm.items?.forEach((i, idx) => {
    const v = s.data[idx] ?? null;
    if (v === null || v <= 0) return;
    const level = (i.level ?? "Other").toLowerCase().replace(/^./, (c) => c.toUpperCase());
    groups.set(level, [...(groups.get(level) ?? []), { name: i.code, value: v }]);
  });
  const total = [...groups.values()].flat().length;
  if (total < 3) return "A sunburst needs at least three indicators with a value above zero.";
  if (groups.size < 2) return "A sunburst shows indicators grouped by logframe level, and these are all on one level. Choose a bar or treemap instead.";
  return { option: { ...baseOption(spec, title, palette(spec), false, annotationsOf(spec, false, [])), series: [{ type: "sunburst", radius: [0, "88%"], sort: undefined, label: { rotate: "radial" }, data: [...groups].map(([name, children]) => ({ name, children })) }] }, notes: ["Indicators are grouped by their logframe level."] };
}

function funnel(spec: ChartSpecV2, norm: Norm, title: string): Built {
  const s = norm.series[0]!;
  const steps = norm.categories.map((c, i) => ({ name: c, value: s.data[i] ?? null })).filter((d): d is { name: string; value: number } => d.value !== null);
  if (steps.length < 2) return "A funnel needs at least two steps with a value.";
  for (let i = 1; i < steps.length; i += 1) if (steps[i]!.value > steps[i - 1]!.value) return `A funnel's steps shrink: ${steps[i]!.name} is larger than ${steps[i - 1]!.name}. Put the steps in order, or choose another chart.`;
  return { option: { ...baseOption(spec, title, palette(spec), false, annotationsOf(spec, false, [])), series: [{ type: "funnel", sort: "none", left: "10%", width: "80%", label: { show: true, formatter: "{b}: {c}" }, data: steps }] } };
}

function radar(spec: ChartSpecV2, norm: Norm, title: string): Built {
  const s = norm.series[0]!;
  const used = norm.categories.map((c, i) => ({ c, v: s.data[i] ?? null })).filter((r): r is { c: string; v: number } => r.v !== null);
  if (used.length < 3) return "A radar needs at least three indicators with a value.";
  const max = norm.measure === "PERCENT_OF_TARGET" ? Math.max(100, ...used.map((r) => r.v)) : Math.max(...used.map((r) => r.v)) * 1.1;
  return { option: { ...baseOption(spec, title, palette(spec), false, annotationsOf(spec, false, [])), radar: { indicator: used.map((r) => ({ name: r.c, max })) }, series: [{ type: "radar", areaStyle: { opacity: 0.2 }, data: [{ value: used.map((r) => r.v), name: s.name }] }] } };
}

function waterfall(spec: ChartSpecV2, norm: Norm, title: string): Built {
  const steps: Array<{ name: string; delta: number; total: boolean }> = [];
  if (norm.shape === "TARGET_TRIPLE" && norm.triple) {
    const { baseline, latest } = norm.triple;
    if (baseline === null || latest === null) return "A waterfall needs a baseline and a result.";
    steps.push({ name: "Baseline", delta: baseline, total: true }, { name: "Change", delta: latest - baseline, total: false }, { name: "Result", delta: latest, total: true });
  } else {
    const s = norm.series[0]!;
    norm.categories.forEach((c, i) => { const v = s.data[i] ?? null; if (v !== null) steps.push({ name: c, delta: v, total: false }); });
    if (steps.length < 2) return "A waterfall needs at least two periods with a value.";
    steps.push({ name: "Total", delta: sum(steps.map((x) => x.delta)), total: true });
  }
  const base: Num[] = [], up: Num[] = [], down: Num[] = [], total: Num[] = [];
  let running = 0;
  for (const st of steps) {
    if (st.total) { base.push(0); up.push(null); down.push(null); total.push(st.delta); running = st.delta; continue; }
    const next = running + st.delta;
    if (next < 0 || running < 0) return "This waterfall would go below zero; it cannot be drawn honestly.";
    if (st.delta >= 0) { base.push(running); up.push(st.delta); down.push(null); } else { base.push(next); up.push(null); down.push(-st.delta); }
    total.push(null);
    running = next;
  }
  const names = steps.map((x) => x.name);
  return {
    option: {
      ...baseOption(spec, title, palette(spec), true, annotationsOf(spec, false, [])), tooltip: { trigger: "axis" }, grid: { left: 56, right: 24, top: 56, bottom: 44, containLabel: true },
      xAxis: axisOf(spec.axes?.x, { type: "category", data: names }), yAxis: axisOf(spec.axes?.y, { type: "value", min: 0 }),
      series: [
        { type: "bar", name: "base", stack: "w", itemStyle: { color: "transparent" }, tooltip: { show: false }, data: base },
        { type: "bar", name: "Increase", stack: "w", data: up, itemStyle: { color: "#10b981" } },
        { type: "bar", name: "Decrease", stack: "w", data: down, itemStyle: { color: "#ef4444" } },
        { type: "bar", name: "Total", stack: "w", data: total, itemStyle: { color: palette(spec)[0] } },
      ],
    },
  };
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  return sorted[lo]! + (sorted[Math.min(lo + 1, sorted.length - 1)]! - sorted[lo]!) * (pos - lo);
}

function distribution(spec: ChartSpecV2, norm: Norm, title: string, minPoints: number): Built {
  if (spec.kind === "HISTOGRAM") {
    const all = values(norm.series.flatMap((s) => s.data));
    if (all.length < minPoints) return `A histogram needs at least ${minPoints} values; there are ${all.length}.`;
    const bins = Math.max(3, Math.min(20, Math.ceil(Math.log2(all.length) + 1)));
    const lo = Math.min(...all), hi = Math.max(...all);
    const width = (hi - lo) / bins || 1;
    const counts = new Array<number>(bins).fill(0);
    for (const v of all) counts[Math.min(bins - 1, Math.floor((v - lo) / width))]! += 1;
    const labels = counts.map((_, i) => `${formatChartNumber(lo + i * width, "COMPACT")}–${formatChartNumber(lo + (i + 1) * width, "COMPACT")}`);
    return { option: { ...baseOption(spec, title, palette(spec), false, annotationsOf(spec, false, [])), tooltip: { trigger: "axis" }, grid: { left: 56, right: 24, top: 56, bottom: 56, containLabel: true }, xAxis: axisOf(spec.axes?.x, { type: "category", data: labels }), yAxis: axisOf(spec.axes?.y, { type: "value", min: 0, name: spec.axes?.y?.title ?? "Number of values", nameLocation: "middle", nameGap: 36 }), series: [{ type: "bar", barCategoryGap: "5%", data: counts }] }, notes: [`${all.length} values in ${bins} groups.`] };
  }
  const usable = norm.series.map((s) => ({ s, v: values(s.data).sort((a, b) => a - b) })).filter((x) => x.v.length >= minPoints);
  if (usable.length === 0) return `A box plot needs at least ${minPoints} values for an indicator.`;
  return { option: { ...baseOption(spec, title, palette(spec), false, annotationsOf(spec, false, [])), tooltip: { trigger: "item" }, grid: { left: 56, right: 24, top: 56, bottom: 40, containLabel: true }, xAxis: axisOf(spec.axes?.x, { type: "category", data: usable.map((x) => x.s.name) }), yAxis: axisOf(spec.axes?.y, { type: "value" }), series: [{ type: "boxplot", data: usable.map((x) => [x.v[0]!, quantile(x.v, 0.25), quantile(x.v, 0.5), quantile(x.v, 0.75), x.v[x.v.length - 1]!]) }] }, notes: usable.length < norm.series.length ? ["Indicators with too few values are left out."] : [] };
}

function relationship(spec: ChartSpecV2, norm: Norm, title: string, minPoints: number): Built {
  const [xs, ys, zs] = norm.series;
  if (!xs || !ys) return "A scatter needs two indicators: one for each axis.";
  const pts: Array<[number, number, number, string]> = [];
  norm.categories.forEach((c, i) => { const x = xs.data[i] ?? null, y = ys.data[i] ?? null; if (x !== null && y !== null) pts.push([x, y, zs?.data[i] ?? 1, c]); });
  if (pts.length < minPoints) return `Only ${pts.length} periods have a value for both indicators; at least ${minPoints} are needed.`;
  const bubble = spec.kind === "BUBBLE" && zs !== undefined;
  const maxZ = Math.max(...pts.map((p) => p[2]), 1);
  return {
    option: {
      ...baseOption(spec, title, palette(spec), false, annotationsOf(spec, false, [])), tooltip: { trigger: "item", formatter: (p: { data: [number, number, number, string] }) => `${p.data[3]}<br/>${xs.name}: ${formatChartNumber(p.data[0])}<br/>${ys.name}: ${formatChartNumber(p.data[1])}` },
      grid: { left: 64, right: 24, top: 56, bottom: 56, containLabel: true },
      xAxis: axisOf(spec.axes?.x, { type: "value", name: spec.axes?.x?.title ?? `${xs.name}${xs.unit ? ` (${xs.unit})` : ""}`, nameLocation: "middle", nameGap: 30 }),
      yAxis: axisOf(spec.axes?.y, { type: "value", name: spec.axes?.y?.title ?? `${ys.name}${ys.unit ? ` (${ys.unit})` : ""}`, nameLocation: "middle", nameGap: 44 }),
      series: [{ type: "scatter", data: pts, symbolSize: bubble ? (d: number[]) => 8 + 40 * Math.sqrt((d[2] ?? 1) / maxZ) : 11 }],
    },
    notes: bubble ? [`Bubble size shows ${zs!.name}.`] : [],
  };
}

function heatmap(spec: ChartSpecV2, norm: Norm, title: string): Built {
  const data: Array<[number, number, number]> = [];
  norm.series.forEach((s, yi) => s.data.forEach((v, xi) => { if (v !== null) data.push([xi, yi, v]); }));
  if (data.length === 0) return "No values are recorded to colour.";
  const vs = data.map((d) => d[2]);
  return {
    option: {
      ...baseOption(spec, title, palette(spec), false, annotationsOf(spec, false, [])), tooltip: { position: "top" }, grid: { left: 90, right: 24, top: 56, bottom: 64, containLabel: true },
      xAxis: { type: "category", data: norm.categories, splitArea: { show: true } }, yAxis: { type: "category", data: norm.series.map((s) => s.name), splitArea: { show: true } },
      visualMap: { min: Math.min(...vs), max: Math.max(...vs), calculable: true, orient: "horizontal", left: "center", bottom: 0, inRange: { color: ["#e0f2fe", palette(spec)[0]!] } },
      series: [{ type: "heatmap", data, label: { show: spec.labels?.show ?? false } }],
    },
    notes: ["Blank cells have no value recorded."],
  };
}

function progress(spec: ChartSpecV2, norm: Norm, title: string): Built {
  const t = norm.triple;
  if (!t) return "This chart needs one indicator with a target.";
  if (t.indicator.isRate || !hasShareOfTarget(t.indicator)) return "A rate has no share of its target, so it cannot be shown as progress towards it.";
  if (t.target === null || t.target <= 0) return "This chart needs a numeric target above zero.";
  if (t.latest === null) return "No result is recorded yet.";
  const pct = Math.round((t.latest / t.target) * 1000) / 10;
  const color = palette(spec);
  const fmt = spec.labels?.numberFormat ?? "FULL";
  const caption = `${formatChartNumber(t.latest, fmt)} of ${formatChartNumber(t.target, fmt)} ${unitOf(t.indicator)}`.trim();
  const common = baseOption(spec, title, color, false, annotationsOf(spec, false, []));
  switch (spec.kind) {
    case "GAUGE":
      return { option: { ...common, series: [{ type: "gauge", min: 0, max: Math.max(100, pct), progress: { show: true, width: 14 }, axisLine: { lineStyle: { width: 14 } }, detail: { valueAnimation: false, formatter: "{value}%", fontSize: 24 }, data: [{ value: pct, name: caption }] }] } };
    case "PROGRESS_RING":
      return { option: { ...common, series: [{ type: "pie", radius: ["62%", "80%"], silent: true, label: { show: false }, data: [{ name: "Done", value: Math.min(pct, 100) }, { name: "Remaining", value: Math.max(0, 100 - pct), itemStyle: { color: "rgba(150,150,150,0.25)" } }] }], graphic: [{ type: "text", left: "center", top: "42%", style: { text: `${pct}%`, fontSize: 28, fontWeight: "bold", fill: "#333", textAlign: "center" } }, { type: "text", left: "center", top: "58%", style: { text: caption, fontSize: 12, fill: "#666", textAlign: "center" } }] } };
    case "PROGRESS_BAR":
      return { option: { ...common, grid: { left: 24, right: 24, top: 70, bottom: 30 }, xAxis: { type: "value", min: 0, max: Math.max(100, pct), axisLabel: { formatter: "{value}%" } }, yAxis: { type: "category", data: [t.indicator.code], show: false }, series: [{ type: "bar", data: [100], barWidth: 22, silent: true, itemStyle: { color: "rgba(150,150,150,0.25)" }, barGap: "-100%" }, { type: "bar", data: [pct], barWidth: 22, label: { show: true, position: "right", formatter: `${pct}%` } }] }, notes: [caption] };
    case "KPI_NUMBER":
      return { option: { ...common, graphic: [{ type: "text", left: "center", top: "32%", style: { text: formatChartNumber(t.latest, fmt), fontSize: 44, fontWeight: "bold", fill: "#222", textAlign: "center" } }, { type: "text", left: "center", top: "60%", style: { text: `${pct}% of the target (${formatChartNumber(t.target, fmt)})`, fontSize: 14, fill: "#555", textAlign: "center" } }] } };
    default: {
      // BULLET: the result over a band that reaches the target.
      return { option: { ...common, grid: { left: 24, right: 40, top: 70, bottom: 30 }, xAxis: { type: "value", min: 0, max: Math.max(t.target, t.latest) * 1.1 }, yAxis: { type: "category", data: [t.indicator.code], show: false }, series: [{ type: "bar", data: [t.target], barWidth: 30, silent: true, itemStyle: { color: "rgba(150,150,150,0.25)" }, barGap: "-100%" }, { type: "bar", data: [t.latest], barWidth: 12, label: { show: true, position: "right", formatter: formatChartNumber(t.latest, fmt) }, markLine: { symbol: "none", silent: true, data: [{ xAxis: t.target, label: { formatter: "Target" } }] } }] }, notes: [caption] };
    }
  }
}

function table(spec: ChartSpecV2, norm: Norm, data: DatasetResult): { columns: string[]; rows: Array<Array<string | null>> } | string {
  const fmt = spec.labels?.numberFormat ?? "FULL";
  const cell = (v: Num, unit: string): string => (v === null ? "Not measured" : `${formatChartNumber(v, fmt)}${unit === "%" ? "%" : ""}`);
  if (spec.kind === "SCORECARD_TABLE") {
    const s = norm.series[0]!;
    const columns = ["Code", "Indicator", "Baseline", "Target", MEASURE_LABEL[norm.measure], "% of target"];
    const rows = data.indicators.map((i, idx) => {
      const v = s.data[idx] ?? null;
      const target = num(i.target);
      const pct = v !== null && target !== null && target > 0 && hasShareOfTarget(i) && norm.measure !== "PERCENT_OF_TARGET" ? `${Math.round((v / target) * 1000) / 10}%` : "—";
      return [i.code, i.name, i.baseline || "—", i.target ? `${i.target}${unitOf(i) ? ` ${unitOf(i)}` : ""}` : "—", cell(v, norm.measure === "PERCENT_OF_TARGET" ? "%" : unitOf(i)), norm.measure === "PERCENT_OF_TARGET" ? cell(v, "%") : pct];
    });
    return { columns, rows };
  }
  if (norm.shape === "LATEST") return { columns: ["Code", "Indicator", MEASURE_LABEL[norm.measure]], rows: data.indicators.map((i, idx) => [i.code, i.name, cell(norm.series[0]!.data[idx] ?? null, norm.measure === "PERCENT_OF_TARGET" ? "%" : unitOf(i))]) };
  return { columns: ["Code", "Indicator", ...norm.categories], rows: norm.series.map((s) => [s.indicator?.code ?? s.name, s.indicator?.name ?? "", ...s.data.map((v) => cell(v, s.unit))]) };
}

/* ---------- plan, daily and budget charts (data that is not in the sheet) ---------- */

const DAY_MS = 86_400_000;
const dayNumber = (iso: string): number => Math.floor(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / DAY_MS);
const dayLabel = (n: number): string => new Date(n * DAY_MS).toISOString().slice(0, 10);

/** Signal colours for the timeline: the delivery signal, never a score. */
const SIGNAL_COLOUR: Record<string, string> = { LATE: "#ef4444", ON_TIME: "#10b981", DONE: "#6b7280", CANCELLED: "#d1d5db" };
export const MAX_GANTT_ROWS = 60;

function gantt(spec: ChartSpecV2, rows: ReadonlyArray<DatasetPlanRow>, title: string, notes: string[]): Built {
  const dated = rows.filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.start) && /^\d{4}-\d{2}-\d{2}$/.test(r.end) && r.end >= r.start);
  if (dated.length === 0) return "There are no planned activities with dates to put on a timeline.";
  const shown = dated.slice(0, MAX_GANTT_ROWS);
  if (dated.length > shown.length) notes.push(`Showing the first ${MAX_GANTT_ROWS} of ${dated.length} planned items, by start date.`);
  const first = Math.min(...shown.map((r) => dayNumber(r.start)));
  const names = shown.map((r) => r.title);
  const total = Math.max(...shown.map((r) => dayNumber(r.end))) - first + 1;
  return {
    option: {
      ...baseOption(spec, title, palette(spec), false, annotationsOf(spec, true, [])),
      tooltip: { trigger: "item", formatter: (p: { data: { name: string; start: string; end: string; label: string; reason?: string } }) => `${p.data.name}<br/>${p.data.start} to ${p.data.end}<br/>${p.data.label}` },
      grid: { left: 24, right: 32, top: 56, bottom: 40, containLabel: true },
      xAxis: axisOf(spec.axes?.x, { type: "value", min: 0, max: total, axisLabel: { formatter: (v: number) => dayLabel(first + v) } }),
      yAxis: { type: "category", inverse: true, data: names, axisLabel: { width: 180, overflow: "truncate" } },
      series: [
        { type: "bar", stack: "t", silent: true, itemStyle: { color: "transparent" }, data: shown.map((r) => dayNumber(r.start) - first) },
        { type: "bar", stack: "t", barMaxWidth: 18, data: shown.map((r) => ({ value: dayNumber(r.end) - dayNumber(r.start) + 1, name: r.title, start: r.start, end: r.end, label: r.signalLabel, itemStyle: { color: SIGNAL_COLOUR[r.signal] ?? "#6b7280" } })) },
      ],
    },
    notes: [...notes, "Colour shows whether each item is on time, late, done or cancelled."],
  };
}

const CALENDAR_DAYS_MAX = 366;

function calendar(spec: ChartSpecV2, days: ReadonlyArray<DatasetDay>, title: string, notes: string[]): Built {
  const valid = days.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date) && d.count > 0).sort((a, b) => a.date.localeCompare(b.date));
  if (valid.length < 2) return "A calendar needs completed activities on at least two days.";
  let shown = valid;
  const lastDay = dayNumber(valid[valid.length - 1]!.date);
  if (lastDay - dayNumber(valid[0]!.date) + 1 > CALENDAR_DAYS_MAX) {
    shown = valid.filter((d) => dayNumber(d.date) > lastDay - CALENDAR_DAYS_MAX);
    notes.push(`Showing the last year (${CALENDAR_DAYS_MAX} days) up to ${dayLabel(lastDay)}.`);
  }
  const from = shown[0]!.date, to = shown[shown.length - 1]!.date;
  const max = Math.max(...shown.map((d) => d.count));
  return {
    option: {
      ...baseOption(spec, title, palette(spec), false, annotationsOf(spec, false, [])),
      tooltip: { formatter: (p: { data: [string, number] }) => `${p.data[0]}: ${p.data[1]} completed` },
      visualMap: { min: 0, max, calculable: false, orient: "horizontal", left: "center", bottom: 0, inRange: { color: ["#e0f2fe", palette(spec)[0]!] } },
      calendar: { top: 64, left: 40, right: 24, cellSize: ["auto", 16], range: [from, to], itemStyle: { borderWidth: 1 }, yearLabel: { show: true } },
      series: [{ type: "heatmap", coordinateSystem: "calendar", data: shown.map((d) => [d.date, d.count]) }],
    },
    notes: [...notes, "A day with no completed activities is blank, not zero."],
  };
}

function sankey(spec: ChartSpecV2, lines: ReadonlyArray<DatasetBudgetLine>, title: string, notes: string[]): Built {
  const usable = lines.filter((l) => l.budgeted > 0);
  if (usable.length < 2) return "A budget flow needs at least two budget lines with an amount.";
  const currencies = [...new Set(usable.map((l) => l.currency))];
  if (currencies.length > 1) return `The budget is in more than one currency (${currencies.join(", ")}), so it cannot be drawn as one flow.`;
  const links = new Map<string, number>();
  const add = (a: string, b: string, v: number) => { if (v > 0) links.set(`${a}\u0000${b}`, (links.get(`${a}\u0000${b}`) ?? 0) + v); };
  let overspent = 0;
  for (const l of usable) {
    const donor = l.donor.trim() || "No donor named";
    add(`Donor: ${donor}`, `Category: ${l.category.trim() || "Uncategorised"}`, l.budgeted);
    const spent = Math.min(l.spent, l.budgeted);
    add(`Category: ${l.category.trim() || "Uncategorised"}`, "Spent", spent);
    add(`Category: ${l.category.trim() || "Uncategorised"}`, "Not spent yet", l.budgeted - spent);
    if (l.spent > l.budgeted) overspent += l.spent - l.budgeted;
  }
  if (overspent > 0) notes.push(`Spending above the budget (${formatChartNumber(overspent)} ${currencies[0] ?? ""}) is not drawn as flow.`);
  notes.push(`Amounts are in ${currencies[0] ?? "the project currency"}. Spent is what expenses are booked against each line.`);
  const data = [...links].map(([k, value]) => { const [source, target] = k.split("\u0000"); return { source, target, value }; });
  const names = [...new Set(data.flatMap((d) => [d.source!, d.target!]))].map((name) => ({ name }));
  return { option: { ...baseOption(spec, title, palette(spec), false, annotationsOf(spec, false, [])), tooltip: { trigger: "item" }, series: [{ type: "sankey", left: 24, right: 120, top: 56, bottom: 24, data: names, links: data, emphasis: { focus: "adjacency" }, lineStyle: { color: "gradient", curveness: 0.5 } }] }, notes };
}

/** The planned activities by status as a pie or donut: the same counts as the Activities number tiles (`planCounts`); a status with none is left out, not drawn as zero. */
function planStatusPie(spec: ChartSpecV2, rows: ReadonlyArray<DatasetPlanRow>, title: string, notes: string[]): Built {
  const c = planCounts(rows);
  const parts = [["Planned", c.planned], ["In progress", c.inProgress], ["Done", c.done]].filter(([, n]) => (n as number) > 0).map(([name, value]) => ({ name: name as string, value: value as number }));
  if (c.total === 0) return rows.some((r) => r.kind === "ACTIVITY") ? "Every planned activity is cancelled, so there is nothing to show." : "There are no planned activities yet.";
  if (c.cancelled > 0) notes.push(`${c.cancelled} cancelled ${c.cancelled === 1 ? "activity is" : "activities are"} not counted.`);
  if (c.late > 0) notes.push(`${c.late} of the ${c.total} ${c.late === 1 ? "is" : "are"} running late.`);
  const common = baseOption(spec, title, palette(spec), true, annotationsOf(spec, false, []));
  return { option: { ...common, series: [{ type: "pie", radius: spec.kind === "DONUT" ? ["45%", "70%"] : "68%", data: parts, label: labelOf({ ...spec, labels: spec.labels ?? { show: true, format: "NAME_VALUE" } }, "", true), avoidLabelOverlap: true }] }, notes };
}

/**
 * Spending by result as a pie or donut: approved expenses booked on budget lines, grouped by the result (logframe output) the line's activity contributes
 * to. An activity serves at most one output, so nothing is counted twice; lines of activities with no result are shown as one part, never hidden. One
 * currency only (amounts of different currencies do not add up).
 */
function spendByResultPie(spec: ChartSpecV2, lines: ReadonlyArray<DatasetBudgetLine>, title: string, notes: string[]): Built {
  const currencies = [...new Set(lines.map((l) => l.currency))];
  if (lines.length === 0) return "There are no budget lines yet.";
  if (lines.some((l) => l.resultUnknown)) return "The results these activities serve could not be read just now. Try again in a moment.";
  if (currencies.length > 1) return `The budget is in more than one currency (${currencies.join(", ")}), so spending cannot be shown as one whole.`;
  const UNLINKED = "Not linked to a result";
  const spent = new Map<string, number>();
  for (const l of lines) spent.set(l.result?.trim() || UNLINKED, (spent.get(l.result?.trim() || UNLINKED) ?? 0) + l.spent);
  const parts = [...spent].filter(([, v]) => v > 0).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 })).sort((a, b) => b.value - a.value);
  if (parts.length === 0) return "No spending has been approved against these budget lines yet.";
  const unlinked = spent.get(UNLINKED) ?? 0;
  if (unlinked > 0) notes.push(`${formatChartNumber(unlinked)} ${currencies[0] ?? ""} was spent on activities not linked to a result.`);
  notes.push(`Amounts are in ${currencies[0] ?? "the project currency"}. Spent is approved expenses only.`);
  const common = baseOption(spec, title, palette(spec), true, annotationsOf(spec, false, []));
  return { option: { ...common, series: [{ type: "pie", radius: spec.kind === "DONUT" ? ["45%", "70%"] : "68%", data: parts, label: labelOf({ ...spec, labels: spec.labels ?? { show: true, format: "NAME_VALUE" } }, currencies[0] ?? "", true), avoidLabelOverlap: true }] }, notes };
}

/** Plan, daily and budget charts read their own data (attached by the server), not the sheet's indicators. */
function buildExtraShape(spec: ChartSpecV2, data: DatasetResult, shape: ChartShape): ChartBuild {
  const info = DATA_CHART_TEMPLATES[spec.dataset.template];
  const isStatusPie = shape === "PLAN" && (spec.kind === "PIE" || spec.kind === "DONUT");
  const isSpendPie = shape === "BUDGET" && (spec.kind === "PIE" || spec.kind === "DONUT");
  const title = spec.title?.trim() || (isStatusPie ? "Activities by status" : isSpendPie ? "Spent by result" : info.label);
  const notes = [...data.notes];
  const rule = CHART_KINDS[spec.kind];
  const need = shape === "PLAN" ? data.plan : shape === "DAYS" ? data.activityDays : data.budget;
  if (need === undefined) return { ok: false, reason: "This data is not available here (it is not shown through a share link, and needs permission to see the plan or the budget)." };
  const built: Built = shape === "PLAN" ? (isStatusPie ? planStatusPie(spec, need as DatasetPlanRow[], title, notes) : gantt(spec, need as DatasetPlanRow[], title, notes)) : shape === "DAYS" ? calendar(spec, need as DatasetDay[], title, notes) : isSpendPie ? spendByResultPie(spec, need as DatasetBudgetLine[], title, notes) : sankey(spec, need as DatasetBudgetLine[], title, notes);
  if (typeof built === "string") return { ok: false, reason: built };
  const alt = spec.altText?.trim() || `${rule.label} chart: ${title}. ${need.length} ${shape === "PLAN" ? "planned items" : shape === "DAYS" ? "days with completed activities" : "budget lines"}.`;
  return { ok: true, render: "ECHART", option: { ...built.option, aria: { enabled: true, label: { description: alt } } }, title, notes: built.notes ?? notes, alt, aspect: CHART_ASPECT[spec.size ?? "WIDE"], provenance: { points: need.length, unverified: 0 } };
}

/* ---------- maps (drawn on the bundled geography) ---------- */

/** The name the screen registers the bundled world map under (the site map registers the same one). */
export const WORLD_MAP = "donordesk-world";

function graduatedSymbols(spec: ChartSpecV2, places: ReadonlyArray<DatasetPlace>, unit: string, title: string, notes: string[]): Built {
  const pinned = places.filter((p) => p.value !== null && p.value > 0 && p.latitude !== undefined && p.longitude !== undefined);
  const noPin = places.filter((p) => p.value !== null && (p.latitude === undefined || p.longitude === undefined));
  if (pinned.length < 2) return "Graduated symbols need at least two places with a value and a pin on the map. Pin places in the places list, or use a bar chart.";
  if (noPin.length > 0) notes.push(`${noPin.length} ${noPin.length === 1 ? "place has" : "places have"} a value but no pin, so ${noPin.length === 1 ? "it is" : "they are"} not on the map: ${noPin.slice(0, 5).map((p) => p.name).join(", ")}${noPin.length > 5 ? "…" : ""}.`);
  const max = Math.max(...pinned.map((p) => p.value!));
  return {
    option: {
      ...baseOption(spec, title, palette(spec), false, annotationsOf(spec, false, [])),
      tooltip: { trigger: "item", formatter: (p: { name: string; value: number[] }) => `${p.name}: ${formatChartNumber(p.value[2]!)}${unit ? ` ${unit}` : ""}` },
      geo: { map: WORLD_MAP, roam: true, silent: false, itemStyle: { areaColor: "#e7e5e4", borderColor: "#ffffff" }, emphasis: { itemStyle: { areaColor: "#d6d3d1" } }, ...fitTo(pinned) },
      series: [{ type: "scatter", coordinateSystem: "geo", data: pinned.map((p) => ({ name: p.name, value: [p.longitude!, p.latitude!, p.value!] })), symbolSize: (v: number[]) => 8 + 36 * Math.sqrt((v[2] ?? 0) / max), itemStyle: { color: palette(spec)[0], opacity: 0.7, borderColor: "#fff" }, emphasis: { scale: 1.2 } }],
    },
    notes: [...notes, "Symbol area shows the value; only places with a pin are drawn."],
  };
}

/** A view that holds the pins (centre and zoom), so a project in one country is not a speck on the world. */
function fitTo(points: ReadonlyArray<{ latitude?: number | undefined; longitude?: number | undefined }>): Record<string, unknown> {
  const lats = points.map((p) => p.latitude!), lons = points.map((p) => p.longitude!);
  const span = Math.max(Math.max(...lats) - Math.min(...lats), (Math.max(...lons) - Math.min(...lons)) / 2, 1);
  return { center: [(Math.max(...lons) + Math.min(...lons)) / 2, (Math.max(...lats) + Math.min(...lats)) / 2], zoom: Math.max(1, Math.min(14, 90 / (span * 1.6))) };
}

function choropleth(spec: ChartSpecV2, places: ReadonlyArray<DatasetPlace>, title: string, notes: string[]): Built {
  const countries = places.filter((p) => p.level === 0 && p.value !== null);
  if (countries.length < 2) return "A choropleth colours whole countries and needs at least two countries with a value (read at the country level). For places inside a country, use graduated symbols.";
  const values = countries.map((c) => c.value!);
  const [lo, hi] = [Math.min(...values), Math.max(...values)];
  notes.push("Countries are matched to the map by name; one the map does not know is listed below the chart.");
  return {
    option: {
      ...baseOption(spec, title, palette(spec), false, annotationsOf(spec, false, [])),
      tooltip: { trigger: "item", formatter: (p: { name: string; value: number }) => `${p.name}: ${Number.isFinite(p.value) ? formatChartNumber(p.value) : "no value"}` },
      visualMap: { min: lo, max: hi === lo ? lo + 1 : hi, calculable: true, orient: "horizontal", left: "center", bottom: 0, inRange: { color: ["#e0f2fe", palette(spec)[0]!] }, text: [formatChartNumber(hi), formatChartNumber(lo)] },
      series: [{ type: "map", map: WORLD_MAP, roam: true, data: countries.map((c) => ({ name: c.name, value: c.value })), itemStyle: { areaColor: "#e7e5e4", borderColor: "#ffffff" }, emphasis: { label: { show: false } } }],
    },
    notes: [...notes, "A country with no value recorded is grey, not zero."],
  };
}

function buildMapKind(spec: ChartSpecV2, data: DatasetResult): ChartBuild {
  const rule = CHART_KINDS[spec.kind];
  const places = data.places;
  if (places === undefined) return { ok: false, reason: "This data is not available here (it needs the places list and permission to see the project)." };
  const indicator = data.indicators[0];
  if (!indicator) return { ok: false, reason: "Choose an indicator." };
  if (rule.additiveOnly && indicator.isRate) return { ok: false, reason: `${rule.label} charts add values up, so they cannot show a rate (a percentage or ratio).` };
  const title = spec.title?.trim() || `${indicator.code} ${indicator.name} by place`;
  const notes = [...data.notes];
  const built = spec.kind === "CHOROPLETH" ? choropleth(spec, places, title, notes) : graduatedSymbols(spec, places, unitOf(indicator), title, notes);
  if (typeof built === "string") return { ok: false, reason: built };
  const alt = spec.altText?.trim() || `${rule.label}: ${title}. ${places.length} places at level ${spec.dataset.placeLevel ?? 1}.`;
  return {
    ok: true, render: "ECHART", option: { ...built.option, aria: { enabled: true, label: { description: alt } } }, title, notes: built.notes ?? notes, alt, aspect: CHART_ASPECT[spec.size ?? "WIDE"],
    provenance: { points: places.filter((p) => p.value !== null).length, unverified: data.provenance.unverified }, maps: [WORLD_MAP],
    ...(spec.kind === "CHOROPLETH" ? { regionNames: places.filter((p) => p.level === 0 && p.value !== null).map((p) => p.name) } : {}),
  };
}

/* ---------- the entry point ---------- */

/**
 * The dataset query a spec asks for. A chart that takes no indicators (the verification-status chart) is about every indicator the
 * project has, so the caller names them all; the rest ask for exactly the indicators the spec lists.
 */
export function datasetQueryFor(spec: ChartSpecV2, allIndicatorIds: ReadonlyArray<string>): DatasetQuery {
  const d = spec.dataset;
  const shape = TEMPLATE_SHAPE[d.template];
  const source: DatasetSource | undefined = shape === "PLAN" ? "PLAN" : shape === "DAYS" ? "ACTIVITY_DAYS" : shape === "BUDGET" ? "BUDGET" : shape === "PLACES" ? "PLACES" : undefined;
  return {
    ...(source ? { sources: [source] } : {}),
    ...(shape === "PLACES" ? { placeLevel: d.placeLevel ?? 1 } : {}),
    indicatorIds: shape === "STATUS" ? [...allIndicatorIds] : shape === "PLAN" || shape === "DAYS" || shape === "BUDGET" ? [] : [...d.indicatorIds],
    measure: d.measure,
    ...(d.fromPeriodId !== undefined ? { fromPeriodId: d.fromPeriodId } : {}),
    ...(d.toPeriodId !== undefined ? { toPeriodId: d.toPeriodId } : {}),
    includeDraft: d.includeDraft,
  };
}

function defaultTitle(spec: ChartSpecV2, norm: Norm): string {
  const measure = MEASURE_LABEL[norm.measure].toLowerCase();
  switch (norm.shape) {
    case "SERIES_BY_PERIOD": return norm.series.length === 1 ? `${norm.series[0]!.indicator?.code ?? ""} ${norm.series[0]!.indicator?.name ?? ""}`.trim() : `Indicators over time (${measure})`;
    case "LATEST": return `Latest ${measure} by indicator`;
    case "TARGET_TRIPLE": return `${norm.series[0]!.name} ${norm.series[0]!.indicator?.name ?? ""}: baseline, target and result`.trim();
    case "STATUS": return "Verification status of recorded values";
    case "FINANCE": return spec.dataset.template === "FINANCE_BURN_RATE" ? "Share of the budget spent" : "Budget and expenditure to date";
    case "PLACES": return `${norm.series[0]?.indicator?.code ?? ""} ${norm.series[0]?.indicator?.name ?? ""} by place`.trim();
    default: return DATA_CHART_TEMPLATES[spec.dataset.template].label;
  }
}

function describe(kind: ChartKind, norm: Norm, title: string): string {
  const rule = CHART_KINDS[kind];
  const all = values(norm.series.flatMap((s) => s.data));
  const range = all.length > 0 ? ` Values run from ${formatChartNumber(Math.min(...all))} to ${formatChartNumber(Math.max(...all))}.` : " No values are recorded.";
  return `${rule.label} chart: ${title}. ${norm.series.length} series over ${norm.categories.length} ${norm.shape === "SERIES_BY_PERIOD" ? "periods" : "items"}.${range}`;
}

/** Draws a chart. Refuses (with a plain sentence) rather than draw something that would mislead. */
export function buildChart(spec: ChartSpecV2, data: DatasetResult): ChartBuild {
  const rule = CHART_KINDS[spec.kind];
  if (!rule) return { ok: false, reason: "This chart type is not offered." };
  if (rule.status !== "BUILT") return { ok: false, reason: `${rule.label} charts are not available yet.` };
  const shape = TEMPLATE_SHAPE[spec.dataset.template];
  if (!shape) return { ok: false, reason: "Finance charts are drawn from the Data Center for now." };
  if (!rule.shapes.includes(shape)) return { ok: false, reason: `${rule.label} cannot be drawn from this data.` };

  if (shape === "PLAN" || shape === "DAYS" || shape === "BUDGET") return buildExtraShape(spec, data, shape);
  if (spec.kind === "CHOROPLETH" || spec.kind === "GRADUATED_SYMBOLS") return buildMapKind(spec, data);
  const base = normalise(shape, spec, data);
  if (typeof base === "string") return { ok: false, reason: base };
  const notes = [...data.notes];
  let norm = applySeriesChoices(base, spec);
  if (norm.series.length === 0) return { ok: false, reason: "Every series is hidden." };
  norm = sortAndLimit(norm, spec, rule.additiveOnly, notes);

  if (rule.additiveOnly && norm.series.some((s) => s.isRate)) return { ok: false, reason: `${rule.label} charts add values up, so they cannot show a rate (a percentage or ratio).` };
  const allValues = values(norm.series.flatMap((s) => s.data));
  // A waterfall's steps may go down; every other additive chart adds values up, so a negative one has no place in it.
  if (rule.additiveOnly && spec.kind !== "WATERFALL" && allValues.some((v) => v < 0)) return { ok: false, reason: `${rule.label} charts add values up, so they cannot show a negative value.` };
  if (rule.family !== "TABLE" && allValues.length === 0 && !(spec.kind === "KPI_NUMBER")) return { ok: false, reason: "No values are recorded for this chart yet." };
  if (rule.family !== "TABLE" && rule.minPoints > 1 && allValues.length < rule.minPoints && !["HISTOGRAM", "BOX_PLOT", "SCATTER", "BUBBLE"].includes(spec.kind)) return { ok: false, reason: `${rule.label} needs at least ${rule.minPoints} values; there ${allValues.length === 1 ? "is 1" : `are ${allValues.length}`}.` };
  const logAxis = spec.axes?.y?.scale === "LOG" || spec.axes?.x?.scale === "LOG";
  if (logAxis && allValues.some((v) => v <= 0)) return { ok: false, reason: "A logarithmic axis cannot show zero or negative values." };

  // Different units never share one raw axis.
  const units = [...new Set(norm.series.map((s) => s.unit))];
  const secondary = spec.series?.some((s) => s.axis === "SECONDARY") ?? false;
  const crossUnit = norm.shape === "SERIES_BY_PERIOD" && units.length > 1 && !["SCATTER", "BUBBLE", "BOX_PLOT", "SLOPE", "PIVOT_TABLE"].includes(spec.kind);
  if (crossUnit && !(secondary && units.length === 2 && CARTESIAN_TYPE[spec.kind])) return { ok: false, reason: `These indicators use different units (${units.map((u) => u || "no unit").join(", ")}). Show them as % of target, or put one on a second axis.` };
  if (norm.shape === "SERIES_BY_PERIOD" && (spec.kind === "HEATMAP") && units.length > 1) return { ok: false, reason: "A heatmap colours every cell on one scale, so the indicators must share a unit (or be shown as % of target)." };

  const title = spec.title?.trim() || defaultTitle(spec, norm);
  const provenance: ChartProvenance = { points: allValues.length, unverified: data.provenance.unverified };
  if (provenance.unverified > 0) notes.push(`${provenance.unverified} of ${data.provenance.points} plotted ${data.provenance.points === 1 ? "value is" : "values are"} not verified yet.`);
  if (shape === "FINANCE") {
    notes.push("Expenditure is to date: cumulative to the end of each period.");
    const unverifiedFinance = data.finance.filter((f) => !f.verified).length;
    if (unverifiedFinance > 0) notes.push(`${unverifiedFinance} of ${data.finance.length} ${data.finance.length === 1 ? "period's" : "periods'"} finance figures are not verified yet.`);
  }
  const aspect = CHART_ASPECT[spec.size ?? "WIDE"];
  const alt = spec.altText?.trim() || describe(spec.kind, norm, title);

  if (rule.family === "TABLE") {
    const t = table(spec, norm, data);
    if (typeof t === "string") return { ok: false, reason: t };
    return { ok: true, render: "TABLE", ...t, title, notes, alt, aspect, provenance };
  }

  // A target line only where it is comparable: a cumulative figure or a percentage.
  const ref: ChartAnnotation[] = [];
  const only = norm.series[0]?.indicator;
  if (spec.dataset.showTarget && norm.shape === "SERIES_BY_PERIOD" && norm.series.length === 1 && only) {
    if (norm.measure === "PERCENT_OF_TARGET") ref.push({ id: "auto-target", type: "LINE", value: 100, text: "Target (100%)" });
    else if (norm.measure === "CUMULATIVE" && num(only.target) !== null) ref.push({ id: "auto-target", type: "LINE", value: num(only.target)!, text: "Target" });
  }

  let built: Built;
  switch (spec.kind) {
    case "PIE": case "DONUT": case "TREEMAP": built = partToWhole(spec, norm, title); break;
    case "FUNNEL": built = funnel(spec, norm, title); break;
    case "WAFFLE": built = waffle(spec, norm, title); break;
    case "SUNBURST": built = sunburst(spec, norm, title); break;
    case "RADAR": built = radar(spec, norm, title); break;
    case "WATERFALL": built = waterfall(spec, norm, title); break;
    case "HISTOGRAM": case "BOX_PLOT": built = distribution(spec, norm, title, rule.minPoints); break;
    case "SCATTER": case "BUBBLE": built = relationship(spec, norm, title, rule.minPoints); break;
    case "HEATMAP": built = heatmap(spec, norm, title); break;
    case "SLOPE": built = slope(spec, norm, title); break;
    case "GAUGE": case "PROGRESS_RING": case "PROGRESS_BAR": case "KPI_NUMBER": built = progress(spec, norm, title); break;
    case "BULLET":
      built = norm.triple ? progress(spec, norm, title) : "A bullet chart needs one indicator with a target.";
      break;
    default: built = cartesian(spec, norm, title, ref);
  }
  if (typeof built === "string") return { ok: false, reason: built };
  // The text description is handed to the chart library as its own accessible label; left alone it writes a generic one over ours.
  const option = { ...built.option, aria: { enabled: true, label: { description: alt } } };
  return { ok: true, render: "ECHART", option, title, notes: [...notes, ...(built.notes ?? [])], alt, aspect, provenance };
}
