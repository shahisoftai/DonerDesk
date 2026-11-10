import type { ChartSpecV2 } from "./chart-spec-v2.js";
import type { Norm } from "./chart-render.js";
import type { KindBuilt, RenderKit } from "./chart-render-kinds.js";
import { LIGHT_ROLES as R } from "./chart-theme-roles.js";

/**
 * Phase 48.11 kinds that show shares of a whole or one small chart per indicator: parliament (dots), proportion bar and small multiples.
 * Parts and panels come only from recorded figures: a part at zero or with nothing recorded is not drawn and is counted, a rate is never
 * a share of anything, and no panel borrows another's scale (each says so).
 */
const sum = (xs: ReadonlyArray<number>): number => xs.reduce((t, x) => t + x, 0);

/** `units` shared between the parts by the largest-remainder method: they always add to `units` and no part is lost or invented. */
export function apportion(values: ReadonlyArray<number>, units: number): number[] {
  const total = sum(values);
  if (total <= 0) return values.map(() => 0);
  const exact = values.map((v) => (v / total) * units);
  const cells = exact.map(Math.floor);
  let left = units - sum(cells);
  [...exact.keys()].sort((a, b) => (exact[b]! - cells[b]!) - (exact[a]! - cells[a]!) || a - b).forEach((i) => { if (left > 0) { cells[i]! += 1; left -= 1; } });
  return cells;
}

interface Part { name: string; value: number }
function partsOf(norm: Norm): { parts: Part[]; left: number } | string {
  const s = norm.series[0]!;
  if (s.isRate || norm.series.some((x) => x.isRate)) return "A share of a whole is made of counts. A rate is not a part of anything.";
  const all = norm.categories.map((name, i) => ({ name, value: s.data[i] ?? null }));
  const parts = all.filter((p): p is Part => p.value !== null && p.value > 0);
  if (parts.length < 2) return "This needs at least two parts above zero.";
  return { parts, left: all.length - parts.length };
}
const leftNote = (left: number): string[] => (left > 0 ? [`${left} ${left === 1 ? "part has" : "parts have"} nothing above zero recorded and ${left === 1 ? "is" : "are"} not drawn.`] : []);

/** A semicircle of 100 dots, each 1% of the total, in the order the parts are given. */
export function parliament(_spec: ChartSpecV2, norm: Norm, kit: RenderKit): KindBuilt {
  const got = partsOf(norm);
  if (typeof got === "string") return got;
  const { parts, left } = got;
  const radii = [2, 3, 4, 5, 6];
  const perRow = apportion(radii, 100);
  const dots: Array<{ angle: number; r: number; x: number; y: number }> = [];
  perRow.forEach((n, row) => {
    for (let k = 0; k < n; k += 1) {
      const angle = n === 1 ? Math.PI / 2 : (k / (n - 1)) * Math.PI;
      const r = radii[row]!;
      dots.push({ angle, r, x: -Math.cos(angle) * r, y: Math.sin(angle) * r });
    }
  });
  dots.sort((a, b) => a.angle - b.angle || a.r - b.r);
  const cells = apportion(parts.map((p) => p.value), 100);
  let at = 0;
  const series = parts.map((p, i) => {
    const mine = dots.slice(at, at + cells[i]!);
    at += cells[i]!;
    return { type: "scatter", name: p.name, symbolSize: 14, data: mine.map((d) => [Number(d.x.toFixed(3)), Number(d.y.toFixed(3))]), itemStyle: { color: kit.palette[i % kit.palette.length] }, tooltip: { formatter: `${p.name}: ${kit.fmt(p.value)} (${cells[i]}%)` } };
  });
  return {
    option: { ...kit.base(true), grid: { left: 24, right: 24, top: 64, bottom: 48 }, xAxis: { show: false, min: -7, max: 7 }, yAxis: { show: false, min: 0, max: 7 }, tooltip: { trigger: "item" }, series },
    notes: ["Each dot is 1% of the total, shared between the parts by the largest remainder, so the dots always add to 100.", ...leftNote(left)],
  };
}

/** One bar split into the parts' shares of the total. */
export function proportionBar(_spec: ChartSpecV2, norm: Norm, kit: RenderKit): KindBuilt {
  const got = partsOf(norm);
  if (typeof got === "string") return got;
  const { parts, left } = got;
  const total = sum(parts.map((p) => p.value));
  return {
    option: {
      ...kit.base(true), tooltip: { trigger: "item" }, grid: { left: 24, right: 24, top: 96, bottom: 40 },
      xAxis: { type: "value", max: total, show: false }, yAxis: { type: "category", data: [""], show: false },
      series: parts.map((p, i) => ({ type: "bar", name: p.name, stack: "share", barWidth: 56, data: [p.value], itemStyle: { color: kit.palette[i % kit.palette.length], borderColor: R.surface, borderWidth: 2 }, label: { show: true, formatter: `${Math.round((p.value / total) * 100)}%`, color: "#fff" } })),
    },
    notes: ["The bar is the total of the parts; each percentage is the part's recorded figure over that total.", ...leftNote(left)],
  };
}

const MAX_PANELS = 12;
/** One small line chart per indicator across the periods. Each panel has its own scale, so indicators with different units sit side by side without sharing an axis. */
export function smallMultiples(_spec: ChartSpecV2, norm: Norm, kit: RenderKit): KindBuilt {
  const n = norm.series.length;
  if (n < 2) return "Small multiples show one small chart per indicator: choose at least two.";
  if (n > MAX_PANELS) return `Small multiples show at most ${MAX_PANELS} indicators; choose fewer.`;
  if (norm.categories.length < 2) return "Small multiples need at least two periods.";
  const cols = Math.min(4, Math.ceil(Math.sqrt(n)));
  const rows = Math.ceil(n / cols);
  const w = 100 / cols;
  const h = 78 / rows;
  const grid: unknown[] = [];
  const xAxis: unknown[] = [];
  const yAxis: unknown[] = [];
  const titles: unknown[] = [];
  const series: unknown[] = [];
  norm.series.forEach((s, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    grid.push({ left: `${c * w + 4}%`, width: `${w - 8}%`, top: `${14 + r * h + 4}%`, height: `${h - 12}%` });
    xAxis.push({ type: "category", gridIndex: i, data: norm.categories, show: r === rows - 1 || i + cols >= n, boundaryGap: false, axisLabel: { fontSize: 10, hideOverlap: true } });
    yAxis.push({ type: "value", gridIndex: i, scale: true, splitNumber: 2, axisLabel: { fontSize: 10 } });
    titles.push({ text: s.name, left: `${c * w + 4}%`, top: `${14 + r * h - 1}%`, textStyle: { fontSize: 11, fontWeight: "normal" } });
    series.push({ type: "line", name: s.name, xAxisIndex: i, yAxisIndex: i, data: s.data, connectNulls: false, symbolSize: 5, itemStyle: { color: kit.palette[i % kit.palette.length] }, lineStyle: { color: kit.palette[i % kit.palette.length] } });
  });
  const base = kit.base(false) as { title?: unknown };
  const baseTitles = Array.isArray(base.title) ? base.title : base.title ? [base.title] : [];
  return {
    option: { ...base, title: [...baseTitles, ...titles], tooltip: { trigger: "axis" }, grid, xAxis, yAxis, series },
    notes: ["Each panel has its own scale; compare the shape over time, not the height between panels. A period with nothing recorded leaves a gap."],
  };
}
