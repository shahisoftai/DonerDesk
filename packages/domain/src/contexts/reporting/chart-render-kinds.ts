import type { ChartSpecV2 } from "./chart-spec-v2.js";
import type { Norm } from "./chart-render.js";
import type { DatasetBudgetLine, DatasetResult } from "./dataset-query.js";
import { LIGHT_ROLES as R } from "./chart-theme-roles.js";
import { ICON_PATHS } from "./chart-icons.js";

/**
 * The chart types added in Phase 47 (pictorial bar, rose, radial bar, range band and bars, parallel, tree, network, theme river, fill
 * gauge, rings). Each draws only what is recorded: a gap is a gap, a rate is never summed, and a layout that needs a made-up figure is
 * not offered. `chart-render.ts` passes in what it already builds (the palette, the shared option base, number formatting), so this file
 * never imports the renderer's internals and the two do not depend on each other at run time.
 */

type Obj = Record<string, unknown>;
export type KindBuilt = { option: Obj; notes?: string[] } | string;
export interface RenderKit {
  /** The option every chart starts from (title, legend, text description). */
  base: (legend: boolean) => Obj;
  palette: string[];
  fmt: (n: number) => string;
}

const values = (xs: ReadonlyArray<number | null>): number[] => xs.filter((x): x is number => x !== null);
/** A tidy unit (1, 2 or 5 times a power of ten) that fits `max` in ten to a dozen or so steps. */
export function niceUnit(max: number): number {
  const raw = max / 10;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f <= 1.5 ? 1 : f <= 3.5 ? 2 : f <= 7.5 ? 5 : 10) * pow;
}

const unitText = (norm: Norm): string => norm.series[0]?.unit ?? "";

/** Icons in a row, one for each whole unit; the exact figure is written at the end of the row. */
export function pictorialBar(spec: ChartSpecV2, norm: Norm, kit: RenderKit): KindBuilt {
  const s = norm.series[0]!;
  const nums = values(s.data);
  if (nums.length === 0 || Math.max(...nums) <= 0) return "Nothing above zero to show.";
  if (nums.some((v) => v < 0)) return "Icons count whole units, so a negative value cannot be shown.";
  const unit = niceUnit(Math.max(...nums));
  const icons: Array<{ value: [number, number]; itemStyle?: { opacity: number } }> = [];
  // The figure is the point's own name, written with a plain template: a file that is made from the option as data keeps it.
  const ends: Array<{ value: [number, number]; name: string }> = [];
  s.data.forEach((v, row) => {
    if (v === null) { ends.push({ value: [0.3, row], name: "Not measured" }); return; }
    const n = Math.floor(v / unit);
    for (let i = 0; i < n; i++) icons.push({ value: [i + 0.5, row] });
    // A part of a unit is one fainter icon (its strength is the share of the unit), so a small value is still seen and never mistaken for a whole one.
    const part = v / unit - n;
    if (part > 0.001) icons.push({ value: [n + 0.5, row], itemStyle: { opacity: Math.max(0.25, Math.round(part * 100) / 100) } });
    ends.push({ value: [n + (part > 0.001 ? 1 : 0) + 0.4, row], name: kit.fmt(v) });
  });
  const symbol = ICON_PATHS.PERSON;
  return {
    option: {
      ...kit.base(false), tooltip: { trigger: "item", formatter: (p: { value?: number[] }) => `${norm.categories[p.value?.[1] ?? 0] ?? ""}` },
      grid: { left: 90, right: 90, top: 56, bottom: 30, containLabel: true },
      xAxis: { type: "value", min: 0, max: Math.ceil(Math.max(...nums) / unit) + 2.5, show: false }, yAxis: { type: "category", data: norm.categories, inverse: true, axisLabel: { width: 90, overflow: "truncate" } },
      series: [
        { type: "scatter", name: "icons", data: icons, symbol, symbolSize: 22, itemStyle: { color: kit.palette[0] } },
        { type: "scatter", name: "figures", silent: true, data: ends.map((e) => ({ value: e.value, name: e.name, label: { show: true, position: "right", formatter: "{b}", color: R.text } })), symbolSize: 0 },
      ],
    },
    notes: [`Each icon stands for ${kit.fmt(unit)}${unitText(norm) ? ` ${unitText(norm)}` : ""}; a fainter icon is a part of one, and the figure at the end of the row is exact.`],
  };
}

