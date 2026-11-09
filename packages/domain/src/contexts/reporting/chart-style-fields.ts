import type { ChartKind } from "./chart-spec-v2.js";
import type { StyleGroup } from "./chart-style-types.js";

/**
 * Every option a chart's style offers, as one table (Phase 47): where it lives, what it is called, its range or choices, what the builder
 * draws today and which chart types it applies to. The validator, the Studio's controls and the defaults test all read this table, so an
 * option is added in one place. A choice that could mislead is not here (a cut bar axis, a gap drawn as zero, a rate stacked).
 */

export type StyleScope = "ALL" | "AXES" | "BAR" | "LINE" | "AREA" | "PIE" | "SCATTER" | "GAUGE" | "HEAT" | "MAP" | "RADAR" | "FUNNEL" | "SANKEY" | "MARKS" | "PICTORIAL";

const set = (...k: ChartKind[]): ReadonlySet<ChartKind> => new Set(k);
const BAR_KINDS = set("BAR", "BAR_HORIZONTAL", "BAR_GROUPED", "BAR_STACKED", "BAR_STACKED_100", "LOLLIPOP", "BULLET", "BAR_LINE_COMBO", "WATERFALL", "HISTOGRAM", "RANGE_BAR");
const LINE_KINDS = set("LINE", "STEP_LINE", "AREA", "AREA_STACKED", "SPARKLINE", "DOT_PLOT", "BAR_LINE_COMBO", "SLOPE", "AREA_RANGE");
const union = (...s: ReadonlySet<ChartKind>[]): ReadonlySet<ChartKind> => new Set(s.flatMap((x) => [...x]));

/** The chart types each scope covers; `ALL` is every type. Kinds added later join the scope that fits them. */
export const STYLE_SCOPE_KINDS: Record<Exclude<StyleScope, "ALL">, ReadonlySet<ChartKind>> = {
  BAR: BAR_KINDS,
  LINE: LINE_KINDS,
  AREA: set("AREA", "AREA_STACKED"),
  AXES: union(BAR_KINDS, LINE_KINDS, set("BOX_PLOT", "SCATTER", "BUBBLE", "HEATMAP", "GANTT")),
  PIE: set("PIE", "DONUT", "ROSE"),
  PICTORIAL: set("PICTORIAL_BAR", "FILL_GAUGE"),
  SCATTER: set("SCATTER", "BUBBLE"),
  GAUGE: set("GAUGE"),
  HEAT: set("HEATMAP", "CALENDAR_HEATMAP"),
  MAP: set("CHOROPLETH", "GRADUATED_SYMBOLS"),
  RADAR: set("RADAR"),
  FUNNEL: set("FUNNEL"),
  SANKEY: set("SANKEY"),
  // The highest, lowest, average and latest value of a series: never for a stack (its parts are not a total), a waterfall's steps, a
  // histogram's counts, a bullet or a slope.
  MARKS: set("BAR", "BAR_HORIZONTAL", "BAR_GROUPED", "LOLLIPOP", "BAR_LINE_COMBO", "LINE", "STEP_LINE", "AREA", "DOT_PLOT"),
};

export const inScope = (scope: StyleScope, kind: ChartKind): boolean => scope === "ALL" || STYLE_SCOPE_KINDS[scope].has(kind);

interface Base { path: string; label: string; scope: StyleScope; help?: string }
export type StyleField = Base & (
  | { type: "number"; min: number; max: number; integer?: boolean; default: number | null }
  | { type: "choice"; options: readonly string[]; default: string | null }
  | { type: "flag"; default: boolean | null }
  | { type: "text"; maxLength: number; default: string | null }
);

const num = (path: string, label: string, scope: StyleScope, min: number, max: number, o: { integer?: boolean; default?: number | null; help?: string } = {}): StyleField =>
  ({ path, label, scope, type: "number", min, max, default: o.default ?? null, ...(o.integer !== false ? { integer: true } : {}), ...(o.help ? { help: o.help } : {}) });
const choice = (path: string, label: string, scope: StyleScope, options: readonly string[], o: { default?: string | null; help?: string } = {}): StyleField =>
  ({ path, label, scope, type: "choice", options, default: o.default ?? null, ...(o.help ? { help: o.help } : {}) });
const flag = (path: string, label: string, scope: StyleScope, o: { default?: boolean | null; help?: string } = {}): StyleField =>
  ({ path, label, scope, type: "flag", default: o.default ?? null, ...(o.help ? { help: o.help } : {}) });
const text = (path: string, label: string, scope: StyleScope, maxLength: number, o: { help?: string } = {}): StyleField =>
  ({ path, label, scope, type: "text", maxLength, default: null, ...(o.help ? { help: o.help } : {}) });

