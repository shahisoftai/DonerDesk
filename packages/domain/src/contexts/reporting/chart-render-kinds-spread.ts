import type { Norm } from "./chart-render.js";
import type { KindBuilt, RenderKit } from "./chart-render-kinds.js";
import type { DatasetResult } from "./dataset-query.js";
import type { ChartSpecV2 } from "./chart-spec-v2.js";

/**
 * Phase 48.11 kinds that show how recorded figures are spread or composed: beeswarm, violin, ridgeline and marimekko. Each is drawn only
 * from recorded figures. A violin is a smoothed estimate and says so (the dots on it are the recorded values); a ridgeline gives every
 * ridge the same scale so heights compare; a marimekko reads the recorded split of one indicator by group and never adds a group that was
 * not recorded. A gap is a gap, never 0, and two units never share an axis (the caller's unit check runs first).
 */
const present = (xs: ReadonlyArray<number | null>): number[] => xs.filter((x): x is number => x !== null);
const sum = (xs: ReadonlyArray<number>): number => xs.reduce((t, x) => t + x, 0);
const mean = (xs: ReadonlyArray<number>): number => sum(xs) / xs.length;
const sd = (xs: ReadonlyArray<number>): number => Math.sqrt(sum(xs.map((x) => (x - mean(xs)) ** 2)) / Math.max(1, xs.length - 1));

/** A smoothing width for a kernel estimate (Silverman's rule); never zero, so a set of identical values still draws. */
export function bandwidth(values: ReadonlyArray<number>): number {
  const spread = sd(values);
  const h = 1.06 * spread * values.length ** -0.2;
  return h > 0 ? h : Math.max(Math.abs(mean(values)) * 0.05, 1);
}

/** The estimated density of `values` at each of `at` (a Gaussian kernel). The curve integrates to about 1 over the real line. */
export function kernelDensity(values: ReadonlyArray<number>, at: ReadonlyArray<number>, h = bandwidth(values)): number[] {
  const k = 1 / (values.length * h * Math.sqrt(2 * Math.PI));
  return at.map((x) => k * sum(values.map((v) => Math.exp(-0.5 * ((x - v) / h) ** 2))));
}

const MIN_BEESWARM = 3;
const MIN_VIOLIN = 5;

/** Every recorded value of each indicator as a dot, grouped side by side; dots that would sit on each other are spread sideways, never moved up or down. */
export function beeswarm(_spec: ChartSpecV2, norm: Norm, kit: RenderKit): KindBuilt {
  const groups = norm.series.map((s, i) => ({ name: s.name, i, dots: s.data.map((v, c) => ({ v, label: norm.categories[c] ?? "" })).filter((d): d is { v: number; label: string } => d.v !== null) }));
  const usable = groups.filter((g) => g.dots.length >= MIN_BEESWARM);
  if (usable.length === 0) return `A beeswarm shows every recorded value, so it needs at least ${MIN_BEESWARM} periods with a figure for an indicator.`;
  const all = usable.flatMap((g) => g.dots.map((d) => d.v));
  const lo = Math.min(...all), hi = Math.max(...all);
  const resolution = (hi - lo) / 40 || 1;
  const series = usable.map((g, gi) => {
    const buckets = new Map<number, number>();
    const sorted = [...g.dots].sort((a, b) => a.v - b.v);
    const placed = sorted.map((d) => {
      const bucket = Math.floor((d.v - lo) / resolution);
      const k = buckets.get(bucket) ?? 0;
      buckets.set(bucket, k + 1);
      return { d, bucket, k };
    });
    return {
      type: "scatter", name: g.name, symbolSize: 9, itemStyle: { color: kit.palette[g.i % kit.palette.length] },
      data: placed.map(({ d, bucket, k }) => ({ name: d.label, value: [Number((gi + (k % 2 === 0 ? 1 : -1) * Math.ceil(k / 2) * 0.09 * (buckets.get(bucket)! > 1 ? 1 : 0)).toFixed(3)), d.v] })),
    };
  });
  const left = groups.length - usable.length;
  return {
    option: {
      ...kit.base(true), tooltip: { trigger: "item", formatter: "{b}: {@[1]}" }, grid: { left: 56, right: 24, top: 64, bottom: 56, containLabel: true },
      xAxis: { type: "value", min: -0.6, max: usable.length - 0.4, show: false }, yAxis: { type: "value", scale: true }, series,
    },
    notes: ["Each dot is one period's recorded figure. Dots at about the same height are spread sideways so none hides another; the sideways position means nothing.", ...(left > 0 ? [`${left} ${left === 1 ? "indicator has" : "indicators have"} fewer than ${MIN_BEESWARM} recorded periods and ${left === 1 ? "is" : "are"} left out.`] : [])],
  };
}