/** Concentric rows around a circle: the radius carries the category, the arc length the value. */
export function radialBar(spec: ChartSpecV2, norm: Norm, kit: RenderKit): KindBuilt {
  const s = norm.series[0]!;
  const nums = values(s.data);
  if (nums.length === 0) return "Nothing is recorded to show.";
  if (nums.some((v) => v < 0)) return "A radial bar starts at zero, so a negative value cannot be shown.";
  return {
    option: {
      ...kit.base(false), tooltip: { trigger: "item" }, polar: { radius: ["18%", "78%"] },
      angleAxis: { type: "value", min: 0, max: Math.max(...nums) * 1.05, startAngle: 90, axisLabel: { show: false }, splitLine: { show: false } },
      radiusAxis: { type: "category", data: norm.categories, axisLine: { show: false }, axisTick: { show: false } },
      series: [{ type: "bar", coordinateSystem: "polar", data: s.data, roundCap: true, showBackground: true, backgroundStyle: { color: R.track }, label: { show: true, position: "middle", formatter: "{c}" } }],
    },
  };
}

interface Pair { lo: Array<number | null>; hi: Array<number | null>; names: [string, string] }
function pairOf(norm: Norm): Pair | string {
  if (norm.series.length !== 2) return "A range needs exactly two indicators of the same kind (a lowest and a highest).";
  const [a, b] = norm.series as [Norm["series"][number], Norm["series"][number]];
  const lo: Array<number | null> = [], hi: Array<number | null> = [];
  a.data.forEach((x, i) => { const y = b.data[i] ?? null; if (x === null || y === null) { lo.push(null); hi.push(null); } else { lo.push(Math.min(x, y)); hi.push(Math.max(x, y)); } });
  if (values(lo).length === 0) return "No period has both values recorded, so there is no range to show.";
  return { lo, hi, names: [a.name, b.name] };
}
const spanOf = (p: Pair): Array<number | null> => p.lo.map((l, i) => (l === null || p.hi[i] === null ? null : p.hi[i]! - l));

/** The span between two indicators at each period, as a shaded band with the two lines on its edges. A period missing either value is a gap. */
export function areaRange(spec: ChartSpecV2, norm: Norm, kit: RenderKit): KindBuilt {
  const p = pairOf(norm);
  if (typeof p === "string") return p;
  const [a, b] = norm.series as [Norm["series"][number], Norm["series"][number]];
  const unit = a.unit;
  return {
    option: {
      ...kit.base(true), legend: { show: true, bottom: 0, data: [p.names[0], p.names[1]] },
      tooltip: { trigger: "axis", formatter: (params: Array<{ dataIndex: number }>) => { const i = params[0]?.dataIndex ?? 0; return p.lo[i] === null ? `${norm.categories[i] ?? ""}: not both recorded` : `${norm.categories[i] ?? ""}: ${kit.fmt(p.lo[i]!)} to ${kit.fmt(p.hi[i]!)}${unit ? ` ${unit}` : ""}`; } },
      grid: { left: 56, right: 24, top: 56, bottom: 52, containLabel: true },
      xAxis: { type: "category", data: norm.categories, boundaryGap: false }, yAxis: { type: "value" },
      series: [
        { type: "line", name: "base", stack: "range", data: p.lo, silent: true, symbol: "none", lineStyle: { opacity: 0 }, itemStyle: { color: "transparent" }, tooltip: { show: false } },
        { type: "line", name: "range", stack: "range", data: spanOf(p), silent: true, symbol: "none", lineStyle: { opacity: 0 }, areaStyle: { opacity: 0.22, color: kit.palette[0] }, tooltip: { show: false } },
        { type: "line", name: p.names[0], data: a.data, showSymbol: true, connectNulls: false }, { type: "line", name: p.names[1], data: b.data, showSymbol: true, connectNulls: false },
      ],
    },
    notes: [`The shaded band is the span between ${p.names[0]} and ${p.names[1]}; a period missing either value has no band.`],
  };
}

