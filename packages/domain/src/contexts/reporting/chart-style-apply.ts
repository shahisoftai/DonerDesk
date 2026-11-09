import type { ChartSpecV2 } from "./chart-spec-v2.js";
import { RAMP_COLOURS, isObj, put, styleSeries, type Obj } from "./chart-style-series.js";
import type { ChartStyle, StyleAxis, StyleEasing, StyleLegendIcon } from "./chart-style-types.js";
import { LIGHT_ROLES as R } from "./chart-theme-roles.js";

/**
 * Applies a chart's style to the option the builder drew (Phase 47). Only what the style names changes; no style (or an empty one)
 * returns the same object, so a chart that never had one is unchanged. Never mutates its input. Pure: no chart library import.
 */

const ICON: Record<StyleLegendIcon, string> = { CIRCLE: "circle", RECT: "rect", ROUND_RECT: "roundRect", TRIANGLE: "triangle", DIAMOND: "diamond" };
const EASING: Record<StyleEasing, string> = { LINEAR: "linear", CUBIC_OUT: "cubicOut", QUINTIC_OUT: "quinticOut", ELASTIC_OUT: "elasticOut", BOUNCE_OUT: "bounceOut" };
const LINE_TYPE = { SOLID: "solid", DASHED: "dashed", DOTTED: "dotted" } as const;
const POINTER = { NONE: "none", LINE: "line", SHADOW: "shadow", CROSS: "cross" } as const;

const compact = (v: Obj): Obj => Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined));

/** One axis with the style applied: the both-axes settings first, then this axis's own. */
function styleAxis(axis: Obj, both: ChartStyle["axisLabels"], own: StyleAxis | undefined): Obj {
  const out: Obj = { ...axis };
  const valued = out["type"] === "value" || out["type"] === "log";
  const label: Obj = { ...(isObj(out["axisLabel"]) ? out["axisLabel"] as Obj : {}) };
  Object.assign(label, compact({ fontSize: own?.labelSize ?? both?.size, rotate: own?.rotate ?? both?.rotate }));
  if (own?.interval === "ALL") { label["interval"] = 0; label["hideOverlap"] = false; }
  if (own?.truncate !== undefined) { label["width"] = own.truncate; label["overflow"] = "truncate"; }
  if ((own?.prefix || own?.suffix) && valued) {
    // A plain template, not a function: it survives where the option travels as data (a dashboard, a file). A figure is then written as the
    // chart library prints it (no thousands separators); an existing template keeps its own text around the value.
    const before = own.prefix ?? "", after = own.suffix ?? "", f = label["formatter"];
    label["formatter"] = typeof f === "string" && f.includes("{value}") ? f.replace("{value}", `${before}{value}${after}`) : `${before}{value}${after}`;
  }
  if (Object.keys(label).length > 0) out["axisLabel"] = label;
  if (own?.tickCount !== undefined && valued) out["splitNumber"] = own.tickCount;
  if (own?.showTicks !== undefined) put(out, "axisTick", { show: own.showTicks });
  if (own?.showLine !== undefined) put(out, "axisLine", { show: own.showLine });
  if (own?.gridlines === "NONE") put(out, "splitLine", { show: false });
  else if (own?.gridlines && own.gridlines !== "DEFAULT") put(out, "splitLine", { show: true, lineStyle: { type: LINE_TYPE[own.gridlines] } });
  if (own?.bands !== undefined) put(out, "splitArea", { show: own.bands });
  if (own?.nameSize !== undefined) put(out, "nameTextStyle", { fontSize: own.nameSize });
  if (own?.nameGap !== undefined && out["name"] !== undefined) out["nameGap"] = own.nameGap;
  return out;
}

function styleAxes(out: Obj, st: ChartStyle): void {
  for (const [key, own] of [["xAxis", st.xAxis], ["yAxis", st.yAxis]] as const) {
    if (!own && !st.axisLabels) continue;
    const v = out[key];
    if (Array.isArray(v)) out[key] = v.map((a) => (isObj(a) ? styleAxis(a, st.axisLabels, own) : a));
    else if (isObj(v)) out[key] = styleAxis(v, st.axisLabels, own);
  }
}

