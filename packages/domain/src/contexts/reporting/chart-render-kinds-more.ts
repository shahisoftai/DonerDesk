import type { ChartSpecV2 } from "./chart-spec-v2.js";
import type { Norm } from "./chart-render.js";
import type { KindBuilt, RenderKit } from "./chart-render-kinds.js";
import { LIGHT_ROLES as R } from "./chart-theme-roles.js";

/**
 * Phase 48.11 chart kinds: dumbbell, diverging bar, thermometer, bump and connected scatter. Each draws only what is recorded:
 * a gap is a gap and is counted, a rate is never summed or ranked as if it were a count of the same thing, and a layout that needs
 * an invented figure (an interval, a projection, a made-up baseline) is refused with a sentence.
 */
const present = (xs: ReadonlyArray<number | null>): number[] => xs.filter((x): x is number => x !== null);

/** First and last recorded value of each indicator, joined by a line: how far each one moved between two periods that have a figure. */
export function dumbbell(_spec: ChartSpecV2, norm: Norm, kit: RenderKit): KindBuilt {
  const rows = norm.series.map((s) => {
    const idx = s.data.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0);
    return idx.length < 2 ? null : { name: s.name, from: s.data[idx[0]!]!, to: s.data[idx.at(-1)!]!, fromLabel: norm.categories[idx[0]!] ?? "", toLabel: norm.categories[idx.at(-1)!] ?? "" };
  });
  const usable = rows.filter((r): r is NonNullable<typeof r> => r !== null);
  if (usable.length === 0) return "A dumbbell needs at least one indicator with a figure in two different periods.";
  const left = rows.length - usable.length;
  return {
    option: {
      ...kit.base(true), tooltip: { trigger: "item" },
      grid: { left: 120, right: 40, top: 56, bottom: 40, containLabel: true },
      yAxis: { type: "category", data: usable.map((r) => r.name), inverse: true }, xAxis: { type: "value", scale: true },
      series: [
        { type: "bar", name: "span", stack: "dumbbell", silent: true, data: usable.map((r) => Math.min(r.from, r.to)), itemStyle: { color: "transparent" }, tooltip: { show: false } },
        { type: "bar", name: "change", stack: "dumbbell", barWidth: 3, data: usable.map((r) => Math.abs(r.to - r.from)), itemStyle: { color: R.muted }, tooltip: { show: false } },
        { type: "scatter", name: "first recorded", data: usable.map((r, i) => ({ value: [r.from, i], name: `${r.fromLabel}: ${kit.fmt(r.from)}` })), symbolSize: 12, itemStyle: { color: kit.palette[1] ?? R.muted } },
        { type: "scatter", name: "latest recorded", data: usable.map((r, i) => ({ value: [r.to, i], name: `${r.toLabel}: ${kit.fmt(r.to)}` })), symbolSize: 12, itemStyle: { color: kit.palette[0] } },
      ],
    },
    notes: ["Each line runs from the first to the latest period that has a figure; the periods are named when you point at a dot.", ...(left > 0 ? [`${left} ${left === 1 ? "indicator has" : "indicators have"} a figure in fewer than two periods and ${left === 1 ? "is" : "are"} left out.`] : [])],
  };
}

/** Signed values on a common zero line: gains one way, losses the other. Needs both signs, otherwise a plain bar says the same thing. */
export function divergingBar(_spec: ChartSpecV2, norm: Norm, kit: RenderKit): KindBuilt {
  const s = norm.series[0]!;
  const nums = present(s.data);
  if (nums.length < 2) return "A diverging bar needs at least two recorded values.";
  if (!nums.some((v) => v < 0) || !nums.some((v) => v > 0)) return "A diverging bar needs values on both sides of zero (for example a change). Use a bar when every value has the same sign.";
  return {
    option: {
      ...kit.base(false), tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { left: 110, right: 40, top: 56, bottom: 40, containLabel: true },
      yAxis: { type: "category", data: norm.categories, inverse: true, axisLine: { onZero: true } }, xAxis: { type: "value" },
      series: [{ type: "bar", data: s.data.map((v) => (v === null ? null : { value: v, itemStyle: { color: v < 0 ? R.negative : R.positive } })), label: { show: true, position: "right", formatter: "{c}" } }],
    },
    notes: ["Bars to the right of the line are above zero, to the left below zero; a value with nothing recorded has no bar."],
  };
}