/** Floating bars from the lower to the higher of two indicators at each period. */
export function rangeBar(spec: ChartSpecV2, norm: Norm, kit: RenderKit): KindBuilt {
  const p = pairOf(norm);
  if (typeof p === "string") return p;
  const unit = norm.series[0]!.unit;
  return {
    option: {
      ...kit.base(false),
      tooltip: { trigger: "axis", formatter: (params: Array<{ dataIndex: number }>) => { const i = params[0]?.dataIndex ?? 0; return p.lo[i] === null ? `${norm.categories[i] ?? ""}: not both recorded` : `${norm.categories[i] ?? ""}: ${kit.fmt(p.lo[i]!)} to ${kit.fmt(p.hi[i]!)}${unit ? ` ${unit}` : ""}`; } },
      grid: { left: 56, right: 24, top: 56, bottom: 40, containLabel: true },
      xAxis: { type: "category", data: norm.categories }, yAxis: { type: "value" },
      series: [
        { type: "bar", name: "base", stack: "range", data: p.lo, silent: true, itemStyle: { color: "transparent" }, tooltip: { show: false } },
        { type: "bar", name: "range", stack: "range", data: spanOf(p) },
      ],
    },
    notes: [`Each bar runs from the lower to the higher of ${p.names[0]} and ${p.names[1]}; a period missing either value has no bar.`],
  };
}

/** One line per period across an axis for each indicator. Each axis keeps its own unit; a period missing any value is left out and counted. */
export function parallel(spec: ChartSpecV2, norm: Norm, kit: RenderKit): KindBuilt {
  if (norm.series.length < 2) return "A parallel chart needs at least two indicators.";
  const rows = norm.categories.map((label, ci) => ({ label, v: norm.series.map((s) => s.data[ci] ?? null) })).filter((r) => r.v.every((x) => x !== null));
  if (rows.length < 3) return `A parallel chart needs at least 3 periods with every indicator recorded; there ${rows.length === 1 ? "is 1" : `are ${rows.length}`}.`;
  const left = norm.categories.length - rows.length;
  return {
    option: {
      ...kit.base(false), tooltip: { trigger: "item" }, parallel: { left: 60, right: 100, top: 64, bottom: 36 },
      parallelAxis: norm.series.map((s, dim) => ({ dim, name: s.unit ? `${s.name} (${s.unit})` : s.name, nameLocation: "start", nameGap: 20 })),
      series: [{ type: "parallel", lineStyle: { width: 2, opacity: 0.6 }, data: rows.map((r) => ({ name: r.label, value: r.v })) }],
    },
    notes: [`Each line is one period.${left > 0 ? ` ${left} ${left === 1 ? "period is" : "periods are"} left out because an indicator has no value.` : ""} Every axis has its own scale.`],
  };
}