const SYMBOLS = ["CIRCLE", "RECT", "ROUND_RECT", "TRIANGLE", "DIAMOND", "NONE"] as const;
const LINE_KIND = ["DEFAULT", "NONE", "SOLID", "DASHED", "DOTTED"] as const;
const EASINGS = ["LINEAR", "CUBIC_OUT", "QUINTIC_OUT", "ELASTIC_OUT", "BOUNCE_OUT"] as const;
export const STYLE_RAMPS = ["DEFAULT", "BLUE", "GREEN", "WARM", "PURPLE", "GREY"] as const;
export const STYLE_TONES = ["NEGATIVE", "NEUTRAL", "POSITIVE"] as const;
export const MAX_GAUGE_BANDS = 5;

const axisFields = (axis: "xAxis" | "yAxis", name: string): StyleField[] => [
  num(`${axis}.labelSize`, `${name}: label size`, "AXES", 8, 32, { default: 12 }),
  num(`${axis}.rotate`, `${name}: label angle`, "AXES", -90, 90, { default: 0 }),
  choice(`${axis}.interval`, `${name}: which labels`, "AXES", ["AUTO", "ALL"], { default: "AUTO", help: "All shows every label, even if they crowd." }),
  num(`${axis}.truncate`, `${name}: longest label`, "AXES", 30, 400, { help: "Longer labels end with …" }),
  num(`${axis}.tickCount`, `${name}: number of steps`, "AXES", 2, 20, { help: "A suggestion: the chart rounds to tidy values." }),
  flag(`${axis}.showTicks`, `${name}: tick marks`, "AXES", { default: false }),
  flag(`${axis}.showLine`, `${name}: axis line`, "AXES", { default: false }),
  choice(`${axis}.gridlines`, `${name}: gridlines`, "AXES", LINE_KIND, { default: "DEFAULT" }),
  flag(`${axis}.bands`, `${name}: alternating bands`, "AXES", { default: false }),
  text(`${axis}.prefix`, `${name}: before each value`, "AXES", 8, { help: "For example a currency sign." }),
  text(`${axis}.suffix`, `${name}: after each value`, "AXES", 8, { help: "For example a unit." }),
  num(`${axis}.nameSize`, `${name}: title size`, "AXES", 8, 32, { default: 12 }),
  num(`${axis}.nameGap`, `${name}: title distance`, "AXES", 10, 80, { default: 38 }),
];