/** One vertical bar filled toward the target, with the target marked. Only for one indicator that has a target; a rate has none. */
export function thermometer(_spec: ChartSpecV2, norm: Norm, kit: RenderKit): KindBuilt {
  const t = norm.triple;
  if (!t) return "A thermometer needs one indicator with a target.";
  if (t.latest === null) return "Nothing is recorded yet for this indicator, so the thermometer would be empty.";
  if (t.target === null || t.target <= 0) return "This indicator has no target to fill toward.";
  if (t.indicator.isRate || t.indicator.lowerIsBetter) return "A thermometer fills toward a target, which a rate or a lower-is-better indicator does not have.";
  const max = Math.max(t.target, t.latest) * 1.05;
  return {
    option: {
      ...kit.base(false), tooltip: { trigger: "item" }, grid: { left: "40%", right: "40%", top: 56, bottom: 36 },
      xAxis: { type: "category", data: [t.indicator.name], show: false }, yAxis: { type: "value", min: 0, max, axisLabel: { show: true } },
      series: [{
        type: "bar", data: [t.latest], barWidth: 28, showBackground: true, backgroundStyle: { color: R.track }, itemStyle: { borderRadius: [14, 14, 14, 14], color: kit.palette[0] }, label: { show: true, position: "top", formatter: "{c}" },
        markLine: { silent: true, symbol: "none", lineStyle: { type: "dashed", color: R.text }, label: { formatter: `Target ${kit.fmt(t.target)}` }, data: [{ yAxis: t.target }] },
      }],
    },
    notes: [`The fill is the latest recorded figure (${t.latestLabel}); the dashed line is the target.`],
  };
}

/** Each indicator's rank among the others at each period (1 = highest). A period where an indicator has no figure has no rank for it: a break in its line. */
export function bump(_spec: ChartSpecV2, norm: Norm, kit: RenderKit): KindBuilt {
  if (norm.series.length < 2) return "A bump chart ranks indicators against each other: choose at least two of the same kind.";
  if (norm.categories.length < 2) return "A bump chart needs at least two periods.";
  const rankAt = (c: number): Array<number | null> => {
    const ranked = norm.series.map((s, i) => ({ i, v: s.data[c] ?? null })).filter((x) => x.v !== null).sort((a, b) => (b.v as number) - (a.v as number) || a.i - b.i);
    const out: Array<number | null> = norm.series.map(() => null);
    ranked.forEach((x, r) => { out[x.i] = r + 1; });
    return out;
  };
  const ranks = norm.categories.map((_, c) => rankAt(c));
  const mixed = new Set(norm.series.map((s) => s.unit)).size > 1 || norm.series.some((s) => s.isRate) !== norm.series.every((s) => s.isRate);
  if (mixed) return "A ranking compares like with like: the indicators have different units, or a rate is mixed with counts.";
  return {
    option: {
      ...kit.base(true), tooltip: { trigger: "axis" }, grid: { left: 48, right: 100, top: 56, bottom: 40, containLabel: true },
      xAxis: { type: "category", data: norm.categories, boundaryGap: false }, yAxis: { type: "value", inverse: true, min: 1, max: norm.series.length, interval: 1, name: "Rank" },
      series: norm.series.map((s, i) => ({ type: "line", name: s.name, data: ranks.map((r) => r[i] ?? null), connectNulls: false, symbolSize: 14, label: { show: true, formatter: "{c}", color: "#fff", fontSize: 10 }, endLabel: { show: true, formatter: "{a}" }, lineStyle: { width: 3 } })),
    },
    notes: ["Rank 1 is the highest figure in that period. A period where an indicator has no figure leaves a break in its line; ties are ranked in the order the indicators were chosen."],
  };
}

/** Two indicators plotted against each other, one point per period, joined in time order. Periods missing either figure are left out and counted. */
export function connectedScatter(_spec: ChartSpecV2, norm: Norm, kit: RenderKit): KindBuilt {
  if (norm.series.length !== 2) return "A connected scatter plots exactly two indicators against each other.";
  const [x, y] = norm.series as [Norm["series"][number], Norm["series"][number]];
  const points = norm.categories.map((label, i) => ({ label, x: x.data[i] ?? null, y: y.data[i] ?? null })).filter((p): p is { label: string; x: number; y: number } => p.x !== null && p.y !== null);
  if (points.length < 3) return `A connected scatter needs at least 3 periods with both figures recorded; there ${points.length === 1 ? "is 1" : `are ${points.length}`}.`;
  const left = norm.categories.length - points.length;
  return {
    option: {
      ...kit.base(false), tooltip: { trigger: "item" }, grid: { left: 56, right: 40, top: 56, bottom: 48, containLabel: true },
      xAxis: { type: "value", name: x.name, scale: true, nameLocation: "middle", nameGap: 28 }, yAxis: { type: "value", name: y.name, scale: true },
      series: [{ type: "line", data: points.map((p) => ({ value: [p.x, p.y], name: p.label })), symbolSize: 10, lineStyle: { width: 2, color: kit.palette[0] }, itemStyle: { color: kit.palette[0] }, label: { show: true, formatter: "{b}", position: "top", fontSize: 10 }, smooth: false }],
    },
    notes: [`Points are joined in time order, from ${points[0]!.label} to ${points.at(-1)!.label}.${left > 0 ? ` ${left} ${left === 1 ? "period is" : "periods are"} left out because a figure is missing.` : ""}`],
  };
}