/** The indicators grouped by logframe level, as a tree; a leaf names its latest value or "Not measured". Structure only. */
export function tree(spec: ChartSpecV2, norm: Norm, kit: RenderKit): KindBuilt {
  const items = norm.items;
  if (!items || items.length === 0) return "Choose at least one indicator to place in the tree.";
  const values_ = norm.series[0]!.data;
  const levels = new Map<string, Obj[]>();
  items.forEach((it, i) => {
    const level = (it.level ?? "OTHER").toString();
    const v = values_[i] ?? null;
    levels.set(level, [...(levels.get(level) ?? []), { name: `${it.code} · ${v === null ? "Not measured" : kit.fmt(v)}` }]);
  });
  const order = ["IMPACT", "GOAL", "OUTCOME", "OUTPUT", "ACTIVITY"];
  const children = [...levels].sort((a, b) => (order.indexOf(a[0]) + 100) % 100 - (order.indexOf(b[0]) + 100) % 100).map(([level, kids]) => ({ name: level.charAt(0) + level.slice(1).toLowerCase(), children: kids }));
  return {
    option: { ...kit.base(false), tooltip: { trigger: "item" }, series: [{ type: "tree", data: [{ name: "Indicators", children }], top: "8%", left: "12%", bottom: "8%", right: "28%", symbolSize: 9, orient: "LR", expandAndCollapse: false, label: { position: "left", verticalAlign: "middle", align: "right" }, leaves: { label: { position: "right", align: "left" } } }] },
    notes: ["Indicators are grouped by their logframe level; the figure is the latest recorded."],
  };
}

/** Donors and cost categories as a ring of nodes, linked by the budgeted amount. */
export function network(spec: ChartSpecV2, lines: ReadonlyArray<DatasetBudgetLine>, kit: RenderKit, notes: string[]): KindBuilt {
  const usable = lines.filter((l) => l.budgeted > 0);
  if (usable.length < 2) return "A budget network needs at least two budget lines with an amount.";
  const currencies = [...new Set(usable.map((l) => l.currency))];
  if (currencies.length > 1) return `The budget is in more than one currency (${currencies.join(", ")}), so it cannot be drawn as one network.`;
  const size = new Map<string, number>();
  const links = new Map<string, number>();
  for (const l of usable) {
    const d = `Donor: ${l.donor.trim() || "No donor named"}`, c = `Category: ${l.category.trim() || "Uncategorised"}`;
    size.set(d, (size.get(d) ?? 0) + l.budgeted); size.set(c, (size.get(c) ?? 0) + l.budgeted);
    links.set(`${d}\u0000${c}`, (links.get(`${d}\u0000${c}`) ?? 0) + l.budgeted);
  }
  const max = Math.max(...size.values());
  return {
    option: {
      ...kit.base(false), tooltip: { trigger: "item", formatter: (p: { name?: string; value?: number; dataType?: string }) => `${p.name ?? ""}${typeof p.value === "number" ? `: ${kit.fmt(p.value)} ${currencies[0] ?? ""}` : ""}` },
      series: [{ type: "graph", layout: "circular", circular: { rotateLabel: true }, roam: false, data: [...size].map(([name, v]) => ({ name, value: v, symbolSize: 14 + 30 * Math.sqrt(v / max), itemStyle: { color: name.startsWith("Donor") ? kit.palette[0] : kit.palette[1] ?? kit.palette[0] } })), links: [...links].map(([k, value]) => { const [source, target] = k.split("\u0000"); return { source, target, value, lineStyle: { width: 1 + 8 * (value / max), opacity: 0.5 } }; }), label: { show: true, position: "right", formatter: "{b}" } }],
    },
    notes: [...notes, `Amounts are budgeted, in ${currencies[0] ?? "the project currency"}. Node size is the total budgeted; line width is the amount between a donor and a category.`],
  };
}

/** Additive series flowing through time as a stream; a missing value is not a point (the stream narrows), never a zero. */
export function themeRiver(spec: ChartSpecV2, norm: Norm, data: DatasetResult, kit: RenderKit): KindBuilt {
  const rows: Array<[string, number, string]> = [];
  norm.series.forEach((s) => s.data.forEach((v, i) => { const start = data.periods.find((p) => p.label === norm.categories[i])?.start; if (v !== null && start) rows.push([start, v, s.name]); }));
  if (new Set(rows.map((r) => r[0])).size < 3) return "A stream needs values in at least 3 periods.";
  return {
    option: { ...kit.base(true), legend: { show: true, bottom: 0 }, tooltip: { trigger: "axis", axisPointer: { type: "line" } }, singleAxis: { type: "time", top: 56, bottom: 52, left: 24, right: 24 }, series: [{ type: "themeRiver", data: rows, label: { show: false }, emphasis: { focus: "series" } }] },
    notes: ["The width of each stream is its recorded value; a period with no value for a stream is not drawn for it."],
  };
}

