import { NOT_MEASURED } from "./data-tables.js";
import { splitEmbeddedTitle } from "./chart-theme-roles.js";

/**
 * How a chart is made ready for a live tile (Phase 39.5). The builder draws for every use (screen, report, export); a tile then:
 * drops the title the tile already shows, gives the space it held back to the plot, and, for a few lines, names each line at its
 * end instead of keeping a legend apart. Pure and applied only by screens, so reports and exports are unchanged.
 */

/** A line chart with this many series or fewer is labelled at the end of each line. */
export const DIRECT_LABEL_MAX_SERIES = 4;
export const DIRECT_LABEL_RIGHT_SPACE = 96;
const TOP_WITH_TITLE = 48;
const TOP_WITHOUT_TITLE = 16;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => v !== null && typeof v === "object" && !Array.isArray(v);

export function lineEndsLabellable(option: Obj): boolean {
  const series = option["series"];
  if (!Array.isArray(series)) return false;
  const real = series.filter((s): s is Obj => isObj(s) && s["type"] === "line");
  return real.length >= 2 && real.length <= DIRECT_LABEL_MAX_SERIES && real.length === series.length
    && real.every((s) => !isObj(s["lineStyle"]) || (s["lineStyle"] as Obj)["width"] !== 0);
}

/** A category axis with this many labels or fewer shows every label (a narrow tile otherwise drops some, and a bar loses its name). */
export const SHOW_ALL_LABELS_MAX = 12;

const showEveryLabel = (axis: unknown): unknown => {
  const one = (a: unknown): unknown => {
    if (!isObj(a) || a["type"] !== "category" || !Array.isArray(a["data"]) || (a["data"] as unknown[]).length > SHOW_ALL_LABELS_MAX) return a;
    const label = isObj(a["axisLabel"]) ? (a["axisLabel"] as Obj) : {};
    return { ...a, axisLabel: { ...label, interval: 0, hideOverlap: false, width: 90, overflow: "break" } };
  };
  return Array.isArray(axis) ? axis.map(one) : one(axis);
};

export function forScreen(option: Obj): { option: Obj; subtitle: string | undefined } {
  const { option: untitled, subtitle } = splitEmbeddedTitle(option);
  const next: Obj = { ...untitled };
  if ("xAxis" in next) next["xAxis"] = showEveryLabel(next["xAxis"]);
  if ("yAxis" in next) next["yAxis"] = showEveryLabel(next["yAxis"]);
  const grid = next["grid"];
  if (isObj(grid) && typeof grid["top"] === "number" && grid["top"] >= TOP_WITH_TITLE) next["grid"] = { ...grid, top: TOP_WITHOUT_TITLE };
  if (lineEndsLabellable(next)) {
    next["series"] = (next["series"] as Obj[]).map((s) => ({ ...s, endLabel: { show: true, formatter: "{a}", fontWeight: 600 } }));
    next["legend"] = { show: false };
    const g = isObj(next["grid"]) ? next["grid"] : {};
    next["grid"] = { ...g, right: Math.max(typeof g["right"] === "number" ? g["right"] : 0, DIRECT_LABEL_RIGHT_SPACE), bottom: typeof g["bottom"] === "number" ? Math.min(g["bottom"], 40) : 40 };
  }
  return { option: next, subtitle };
}

/** The figures behind a picture, as a table: the same option the chart is drawn from, so the two cannot disagree. */
export interface OptionTable { columns: string[]; rows: string[][]; notMeasured: number }

const cellText = (v: unknown): string | null => {
  const raw = isObj(v) && "value" in v ? (v as Obj)["value"] : v;
  if (raw === null || raw === undefined || raw === "-" || raw === "") return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw.toLocaleString("en-US", { maximumFractionDigits: 6 }) : null;
  return typeof raw === "string" ? raw : null;
};

/**
 * Reads a table out of a chart option: a category axis with series (bars, lines), or a pie's named slices. A gap is "Not measured",
 * never 0. Returns null for pictures that are not a table of values (maps, timelines, heatmaps), so the caller can say so.
 */
export function optionToTable(option: Obj): OptionTable | null {
  const series = Array.isArray(option["series"]) ? (option["series"] as unknown[]).filter(isObj) : [];
  if (series.length === 0) return null;
  const axisData = (key: string): unknown[] | null => {
    const ax = option[key];
    const a = Array.isArray(ax) ? ax[0] : ax;
    return isObj(a) && a["type"] === "category" && Array.isArray(a["data"]) ? (a["data"] as unknown[]) : null;
  };
  let notMeasured = 0;
  const show = (v: unknown): string => { const t = cellText(v); if (t === null) { notMeasured += 1; return NOT_MEASURED; } return t; };
  const named = series.filter((s) => (s["type"] === "bar" || s["type"] === "line") && Array.isArray(s["data"]) && s["name"] !== "base" && !(isObj(s["itemStyle"]) && (s["itemStyle"] as Obj)["color"] === "transparent"));
  const categories = axisData("xAxis") ?? axisData("yAxis");
  if (categories && named.length > 0) {
    const columns = ["", ...named.map((s, i) => (typeof s["name"] === "string" && s["name"] !== "" ? (s["name"] as string) : `Series ${i + 1}`))];
    const rows = categories.map((c, r) => [String(c), ...named.map((s) => show((s["data"] as unknown[])[r]))]);
    return { columns, rows, notMeasured };
  }
  const pie = series.find((s) => (s["type"] === "pie" || s["type"] === "funnel") && Array.isArray(s["data"]));
  if (pie) {
    const rows = (pie["data"] as unknown[]).filter(isObj).map((d) => [typeof d["name"] === "string" ? (d["name"] as string) : "", show(d["value"])]);
    return { columns: ["", typeof pie["name"] === "string" && pie["name"] !== "" ? (pie["name"] as string) : "Value"], rows, notMeasured };
  }
  return null;
}
