/**
 * Value labels on every chart that can honestly carry them (Phase 61.10). A chart's `labels` setting (show, what to show, number format)
 * was honoured by the builders of only some kinds (bars, lines, areas, pies, funnels); the rest ignored it. This one pass runs on the
 * finished option, once, and gives every series of a kind that draws values (histogram, scatter, bubble, waterfall, map regions, treemap,
 * sunburst, sankey links…) the label the person asked for. It adds a label only where there is none, never repaints a helper series (a
 * hidden base, a track) and never touches a kind that already writes its own figure (gauge, ring, progress bar, pictorial bar, waffle) or
 * has no single value to write (box plot, radar, parallel coordinates, range bands, schedules).
 * A label that a file must keep is a plain template (`{c}`), because exports clone the option as data; a number format other than the full
 * figure needs a function and so shows on screen.
 */
import { formatChartNumber } from "./chart-render.js";
import { isHelper } from "./chart-style-series.js";
import type { ChartKind, ChartSpecV2 } from "./chart-spec-v2.js";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

/** Kinds that write their own figure, or have no single value to write: their labels are never added. */
export const NO_VALUE_LABELS: ReadonlySet<ChartKind> = new Set<ChartKind>([
  "GAUGE", "PROGRESS_RING", "PROGRESS_BAR", "FILL_GAUGE", "KPI_NUMBER", "MULTI_RING", "WAFFLE", "PICTORIAL_BAR", "GANTT", "CALENDAR_HEATMAP", "BOX_PLOT", "PARALLEL", "RADAR",
  "THEME_RIVER", "TREE", "AREA_RANGE", "RANGE_BAR", "NETWORK", "VIOLIN", "BEESWARM", "RIDGELINE", "ALLUVIAL", "CHORD", "FLOW_MAP", "BIVARIATE_MAP", "HEX_GRID", "DOT_DENSITY", "PIVOT_TABLE", "SCORECARD_TABLE",
]);

const VALUE_TYPES: ReadonlySet<string> = new Set(["bar", "line", "scatter", "effectScatter", "treemap", "sunburst", "map"]);

export function applyValueLabels(option: Obj, spec: Pick<ChartSpecV2, "labels" | "kind">): Obj {
  const l = spec.labels;
  if (!l?.show || NO_VALUE_LABELS.has(spec.kind) || !Array.isArray(option["series"])) return option;
  const numberFormat = l.numberFormat ?? "FULL";
  const plain = numberFormat === "FULL";
  const template = l.format === "NAME" ? "{b}" : l.format === "NAME_VALUE" ? "{b}: {c}" : "{c}";
  const num = (raw: unknown): string => (typeof raw === "number" ? formatChartNumber(raw, numberFormat) : "");
  const pair = spec.kind === "SCATTER" || spec.kind === "BUBBLE";
  const fn = (p: { value?: unknown; name?: string }): string => {
    const arr = Array.isArray(p.value) ? p.value : undefined;
    // A scatter point is [x, y, size, name]: both figures are the value, and the last entry is a name. A dumbbell dot is [figure, row]: the figure is the first.
    const nameOf = pair && arr && typeof arr[3] === "string" ? arr[3] : (p.name ?? "");
    const v = pair && arr ? `${num(arr[0])}, ${num(arr[1])}` : arr ? (spec.kind === "DUMBBELL" ? num(arr[0]) : num(arr[arr.length - 1])) : num(p.value);
    return l.format === "NAME" ? nameOf : l.format === "NAME_VALUE" ? `${nameOf}: ${v}` : v;
  };
  let changed = false;
  const series = (option["series"] as unknown[]).map((raw) => {
    if (!isObj(raw)) return raw;
    const type = String(raw["type"] ?? "");
    if (isHelper(raw)) return raw;
    if (type === "sankey") {
      if (isObj(raw["edgeLabel"]) && (raw["edgeLabel"] as Obj)["show"] === true) return raw;
      changed = true;
      return { ...raw, edgeLabel: { show: true, formatter: plain ? "{c}" : fn } };
    }
    if (!VALUE_TYPES.has(type)) return raw;
    // A dumbbell writes its two figures at the dots; the bar between them is the span and would be struck through by a third number.
    if (spec.kind === "DUMBBELL" && type === "bar") return raw;
    // A point series is labelled only where its value is known: a scatter or bubble (x and y) and a dumbbell's dots (the figure).
    if ((type === "scatter" || type === "effectScatter") && spec.kind !== "SCATTER" && spec.kind !== "BUBBLE" && spec.kind !== "DUMBBELL") return raw;
    const own = raw["label"];
    if (isObj(own) && own["show"] === true) return raw;
    changed = true;
    // A scatter's value is a pair; the figure is its last number, which only a function can pick.
    const needsFn = !plain || type === "scatter" || type === "effectScatter";
    // A point is a mark; its figure sits above it, not on it (the style's own position, where set, replaces this).
    const point = type === "scatter" || type === "effectScatter";
    return { ...raw, label: { ...(isObj(own) ? own : {}), show: true, ...(point ? { position: "top", distance: 6 } : {}), formatter: needsFn ? fn : template } };
  });
  return changed ? { ...option, series } : option;
}