/** A shape filled to the share of the target reached (capped at 100% with a note), so a person sees "how full". */
export function fillGauge(spec: ChartSpecV2, pct: number, caption: string, kit: RenderKit): KindBuilt {
  const shown = Math.min(pct, 100);
  const symbol = ICON_PATHS.DROP;
  return {
    option: {
      ...kit.base(false), grid: { left: 0, right: 0, top: 48, bottom: 8 }, xAxis: { type: "category", data: ["x"], show: false }, yAxis: { type: "value", min: 0, max: 100, show: false },
      series: [
        { type: "pictorialBar", silent: true, symbol, symbolBoundingData: 100, symbolSize: ["70%", "100%"], itemStyle: { color: R.track }, data: [100], z: 1 },
        { type: "pictorialBar", symbol, symbolClip: true, symbolBoundingData: 100, symbolSize: ["70%", "100%"], itemStyle: { color: kit.palette[0] }, data: [shown], z: 2 },
      ],
      graphic: [{ type: "text", left: "center", top: "44%", style: { text: `${pct}%`, fontSize: 28, fontWeight: "bold", fill: R.text, stroke: R.surface, lineWidth: 4, textAlign: "center" }, z: 10 }, { type: "text", left: "center", top: "60%", style: { text: caption, fontSize: 12, fill: R.text, stroke: R.surface, lineWidth: 3, textAlign: "center" }, z: 10 }],
    },
    notes: pct > 100 ? [`The target is passed (${pct}%); the shape shows full.`, caption] : [caption],
  };
}

/** Progress to target as concentric rings, one per indicator. Only indicators with a numeric target above zero and a recorded value get a ring. */
export function multiRing(spec: ChartSpecV2, norm: Norm, kit: RenderKit): KindBuilt {
  const items = norm.items ?? [];
  if (norm.measure === "PERIOD") return "Rings show progress to a target, so use the cumulative figure or % of target.";
  const rings: Array<{ code: string; pct: number }> = [];
  const left: string[] = [];
  items.forEach((it, i) => {
    const v = norm.series[0]!.data[i] ?? null;
    const target = Number.parseFloat((it.target ?? "").replace(/,/g, ""));
    if (it.isRate || v === null || (norm.measure === "CUMULATIVE" && !(target > 0))) { left.push(it.code); return; }
    rings.push({ code: it.code, pct: norm.measure === "PERCENT_OF_TARGET" ? v : Math.round((v / target) * 1000) / 10 });
  });
  if (rings.length < 2) return "Rings need at least two indicators that have a target and a recorded value.";
  const shown = rings.slice(0, 6);
  const step = 56 / shown.length;
  return {
    option: {
      ...kit.base(true), legend: { show: true, bottom: 0, data: shown.map((r) => r.code) }, tooltip: { trigger: "item", formatter: (p: { name?: string; value?: number }) => `${p.name ?? ""}: ${p.value ?? ""}%` },
      series: shown.map((r, i) => ({ type: "pie", radius: [`${22 + i * step}%`, `${22 + i * step + step * 0.72}%`], center: ["50%", "48%"], startAngle: 90, label: { show: false }, labelLine: { show: false }, itemStyle: { borderColor: R.surface, borderWidth: 1 }, data: [{ name: r.code, value: Math.min(r.pct, 100), itemStyle: { color: kit.palette[i % kit.palette.length] } }, { name: `${r.code} remaining`, value: Math.max(0, 100 - r.pct), itemStyle: { color: R.track }, tooltip: { show: false } }] })),
    },
    notes: [`${shown.map((r) => `${r.code} ${r.pct}%`).join(", ")} of target.${left.length > 0 ? ` Left out (no target, no value or a rate): ${left.join(", ")}.` : ""}`],
  };
}