function styleVisualMap(out: Obj, st: ChartStyle): void {
  const h = st.heat;
  if (!h || !out["visualMap"]) return;
  const vm: Obj = { ...(Array.isArray(out["visualMap"]) ? (out["visualMap"] as Obj[])[0] ?? {} : out["visualMap"] as Obj) };
  const ramp = h.ramp && h.ramp !== "DEFAULT" ? RAMP_COLOURS[h.ramp] : undefined;
  if (ramp) vm["inRange"] = { ...(isObj(vm["inRange"]) ? vm["inRange"] as Obj : {}), color: ramp };
  if (h.steps !== undefined) { if (h.steps === 0) { vm["type"] = "continuous"; delete vm["splitNumber"]; } else { vm["type"] = "piecewise"; vm["splitNumber"] = h.steps; vm["calculable"] = false; } }
  if (h.showScale !== undefined) vm["show"] = h.showScale;
  out["visualMap"] = vm;
}

/** The option with the style applied: only what the style names changes. */
export function applyChartStyle(option: Obj, spec: Pick<ChartSpecV2, "style" | "kind">): Obj {
  const st = spec.style;
  if (!st || Object.keys(st).length === 0) return option;
  const out: Obj = { ...option };

  if (st.text?.size !== undefined) put(out, "textStyle", { fontSize: st.text.size });
  if (st.frame?.background === "SURFACE") out["backgroundColor"] = R.surface;
  if (st.frame?.background === "TINT") out["backgroundColor"] = R.rampStart;

  const t = st.title;
  if (t && isObj(out["title"])) {
    const title: Obj = { ...(out["title"] as Obj) };
    put(title, "textStyle", compact({ fontSize: t.size, fontWeight: t.weight === undefined ? undefined : t.weight === "BOLD" ? "bold" : "normal" }));
    if (t.subtitleSize !== undefined) put(title, "subtextStyle", { fontSize: t.subtitleSize });
    if (t.align) title["left"] = t.align.toLowerCase();
    if (t.position === "BOTTOM") { delete title["top"]; title["bottom"] = 4; }
    out["title"] = title;
  }
  if (st.grid && isObj(out["grid"])) put(out, "grid", compact({ left: st.grid.left, right: st.grid.right, top: st.grid.top, bottom: st.grid.bottom }));
  if (t?.position === "BOTTOM") {
    if (isObj(out["grid"]) && typeof (out["grid"] as Obj)["bottom"] === "number" && st.grid?.bottom === undefined) put(out, "grid", { bottom: ((out["grid"] as Obj)["bottom"] as number) + 24 });
    if (isObj(out["legend"]) && (out["legend"] as Obj)["bottom"] === 0) put(out, "legend", { bottom: 24 });
  }
  styleAxes(out, st);

  const kind = spec.kind;
  const horizontal = kind === "BAR_HORIZONTAL";
  const colours = Array.isArray(out["color"]) ? (out["color"] as unknown[]).filter((c): c is string => typeof c === "string") : undefined;
  if (Array.isArray(out["series"])) {
    let n = 0;
    out["series"] = (out["series"] as unknown[]).map((s) => (isObj(s) ? styleSeries(s, { st, kind, horizontal, colours, index: n++ }) : s));
  }
  if (st.radar && isObj(out["radar"]) && st.radar.shape) put(out, "radar", { shape: st.radar.shape.toLowerCase() });
  if (st.map && isObj(out["geo"])) put(out, "geo", compact({ roam: st.map.roam, itemStyle: { ...(isObj((out["geo"] as Obj)["itemStyle"]) ? (out["geo"] as Obj)["itemStyle"] as Obj : {}), ...(st.map.borders === false ? { borderWidth: 0 } : st.map.borderWidth !== undefined ? { borderWidth: st.map.borderWidth } : {}) } }));
  styleVisualMap(out, st);

  const g = st.legend;
  if (g && isObj(out["legend"]) && (out["legend"] as Obj)["show"] !== false) {
    const legend: Obj = { ...(out["legend"] as Obj) };
    if (g.icon) legend["icon"] = ICON[g.icon];
    if (g.size !== undefined) put(legend, "textStyle", { fontSize: g.size });
    if (g.orient) legend["orient"] = g.orient.toLowerCase();
    if (g.gap !== undefined) legend["itemGap"] = g.gap;
    if (g.mode) legend["type"] = g.mode.toLowerCase();
    if (g.selectable === false) legend["selectedMode"] = false;
    out["legend"] = legend;
  }

  const tip = st.tooltip;
  if (tip) {
    const tooltip: Obj = { ...(isObj(out["tooltip"]) ? out["tooltip"] as Obj : {}) };
    if (tip.trigger && tip.trigger !== "AUTO") tooltip["trigger"] = tip.trigger.toLowerCase();
    if (tip.pointer) tooltip["axisPointer"] = { type: POINTER[tip.pointer] };
    if (tip.size !== undefined) put(tooltip, "textStyle", { fontSize: tip.size });
    if (tip.confine !== undefined) tooltip["confine"] = tip.confine;
    out["tooltip"] = tooltip;
  }

  if (st.effects?.decals) out["aria"] = { ...(isObj(out["aria"]) ? out["aria"] as Obj : { enabled: true }), decal: { show: true } };

  const a = st.animation;
  if (a) {
    if (a.enabled === false) out["animation"] = false;
    if (a.duration !== undefined) out["animationDuration"] = a.duration;
    if (a.easing) out["animationEasing"] = EASING[a.easing];
  }
  return out;
}