/** Every option, in the order the Studio shows them. */
export const STYLE_FIELDS: ReadonlyArray<StyleField> = [
  num("text.size", "Base text size", "ALL", 8, 32, { default: 12 }),
  choice("frame.background", "Background", "ALL", ["NONE", "SURFACE", "TINT"], { default: "NONE", help: "None lets the page show through; tint is a soft wash." }),

  choice("title.align", "Title alignment", "ALL", ["LEFT", "CENTER", "RIGHT"], { default: "CENTER" }),
  num("title.size", "Title size", "ALL", 8, 48, { default: 14 }),
  choice("title.weight", "Title weight", "ALL", ["NORMAL", "BOLD"], { default: "BOLD" }),
  choice("title.position", "Title position", "ALL", ["TOP", "BOTTOM"], { default: "TOP" }),
  num("title.subtitleSize", "Subtitle size", "ALL", 8, 32, { default: 12 }),

  num("grid.left", "Space on the left", "AXES", 0, 200, { default: 56 }),
  num("grid.right", "Space on the right", "AXES", 0, 200, { default: 24 }),
  num("grid.top", "Space above", "AXES", 0, 200, { default: 56 }),
  num("grid.bottom", "Space below", "AXES", 0, 200, { default: 40 }),

  num("axisLabels.size", "Both axes: label size", "AXES", 8, 32, { default: 12 }),
  num("axisLabels.rotate", "Both axes: label angle", "AXES", -90, 90, { default: 0 }),
  ...axisFields("xAxis", "Horizontal axis"),
  ...axisFields("yAxis", "Vertical axis"),

  num("bars.width", "Bar width", "BAR", 2, 120),
  num("bars.gap", "Space between bars", "BAR", 0, 100),
  num("bars.radius", "Rounded ends", "BAR", 0, 24, { default: 0, help: "Not applied to stacked bars." }),
  flag("bars.gradient", "Fade the colour", "BAR", { default: false }),
  flag("bars.track", "Show the full bar behind", "BAR", { default: false }),
  num("bars.borderWidth", "Bar outline", "BAR", 0, 6, { default: 0 }),

  num("lines.width", "Line width", "LINE", 1, 12, { integer: false, default: 2 }),
  flag("lines.smooth", "Smooth curves", "LINE", { default: false, help: "A smoothed line can swing past the recorded values; leave it off for exact figures." }),
  choice("lines.symbol", "Point shape", "LINE", SYMBOLS, { default: "CIRCLE" }),
  num("lines.symbolSize", "Point size", "LINE", 2, 30, { default: 4 }),
  choice("lines.showSymbols", "Show points", "LINE", ["AUTO", "ALWAYS", "NEVER"], { default: "AUTO" }),
  flag("lines.roundCaps", "Round line ends", "LINE", { default: false }),
  num("area.opacity", "Area fill strength", "AREA", 0.05, 1, { integer: false, default: 0.25 }),
  flag("area.fade", "Fade the area downward", "AREA", { default: false }),

  num("pie.innerRadius", "Hole size", "PIE", 0, 90),
  num("pie.outerRadius", "Pie size", "PIE", 20, 100),
  num("pie.startAngle", "Start angle", "PIE", 0, 360, { default: 90 }),
  flag("pie.clockwise", "Clockwise", "PIE", { default: true }),
  choice("pie.rose", "Rose (radius shows the value)", "PIE", ["NONE", "RADIUS", "AREA"], { default: "NONE", help: "Rose charts suit counts only." }),
  num("pie.sliceGap", "Gap between slices", "PIE", 0, 8, { default: 2 }),
  num("pie.sliceRadius", "Rounded slices", "PIE", 0, 20, { default: 0 }),
  num("pie.minAngle", "Smallest slice angle", "PIE", 0, 30, { default: 0 }),
  flag("pie.labelLines", "Lines from slices to labels", "PIE", { default: true }),

  choice("pictorial.icon", "Icon", "PICTORIAL", ["PERSON", "HOUSE", "DROP", "CIRCLE", "SQUARE"], { help: "The same icon is drawn on screen and in a file." }),
  choice("points.symbol", "Point shape", "SCATTER", SYMBOLS, { default: "CIRCLE" }),
  num("points.size", "Point size", "SCATTER", 4, 40, { default: 11, help: "A bubble chart sizes points by value." }),

  num("labels.size", "Label size", "ALL", 8, 32, { default: 12 }),
  choice("labels.weight", "Label weight", "ALL", ["NORMAL", "BOLD"], { default: "NORMAL" }),
  choice("labels.position", "Label position", "ALL", ["AUTO", "TOP", "BOTTOM", "LEFT", "RIGHT", "INSIDE", "OUTSIDE"], { default: "AUTO", help: "Where a position does not suit the chart type it is ignored." }),
  num("labels.rotate", "Label angle", "ALL", -90, 90, { default: 0 }),
  flag("labels.hideOverlap", "Hide labels that overlap", "ALL", { default: false }),

  choice("legend.icon", "Legend symbol", "ALL", ["CIRCLE", "RECT", "ROUND_RECT", "TRIANGLE", "DIAMOND"], { default: "ROUND_RECT" }),
  num("legend.size", "Legend text size", "ALL", 8, 32, { default: 12 }),
  choice("legend.orient", "Legend direction", "ALL", ["HORIZONTAL", "VERTICAL"]),
  num("legend.gap", "Space between legend items", "ALL", 0, 40, { default: 10 }),
  choice("legend.mode", "Long legends", "ALL", ["PLAIN", "SCROLL"], { default: "SCROLL" }),
  flag("legend.selectable", "Click a legend item to hide it", "ALL", { default: true }),

  choice("tooltip.trigger", "Hover shows", "ALL", ["AUTO", "ITEM", "AXIS"], { default: "AUTO", help: "Axis shows every series at that point." }),
  choice("tooltip.pointer", "Hover guide", "AXES", ["NONE", "LINE", "SHADOW", "CROSS"], { default: "LINE" }),
  num("tooltip.size", "Hover text size", "ALL", 8, 24, { default: 12 }),
  flag("tooltip.confine", "Keep the hover box inside the chart", "ALL", { default: false }),

  flag("marks.max", "Mark the highest value", "MARKS", { default: false }),
  flag("marks.min", "Mark the lowest value", "MARKS", { default: false }),
  flag("marks.average", "Draw the average", "MARKS", { default: false }),
  flag("marks.latest", "Mark the latest value", "MARKS", { default: false }),

  flag("effects.shadow", "Soft shadow", "ALL", { default: false }),
  num("effects.opacity", "Mark strength", "ALL", 0.2, 1, { integer: false, default: 1 }),
  choice("effects.hover", "On hover, highlight", "ALL", ["SERIES", "SELF", "NONE"], { default: "SERIES" }),
  flag("effects.decals", "Patterns as well as colour", "ALL", { default: false, help: "Helps readers who cannot tell colours apart, and black-and-white print." }),

  num("gauge.width", "Dial thickness", "GAUGE", 4, 40, { default: 14 }),
  num("gauge.startAngle", "Dial start angle", "GAUGE", -360, 360, { default: 225 }),
  num("gauge.endAngle", "Dial end angle", "GAUGE", -360, 360, { default: -45 }),
  flag("gauge.pointer", "Show the pointer", "GAUGE", { default: true }),
  flag("gauge.ticks", "Show tick marks", "GAUGE", { default: true }),
  flag("gauge.scaleLabels", "Show scale numbers", "GAUGE", { default: true }),
  num("gauge.detailSize", "Figure size", "GAUGE", 10, 60, { default: 24 }),

  choice("heat.ramp", "Colour ramp", "HEAT", STYLE_RAMPS, { default: "DEFAULT" }),
  num("heat.steps", "Colour steps", "HEAT", 0, 9, { default: 0, help: "0 is a smooth scale; otherwise 3 to 9 bands." }),
  flag("heat.cellBorder", "Cell borders", "HEAT", { default: false }),
  flag("heat.showScale", "Show the colour scale", "HEAT", { default: true }),

  choice("radar.shape", "Web shape", "RADAR", ["POLYGON", "CIRCLE"], { default: "POLYGON" }),
  num("radar.areaOpacity", "Area fill strength", "RADAR", 0, 1, { integer: false, default: 0.2 }),

  num("funnel.gap", "Gap between steps", "FUNNEL", 0, 20, { default: 0 }),
  choice("funnel.align", "Alignment", "FUNNEL", ["LEFT", "CENTER", "RIGHT"], { default: "CENTER" }),

  num("flow.nodeWidth", "Node width", "SANKEY", 8, 40, { default: 20 }),
  num("flow.nodeGap", "Space between nodes", "SANKEY", 4, 30, { default: 8 }),
  num("flow.curveness", "Curve of the flows", "SANKEY", 0, 1, { integer: false, default: 0.5 }),

  flag("map.borders", "Region borders", "MAP", { default: true }),
  num("map.borderWidth", "Border thickness", "MAP", 0.5, 3, { integer: false, default: 0.5 }),
  flag("map.labels", "Region names", "MAP", { default: false }),
  num("map.opacity", "Symbol strength", "MAP", 0.2, 1, { integer: false, default: 0.7 }),
  num("map.symbolScale", "Symbol size", "MAP", 0.5, 2, { integer: false, default: 1 }),
  flag("map.roam", "Allow zoom and drag", "MAP", { default: true }),

  choice("interaction.zoom", "Zoom bar (screen only)", "AXES", ["NONE", "SLIDER", "INSIDE", "BOTH"], { default: "NONE" }),
  flag("interaction.toolbox", "Save-as-picture button (screen only)", "ALL", { default: false }),

  flag("animation.enabled", "Animate", "ALL", { default: true }),
  num("animation.duration", "Animation length (ms)", "ALL", 0, 3000, { default: 300 }),
  choice("animation.easing", "Animation style", "ALL", EASINGS, { default: "CUBIC_OUT" }),
  num("animation.stagger", "Delay between marks (ms, screen only)", "ALL", 0, 200, { default: 0 }),
];

