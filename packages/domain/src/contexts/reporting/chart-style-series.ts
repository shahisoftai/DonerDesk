import { hexToRgb, mixHex } from "./chart-color.js";
import { inScope } from "./chart-style-fields.js";
import type { ChartKind } from "./chart-spec-v2.js";
import type { ChartStyle, StyleLabelPosition, StyleSymbol, StyleTone } from "./chart-style-types.js";
import { LIGHT_ROLES as R } from "./chart-theme-roles.js";
import { ICON_PATHS } from "./chart-icons.js";

/** Series-level styling (Phase 47): what a style does to each drawn series. Pure; the helper series a builder adds are never repainted. */

export type Obj = Record<string, unknown>;
export const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const HEX = /^#[0-9a-f]{6}$/i;

export const SYMBOL_NAME: Record<StyleSymbol, string> = { CIRCLE: "circle", RECT: "rect", ROUND_RECT: "roundRect", TRIANGLE: "triangle", DIAMOND: "diamond", NONE: "none" };
export const TONE_COLOUR: Record<StyleTone, string> = { NEGATIVE: R.negative, NEUTRAL: R.neutral, POSITIVE: R.positive };

/** The ramp of a heatmap: low end, high end. The low end is a wash, the high end reads against a light or a dark surface. */
export const RAMP_COLOURS: Record<string, [string, string]> = {
  BLUE: ["#e0f2fe", "#075985"], GREEN: ["#dcfce7", "#166534"], WARM: ["#fef3c7", "#b45309"], PURPLE: ["#ede9fe", "#5b21b6"], GREY: ["#f3f4f6", "#374151"],
};

/** Merges defined values into `target[key]`; nothing is written when there is nothing to say. */
export function put(target: Obj, key: string, patch: Obj): void {
  const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
  if (Object.keys(clean).length > 0) target[key] = { ...(isObj(target[key]) ? target[key] as Obj : {}), ...clean };
}

/** Series the builder draws only as a helper (a hidden base, a track, a stem's dot): a style never repaints them. */
export const isHelper = (s: Obj): boolean => s["silent"] === true || (isObj(s["itemStyle"]) && (s["itemStyle"] as Obj)["color"] === "transparent");

export interface SeriesContext { st: ChartStyle; kind: ChartKind; horizontal: boolean; colours: string[] | undefined; index: number }

const rgba = (hex: string, a: number): string => { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };

/** The colour a series is drawn in: a person's own choice, else the palette colour at its place. */
function baseColour(s: Obj, c: SeriesContext): string | undefined {
  const own = isObj(s["itemStyle"]) ? (s["itemStyle"] as Obj)["color"] : isObj(s["lineStyle"]) ? (s["lineStyle"] as Obj)["color"] : undefined;
  if (typeof own === "string" && HEX.test(own)) return own;
  const fromPalette = c.colours?.[c.index % (c.colours?.length || 1)];
  return fromPalette && HEX.test(fromPalette) ? fromPalette : undefined;
}

const BAR_POSITION = (horizontal: boolean): Partial<Record<StyleLabelPosition, string>> => ({ TOP: "top", BOTTOM: "bottom", LEFT: "left", RIGHT: "right", INSIDE: "inside", OUTSIDE: horizontal ? "right" : "top" });
const LINE_POSITION: Partial<Record<StyleLabelPosition, string>> = { TOP: "top", BOTTOM: "bottom", LEFT: "left", RIGHT: "right" };
const PIE_POSITION: Partial<Record<StyleLabelPosition, string>> = { INSIDE: "inside", OUTSIDE: "outside" };