/**
 * Zoom bars, the save-as-picture button and the delay between marks, which only make sense on a screen: a report or an export never calls this, so it never carries
 * them. Returns the same object when the style asks for neither.
 */
export function applyScreenInteraction(option: Obj, spec: Pick<ChartSpecV2, "style">): Obj {
  const i = spec.style?.interaction;
  const stagger = spec.style?.animation?.stagger;
  const wantsStagger = stagger !== undefined && stagger > 0;
  if ((!i || ((!i.zoom || i.zoom === "NONE") && !i.toolbox)) && !wantsStagger) return option;
  const out: Obj = { ...option };
  // A delay between marks is a function of the mark's place, so it is a screen setting too: a file or a dashboard's data never carries it.
  if (wantsStagger) out["animationDelay"] = (index: number): number => index * stagger;
  if (!i) return out;
  if (i.zoom && i.zoom !== "NONE") {
    const x = isObj(out["xAxis"]) ? out["xAxis"] as Obj : Array.isArray(out["xAxis"]) ? (out["xAxis"] as Obj[])[0] : undefined;
    const alongX = !x || x["type"] === "category" || x["type"] === "time";
    const axis = alongX ? { xAxisIndex: 0 } : { yAxisIndex: 0 };
    const zoom: Obj[] = [];
    if (i.zoom === "SLIDER" || i.zoom === "BOTH") zoom.push({ type: "slider", ...axis, ...(alongX ? { height: 18, bottom: 6 } : { width: 18, right: 6 }) });
    if (i.zoom === "INSIDE" || i.zoom === "BOTH") zoom.push({ type: "inside", ...axis });
    out["dataZoom"] = zoom;
    if (isObj(out["grid"]) && (i.zoom === "SLIDER" || i.zoom === "BOTH")) {
      const g = out["grid"] as Obj;
      out["grid"] = alongX ? { ...g, bottom: Math.max(typeof g["bottom"] === "number" ? g["bottom"] : 0, 64) } : { ...g, right: Math.max(typeof g["right"] === "number" ? g["right"] : 0, 44) };
    }
  }
  if (i.toolbox) out["toolbox"] = { right: 8, top: 4, itemSize: 14, feature: { saveAsImage: { pixelRatio: 2, title: "Save as picture" } } };
  return out;
}