export const STYLE_FIELD_BY_PATH: ReadonlyMap<string, StyleField> = new Map(STYLE_FIELDS.map((f) => [f.path, f]));

/** The groups of the style block in the order the Studio lists them, with the plain name of each. */
export const STYLE_GROUPS: ReadonlyArray<{ group: StyleGroup; label: string }> = [
  { group: "text", label: "Text" }, { group: "frame", label: "Background" }, { group: "title", label: "Title" }, { group: "grid", label: "Plot area" },
  { group: "axisLabels", label: "Axes (both)" }, { group: "xAxis", label: "Horizontal axis" }, { group: "yAxis", label: "Vertical axis" },
  { group: "bars", label: "Bars" }, { group: "lines", label: "Lines" }, { group: "area", label: "Areas" }, { group: "pie", label: "Pie and donut" }, { group: "pictorial", label: "Icons" }, { group: "points", label: "Points" },
  { group: "labels", label: "Labels" }, { group: "legend", label: "Legend" }, { group: "tooltip", label: "Hover box" }, { group: "marks", label: "Marked values" },
  { group: "effects", label: "Effects" }, { group: "gauge", label: "Gauge" }, { group: "heat", label: "Heat colours" }, { group: "radar", label: "Radar" },
  { group: "funnel", label: "Funnel" }, { group: "flow", label: "Flow" }, { group: "map", label: "Map" }, { group: "interaction", label: "Interaction" }, { group: "animation", label: "Animation" },
];