function styleLabel(out: Obj, c: SeriesContext): void {
  const l = c.st.labels;
  if (!l || !isObj(out["label"])) return;
  const type = out["type"];
  const map = type === "bar" ? BAR_POSITION(c.horizontal) : type === "line" || type === "scatter" || type === "effectScatter" ? LINE_POSITION : type === "pie" ? PIE_POSITION : undefined;
  put(out, "label", {
    fontSize: l.size, rotate: l.rotate,
    ...(l.weight ? { fontWeight: l.weight === "BOLD" ? "bold" : "normal" } : {}),
    ...(l.position && l.position !== "AUTO" && map?.[l.position] ? { position: map[l.position] } : {}),
  });
  if (l.hideOverlap) out["labelLayout"] = { hideOverlap: true };
}

function styleEffects(out: Obj, c: SeriesContext): void {
  const e = c.st.effects;
  if (!e) return;
  const isLine = out["type"] === "line";
  const target = isLine ? "lineStyle" : "itemStyle";
  put(out, target, {
    ...(e.shadow ? { shadowBlur: 8, shadowColor: "rgba(0,0,0,0.25)", shadowOffsetY: 2 } : {}),
    ...(e.opacity !== undefined ? { opacity: e.opacity } : {}),
  });
  if (e.hover !== undefined) put(out, "emphasis", { focus: e.hover.toLowerCase() });
}

/** Highest, lowest, average and latest value, marked on the series; a missing value is never marked (the chart library skips a gap). */
function styleMarks(out: Obj, c: SeriesContext): void {
  const m = c.st.marks;
  if (!m || !inScope("MARKS", c.kind) || out["stack"] !== undefined) return;
  const type = out["type"];
  if (type !== "bar" && type !== "line") return;
  const points: Obj[] = [];
  if (m.max) points.push({ type: "max", name: "Highest" });
  if (m.min) points.push({ type: "min", name: "Lowest" });
  if (m.latest && Array.isArray(out["data"])) {
    const data = out["data"] as unknown[];
    for (let i = data.length - 1; i >= 0; i--) {
      const raw = isObj(data[i]) ? (data[i] as Obj)["value"] : data[i];
      if (typeof raw === "number") { points.push({ name: "Latest", coord: c.horizontal ? [raw, i] : [i, raw] }); break; }
    }
  }
  if (points.length > 0) put(out, "markPoint", { data: [...(isObj(out["markPoint"]) && Array.isArray((out["markPoint"] as Obj)["data"]) ? (out["markPoint"] as Obj)["data"] as unknown[] : []), ...points], symbolSize: 44 });
  if (m.average) {
    const existing = isObj(out["markLine"]) ? out["markLine"] as Obj : { symbol: "none", silent: true, data: [] };
    const avg = { type: "average", name: "Average", lineStyle: { type: "dotted" }, label: { formatter: "Average {c}", position: "insideEndTop" } };
    out["markLine"] = { ...existing, data: [...(Array.isArray(existing["data"]) ? existing["data"] as unknown[] : []), avg] };
  }
}

function styleBar(out: Obj, c: SeriesContext): void {
  const b = c.st.bars;
  if (!b) return;
  if (b.width !== undefined) out["barWidth"] = b.width;
  if (b.gap !== undefined) { out["barGap"] = `${b.gap}%`; out["barCategoryGap"] = `${b.gap}%`; }
  // Rounded ends only on bars that stand alone: a rounded stack would show gaps between its parts.
  if (b.radius !== undefined && out["stack"] === undefined) put(out, "itemStyle", { borderRadius: c.horizontal ? [0, b.radius, b.radius, 0] : [b.radius, b.radius, 0, 0] });
  if (b.borderWidth !== undefined) put(out, "itemStyle", { borderWidth: b.borderWidth, borderColor: R.surface });
  if (b.track) { out["showBackground"] = true; out["backgroundStyle"] = { color: R.track }; }
  if (b.gradient) {
    const base = baseColour(out, c);
    if (base) put(out, "itemStyle", { color: { type: "linear", x: 0, y: 0, x2: c.horizontal ? 1 : 0, y2: c.horizontal ? 0 : 1, colorStops: c.horizontal ? [{ offset: 0, color: mixHex(base, "#ffffff", 0.45) }, { offset: 1, color: base }] : [{ offset: 0, color: base }, { offset: 1, color: mixHex(base, "#ffffff", 0.45) }] } });
  }
}