/** A smoothed estimate of how each indicator's recorded period figures are spread; the dots are the recorded figures themselves. */
export function violin(_spec: ChartSpecV2, norm: Norm, kit: RenderKit): KindBuilt {
  const groups = norm.series.map((s, i) => ({ name: s.name, i, values: present(s.data), labels: s.data.map((v, c) => (v === null ? null : norm.categories[c] ?? "")).filter((x): x is string => x !== null) }));
  const usable = groups.filter((g) => g.values.length >= MIN_VIOLIN);
  if (usable.length === 0) return `A violin estimates a spread, so it needs at least ${MIN_VIOLIN} periods with a figure for an indicator. Use a beeswarm for fewer.`;
  const all = usable.flatMap((g) => g.values);
  const lo = Math.min(...all), hi = Math.max(...all);
  const pad = (hi - lo) * 0.1 || 1;
  const grid: unknown[] = [], xAxis: unknown[] = [], yAxis: unknown[] = [], titles: unknown[] = [], series: unknown[] = [];
  const steps = Array.from({ length: 49 }, (_, i) => lo - pad + ((hi - lo + 2 * pad) * i) / 48);
  const curves = usable.map((g) => kernelDensity(g.values, steps));
  const widest = Math.max(...curves.flat()) || 1;
  const height = 78 / usable.length;
  usable.forEach((g, gi) => {
    const color = kit.palette[g.i % kit.palette.length];
    grid.push({ left: 96, right: 24, top: `${14 + gi * height}%`, height: `${height - 3}%` });
    xAxis.push({ type: "value", gridIndex: gi, min: lo - pad, max: hi + pad, show: gi === usable.length - 1, scale: true });
    yAxis.push({ type: "value", gridIndex: gi, min: -0.55, max: 0.55, show: false });
    titles.push({ text: g.name, left: 8, top: `${14 + gi * height + height / 2 - 2}%`, textStyle: { fontSize: 12, fontWeight: "normal" } });
    const half = (sign: 1 | -1) => ({ type: "line", name: g.name, xAxisIndex: gi, yAxisIndex: gi, symbol: "none", silent: true, lineStyle: { color, width: 1 }, areaStyle: { color, opacity: 0.45 }, data: steps.map((x, k) => [Number(x.toFixed(4)), Number((sign * (curves[gi]![k]! / widest) * 0.5).toFixed(4))]) });
    series.push(half(1), half(-1));
    series.push({ type: "scatter", name: g.name, xAxisIndex: gi, yAxisIndex: gi, symbolSize: 6, itemStyle: { color, opacity: 0.85 }, data: g.values.map((v, k) => ({ name: g.labels[k] ?? "", value: [v, 0] })) });
  });
  const base = kit.base(false) as { title?: unknown };
  const baseTitles = Array.isArray(base.title) ? base.title : base.title ? [base.title] : [];
  const left = groups.length - usable.length;
  return {
    option: { ...base, title: [...baseTitles, ...titles], tooltip: { trigger: "item", formatter: "{b}: {@[0]}" }, grid, xAxis, yAxis, series },
    notes: ["The shaded shape is a smoothed estimate of how the recorded figures are spread (wider means more periods near that value); the dots are the recorded figures. It is an estimate, not a recorded value.", ...(left > 0 ? [`${left} ${left === 1 ? "indicator has" : "indicators have"} fewer than ${MIN_VIOLIN} recorded periods and ${left === 1 ? "is" : "are"} left out.`] : [])],
  };
}

const MAX_RIDGES = 8;
/** Several indicators over the same periods as overlapping filled lines on one shared scale, so heights compare and a gap leaves a break. */
export function ridgeline(_spec: ChartSpecV2, norm: Norm, kit: RenderKit): KindBuilt {
  const n = norm.series.length;
  if (n < 2) return "A ridgeline stacks several indicators: choose at least two of the same kind.";
  if (n > MAX_RIDGES) return `A ridgeline shows at most ${MAX_RIDGES} indicators; choose fewer.`;
  if (norm.categories.length < 3) return "A ridgeline needs at least three periods.";
  const all = norm.series.flatMap((s) => present(s.data));
  if (all.length === 0) return "Nothing is recorded for these indicators in these periods.";
  const max = Math.max(...all);
  const step = 70 / n;
  const grid: unknown[] = [], xAxis: unknown[] = [], yAxis: unknown[] = [], titles: unknown[] = [], series: unknown[] = [];
  norm.series.forEach((s, i) => {
    const color = kit.palette[i % kit.palette.length];
    grid.push({ left: 96, right: 24, top: `${12 + i * step}%`, height: `${step * 2.1}%` });
    xAxis.push({ type: "category", gridIndex: i, data: norm.categories, boundaryGap: false, show: i === n - 1 });
    yAxis.push({ type: "value", gridIndex: i, min: 0, max, show: false });
    titles.push({ text: s.name, left: 8, top: `${12 + i * step + step * 1.1}%`, textStyle: { fontSize: 12, fontWeight: "normal" } });
    series.push({ type: "line", name: s.name, xAxisIndex: i, yAxisIndex: i, symbol: "none", connectNulls: false, lineStyle: { color, width: 1.5 }, areaStyle: { color, opacity: 0.85 }, data: s.data });
  });
  const base = kit.base(false) as { title?: unknown };
  const baseTitles = Array.isArray(base.title) ? base.title : base.title ? [base.title] : [];
  return {
    option: { ...base, title: [...baseTitles, ...titles], tooltip: { trigger: "axis" }, grid, xAxis, yAxis, series },
    notes: ["Every ridge uses the same scale, so a taller ridge is a larger figure. A period with nothing recorded leaves a break in the line, never a drop to zero."],
  };
}