function styleLine(out: Obj, c: SeriesContext): void {
  const stem = isObj(out["lineStyle"]) && (out["lineStyle"] as Obj)["width"] === 0;
  if (stem) return;
  const l = c.st.lines;
  if (l) {
    put(out, "lineStyle", { width: l.width, ...(l.roundCaps ? { cap: "round", join: "round" } : {}) });
    if (l.smooth !== undefined) out["smooth"] = l.smooth;
    if (l.symbol !== undefined) out["symbol"] = SYMBOL_NAME[l.symbol];
    if (l.symbolSize !== undefined) out["symbolSize"] = l.symbolSize;
    if (l.showSymbols === "ALWAYS") out["showSymbol"] = true;
    if (l.showSymbols === "NEVER") out["showSymbol"] = false;
  }
  const a = c.st.area;
  if (a && isObj(out["areaStyle"])) {
    if (a.opacity !== undefined) put(out, "areaStyle", { opacity: a.opacity });
    if (a.fade) {
      const base = baseColour(out, c);
      const top = a.opacity ?? 0.35;
      if (base) out["areaStyle"] = { ...(out["areaStyle"] as Obj), opacity: 1, color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: rgba(base, top) }, { offset: 1, color: rgba(base, 0) }] } };
    }
  }
}

function stylePie(out: Obj, c: SeriesContext): void {
  const p = c.st.pie;
  if (!p) return;
  const outer = p.outerRadius;
  const inner = p.innerRadius;
  if (outer !== undefined || inner !== undefined) {
    const radius = out["radius"];
    if (Array.isArray(radius)) out["radius"] = [`${inner ?? Number.parseFloat(String(radius[0]))}%`, `${outer ?? Number.parseFloat(String(radius[1]))}%`];
    else out["radius"] = inner !== undefined ? [`${inner}%`, `${outer ?? Number.parseFloat(String(radius ?? 68))}%`] : `${outer}%`;
  }
  if (p.startAngle !== undefined) out["startAngle"] = p.startAngle;
  if (p.clockwise !== undefined) out["clockwise"] = p.clockwise;
  if (p.rose !== undefined && p.rose !== "NONE") out["roseType"] = p.rose === "AREA" ? "area" : "radius";
  if (p.rose === "NONE" && c.kind !== "ROSE") delete out["roseType"];
  if (p.minAngle !== undefined) out["minAngle"] = p.minAngle;
  put(out, "itemStyle", { borderWidth: p.sliceGap, ...(p.sliceGap !== undefined ? { borderColor: R.surface } : {}), borderRadius: p.sliceRadius });
  if (p.labelLines !== undefined) put(out, "labelLine", { show: p.labelLines });
}

function styleGauge(out: Obj, c: SeriesContext): void {
  const g = c.st.gauge;
  if (!g) return;
  if (g.startAngle !== undefined) out["startAngle"] = g.startAngle;
  if (g.endAngle !== undefined) out["endAngle"] = g.endAngle;
  if (g.width !== undefined) { put(out, "progress", { width: g.width }); put(out, "axisLine", { lineStyle: { ...(isObj(out["axisLine"]) && isObj((out["axisLine"] as Obj)["lineStyle"]) ? (out["axisLine"] as Obj)["lineStyle"] as Obj : {}), width: g.width } }); }
  if (g.pointer !== undefined) put(out, "pointer", { show: g.pointer });
  if (g.ticks !== undefined) { put(out, "axisTick", { show: g.ticks }); put(out, "splitLine", { show: g.ticks }); }
  if (g.scaleLabels !== undefined) put(out, "axisLabel", { show: g.scaleLabels });
  if (g.detailSize !== undefined) put(out, "detail", { fontSize: g.detailSize });
  if (g.bands && g.bands.length > 0) {
    const stops: Array<[number, string]> = g.bands.map((b) => [b.upTo / 100, TONE_COLOUR[b.tone]]);
    if (stops[stops.length - 1]![0] < 1) stops.push([1, R.track]);
    put(out, "axisLine", { lineStyle: { ...(isObj(out["axisLine"]) && isObj((out["axisLine"] as Obj)["lineStyle"]) ? (out["axisLine"] as Obj)["lineStyle"] as Obj : {}), color: stops } });
    // The coloured stretches are the dial: the pointer says where the value is, so the plain progress arc that would cover them is switched off.
    put(out, "progress", { show: false });
  }
}