const MARIMEKKO_GAP = 1.5;
const numberOf = (text: string): number | null => { const n = Number.parseFloat(text.replace(/,/g, "")); return Number.isFinite(n) ? n : null; };

/** One indicator's recorded split by group (such as sex), one column per period: a column's width is the period's recorded total and its segments are the groups. */
export function marimekko(_spec: ChartSpecV2, norm: Norm, data: DatasetResult, kit: RenderKit): KindBuilt {
  if (norm.series.length !== 1 || !norm.series[0]!.indicator) return "A marimekko draws one indicator's split: choose exactly one indicator.";
  const s = norm.series[0]!;
  if (s.isRate) return "A marimekko adds groups up, so it cannot show a rate (a percentage or ratio).";
  const indicatorId = s.indicator!.id;
  const withSplit = data.points.filter((p) => p.indicatorId === indicatorId && p.breakdown !== undefined && p.breakdown.length > 0);
  if (withSplit.length === 0) return "No split by group is recorded for this indicator in these periods. Record a breakdown (for example by sex) to draw it.";
  const perDimension = new Map<string, Set<string>>();
  for (const p of withSplit) for (const b of p.breakdown!) {
    const key = b.dimension;
    const periods = perDimension.get(key) ?? new Set<string>();
    periods.add(p.periodId);
    perDimension.set(key, periods);
  }
  const dimension = [...perDimension.entries()].sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))[0]![0];
  const columns = withSplit.map((p) => {
    const parts = p.breakdown!.filter((b) => b.dimension === dimension).map((b) => ({ category: b.category, value: numberOf(b.value) })).filter((b): b is { category: string; value: number } => b.value !== null && b.value > 0);
    return { label: p.periodLabel, parts, total: sum(parts.map((x) => x.value)) };
  }).filter((c) => c.parts.length > 0 && c.total > 0);
  if (columns.length < 2) return "A marimekko needs the split recorded in at least two periods.";
  const categories = [...new Set(columns.flatMap((c) => c.parts.map((x) => x.category)))];
  if (categories.length < 2) return "A marimekko needs at least two groups.";
  const room = 100 - 8 - MARIMEKKO_GAP * (columns.length - 1);
  const grand = sum(columns.map((c) => c.total));
  const grid: unknown[] = [], xAxis: unknown[] = [], yAxis: unknown[] = [], titles: unknown[] = [], series: unknown[] = [];
  let at = 4;
  columns.forEach((c, ci) => {
    const w = (c.total / grand) * room;
    grid.push({ left: `${at}%`, width: `${w}%`, top: 64, bottom: 44 });
    xAxis.push({ type: "category", gridIndex: ci, data: [c.label], show: false });
    yAxis.push({ type: "value", gridIndex: ci, min: 0, max: 100, show: false });
    titles.push({ text: `${c.label}\n${kit.fmt(c.total)}`, left: `${at + w / 2}%`, bottom: 0, textAlign: "center", textStyle: { fontSize: 11, fontWeight: "normal" } });
    categories.forEach((cat, k) => {
      const part = c.parts.find((x) => x.category === cat);
      series.push({ type: "bar", name: cat, stack: `col${ci}`, xAxisIndex: ci, yAxisIndex: ci, barWidth: "100%", itemStyle: { color: kit.palette[k % kit.palette.length], borderColor: "#fff", borderWidth: 1 }, data: part ? [{ value: Number(((part.value / c.total) * 100).toFixed(2)), label: { show: true, formatter: `${kit.fmt(part.value)}`, color: "#fff", fontSize: 11 } }] : [null] });
    });
    at += w + MARIMEKKO_GAP;
  });
  const base = kit.base(true) as { title?: unknown };
  const baseTitles = Array.isArray(base.title) ? base.title : base.title ? [base.title] : [];
  // Periods that have a figure but no usable split are named, not silently left out.
  const dropped = data.points.filter((p) => p.indicatorId === indicatorId && p.value !== null).length - columns.length;
  return {
    option: { ...base, title: [...baseTitles, ...titles], tooltip: { trigger: "item", formatter: "{a}: {c}%" }, grid, xAxis, yAxis, series, noTable: true },
    notes: [`The split shown is "${dimension}". A column's width is the total of the groups recorded for that period (which can differ from the headline figure), and a segment's height is that group's share of it.`, ...(dropped > 0 ? [`${dropped} ${dropped === 1 ? "period has" : "periods have"} no usable split for this dimension and ${dropped === 1 ? "is" : "are"} not drawn.`] : [])],
  };
}