function styleMap(out: Obj, c: SeriesContext): void {
  const m = c.st.map;
  if (!m) return;
  if (out["type"] === "map") {
    put(out, "itemStyle", { borderWidth: m.borders === false ? 0 : m.borderWidth });
    if (m.labels !== undefined) put(out, "label", { show: m.labels });
    if (m.roam !== undefined) out["roam"] = m.roam;
  }
  if (out["type"] === "scatter" && out["coordinateSystem"] === "geo") {
    put(out, "itemStyle", { opacity: m.opacity });
    const size = out["symbolSize"];
    if (m.symbolScale !== undefined && typeof size === "function") out["symbolSize"] = (v: unknown) => (size as (x: unknown) => number)(v) * m.symbolScale!;
  }
}

/** The series with the style applied; a helper series is returned as it was. */
export function styleSeries(series: Obj, c: SeriesContext): Obj {
  // An icon is changed on every series that draws one (a fill gauge's outline too), so the outline and the fill always match.
  const iconed: Obj = c.st.pictorial?.icon && typeof series["symbol"] === "string" && (series["symbol"] as string).startsWith("path://") ? { ...series, symbol: ICON_PATHS[c.st.pictorial.icon] } : series;
  if (isHelper(iconed)) return iconed;
  const out: Obj = { ...iconed };
  switch (out["type"]) {
    case "bar": styleBar(out, c); break;
    case "line": styleLine(out, c); break;
    case "pie": stylePie(out, c); break;
    case "gauge": styleGauge(out, c); break;
    case "map": case "scatter":
      if (out["coordinateSystem"] === "geo" || out["type"] === "map") styleMap(out, c);
      else if (c.st.points && out["type"] === "scatter") {
        if (c.st.points.symbol !== undefined) out["symbol"] = SYMBOL_NAME[c.st.points.symbol];
        if (c.st.points.size !== undefined && typeof out["symbolSize"] === "number") out["symbolSize"] = c.st.points.size;
      }
      break;
    case "radar": if (c.st.radar?.areaOpacity !== undefined) put(out, "areaStyle", { opacity: c.st.radar.areaOpacity }); break;
    case "funnel":
      if (c.st.funnel?.gap !== undefined) out["gap"] = c.st.funnel.gap;
      if (c.st.funnel?.align) out["funnelAlign"] = c.st.funnel.align.toLowerCase();
      break;
    case "sankey": {
      const f = c.st.flow;
      if (f?.nodeWidth !== undefined) out["nodeWidth"] = f.nodeWidth;
      if (f?.nodeGap !== undefined) out["nodeGap"] = f.nodeGap;
      if (f?.curveness !== undefined) put(out, "lineStyle", { curveness: f.curveness });
      break;
    }
    case "heatmap":
      if (c.st.heat?.cellBorder !== undefined) put(out, "itemStyle", { borderWidth: c.st.heat.cellBorder ? 1 : 0, ...(c.st.heat.cellBorder ? { borderColor: R.surface } : {}) });
      break;
    default: break;
  }
  styleLabel(out, c);
  styleEffects(out, c);
  styleMarks(out, c);
  return out;
}
