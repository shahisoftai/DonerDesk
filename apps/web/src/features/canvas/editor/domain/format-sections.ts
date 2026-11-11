/**
 * The Format tab of the edit drawer as data (Phase 50.2): one section per formatting capability, each a list of fields with a path
 * inside that capability's settings. The drawer draws whatever a row says and never names a block kind; which sections a block shows
 * comes from the domain (`formatsOf`), so a block that does not offer a capability never shows its section.
 */
import { FORMAT_CAPABILITIES, DISPLAY_UNITS, SIDES, TEXT_ALIGNMENTS, TOTAL_FUNCTIONS, type FormatCapability } from "@donordesk/domain/contexts/canvas/index.js";

export type FormatField =
  | { type: "toggle"; path: string; labelKey: string; defaultValue?: boolean }
  | { type: "select"; path: string; labelKey: string; options: ReadonlyArray<{ value: string; labelKey: string }>; defaultValue?: string }
  | { type: "number"; path: string; labelKey: string; min: number; max: number; step?: number; defaultValue?: number }
  | { type: "slider"; path: string; labelKey: string; min: number; max: number; defaultValue: number }
  | { type: "text"; path: string; labelKey: string; max: number }
  | { type: "color"; path: string; labelKey: string }
  | { type: "padding"; path: string; labelKey: string }
  | { type: "conditional"; path: string; labelKey: string }
  | { type: "columns"; path: string; labelKey: string }
  | { type: "indicators"; path: string; labelKey: string; max: number };

export interface FormatSection { capability: FormatCapability; labelKey: string; fields: readonly FormatField[] }

const opt = (values: readonly string[], prefix: string) => values.map((value) => ({ value, labelKey: `${prefix}.${value}` }));
const SIZES_TITLE = ["S", "M", "L", "XL"] as const;
const SIZES_CALLOUT = ["M", "L", "XL", "XXL"] as const;

export const FORMAT_SECTIONS: Readonly<Record<FormatCapability, FormatSection>> = {
  title: { capability: "title", labelKey: "format.title", fields: [
    { type: "toggle", path: "show", labelKey: "format.f.showTitle", defaultValue: true },
    { type: "text", path: "subtitle", labelKey: "format.f.subtitle", max: 120 },
    { type: "select", path: "size", labelKey: "format.f.size", options: opt(SIZES_TITLE, "format.size"), defaultValue: "M" },
    { type: "select", path: "weight", labelKey: "format.f.weight", options: opt(["regular", "bold"], "format.weight"), defaultValue: "bold" },
    { type: "color", path: "color", labelKey: "format.f.color" },
    { type: "select", path: "align", labelKey: "format.f.align", options: opt(TEXT_ALIGNMENTS, "format.align"), defaultValue: "start" },
    { type: "toggle", path: "rule", labelKey: "format.f.rule" },
  ] },
  frame: { capability: "frame", labelKey: "format.frame", fields: [
    { type: "select", path: "borderSide", labelKey: "format.f.borderSide", options: opt(["all", ...SIDES], "format.side") },
    { type: "slider", path: "borderWidth", labelKey: "format.f.borderWidth", min: 1, max: 8, defaultValue: 1 },
    { type: "color", path: "borderColor", labelKey: "format.f.borderColor" },
    { type: "padding", path: "padding", labelKey: "format.f.padding" },
  ] },
  accentBar: { capability: "accentBar", labelKey: "format.accentBar", fields: [
    { type: "toggle", path: "show", labelKey: "format.f.showAccent" },
    { type: "select", path: "side", labelKey: "format.f.side", options: opt(SIDES, "format.side"), defaultValue: "start" },
    { type: "slider", path: "thickness", labelKey: "format.f.thickness", min: 2, max: 12, defaultValue: 6 },
    { type: "color", path: "color", labelKey: "format.f.color" },
  ] },
  numbers: { capability: "numbers", labelKey: "format.numbers", fields: [
    { type: "select", path: "units", labelKey: "format.f.units", options: opt(DISPLAY_UNITS, "format.units"), defaultValue: "AUTO" },
    { type: "number", path: "decimals", labelKey: "format.f.decimals", min: 0, max: 4 },
    { type: "text", path: "prefix", labelKey: "format.f.prefix", max: 6 },
    { type: "text", path: "suffix", labelKey: "format.f.suffix", max: 12 },
    { type: "toggle", path: "separators", labelKey: "format.f.separators", defaultValue: true },
    { type: "select", path: "negative", labelKey: "format.f.negative", options: opt(["minus", "parentheses"], "format.negative"), defaultValue: "minus" },
  ] },
  callout: { capability: "callout", labelKey: "format.callout", fields: [
    { type: "select", path: "size", labelKey: "format.f.size", options: opt(SIZES_CALLOUT, "format.size"), defaultValue: "L" },
    { type: "select", path: "weight", labelKey: "format.f.weight", options: opt(["regular", "bold"], "format.weight"), defaultValue: "bold" },
    { type: "color", path: "color", labelKey: "format.f.color" },
    { type: "select", path: "labelPosition", labelKey: "format.f.labelPosition", options: opt(["below", "above", "start"], "format.labelPos"), defaultValue: "below" },
    { type: "color", path: "labelColor", labelKey: "format.f.labelColor" },
  ] },
  referenceLabels: { capability: "referenceLabels", labelKey: "format.referenceLabels", fields: [
    { type: "toggle", path: "show", labelKey: "format.f.showReference", defaultValue: true },
    { type: "select", path: "layout", labelKey: "format.f.layout", options: opt(["row", "column"], "format.layout"), defaultValue: "row" },
    { type: "toggle", path: "divider", labelKey: "format.f.divider" },
    { type: "color", path: "color", labelKey: "format.f.color" },
  ] },
  labels: { capability: "labels", labelKey: "format.labels", fields: [
    { type: "toggle", path: "show", labelKey: "format.f.showLabels", defaultValue: true },
    { type: "select", path: "position", labelKey: "format.f.position", options: opt(["auto", "inside", "outside"], "format.pos"), defaultValue: "auto" },
    { type: "select", path: "density", labelKey: "format.f.density", options: opt(["auto", "all", "none"], "format.density"), defaultValue: "auto" },
    { type: "select", path: "size", labelKey: "format.f.size", options: opt(["S", "M", "L"], "format.size"), defaultValue: "M" },
  ] },
  legend: { capability: "legend", labelKey: "format.legend", fields: [
    { type: "toggle", path: "show", labelKey: "format.f.showLegend", defaultValue: true },
    { type: "select", path: "position", labelKey: "format.f.position", options: opt(["top", "bottom", "start", "end"], "format.side"), defaultValue: "bottom" },
    { type: "text", path: "title", labelKey: "format.f.legendTitle", max: 60 },
  ] },
  colors: { capability: "colors", labelKey: "format.colors", fields: [{ type: "color", path: "series.0", labelKey: "format.f.series1" }, { type: "color", path: "series.1", labelKey: "format.f.series2" }, { type: "color", path: "series.2", labelKey: "format.f.series3" }] },
  conditional: { capability: "conditional", labelKey: "format.conditional", fields: [{ type: "conditional", path: "rules", labelKey: "format.f.rules" }] },
  table: { capability: "table", labelKey: "format.table", fields: [
    { type: "select", path: "gridlines", labelKey: "format.f.gridlines", options: opt(["none", "horizontal", "both"], "format.grid"), defaultValue: "horizontal" },
    { type: "toggle", path: "banded", labelKey: "format.f.banded" },
    { type: "color", path: "headerFill", labelKey: "format.f.headerFill" },
    { type: "toggle", path: "wrap", labelKey: "format.f.wrap" },
    { type: "toggle", path: "stickyHeader", labelKey: "format.f.stickyHeader" },
    { type: "columns", path: "columns", labelKey: "format.f.columns" },
  ] },
  tooltip: { capability: "tooltip", labelKey: "format.tooltip", fields: [{ type: "toggle", path: "show", labelKey: "format.f.showTooltip", defaultValue: true }, { type: "indicators", path: "indicatorIds", labelKey: "format.f.tooltipFigures", max: 6 }] },
  emptyData: { capability: "emptyData", labelKey: "format.emptyData", fields: [{ type: "toggle", path: "showItemsWithNoData", labelKey: "format.f.showNoData" }, { type: "text", path: "message", labelKey: "format.f.emptyMessage", max: 120 }] },
  visibility: { capability: "visibility", labelKey: "format.visibility", fields: [{ type: "toggle", path: "hideOnPhone", labelKey: "format.f.hideOnPhone" }, { type: "toggle", path: "hideOnPrint", labelKey: "format.f.hideOnPrint" }, { type: "toggle", path: "hideOnShareLink", labelKey: "format.f.hideOnShareLink" }] },
};

/** Table column totals offered by the columns field. */
export const COLUMN_TOTALS = TOTAL_FUNCTIONS;
export const ALL_SECTIONS: readonly FormatSection[] = FORMAT_CAPABILITIES.map((c) => FORMAT_SECTIONS[c]);

/** Every message key the Format tab uses: the catalogue test reads this so a missing translation fails. */
export function formatMessageKeys(): string[] {
  const keys = new Set<string>();
  for (const s of ALL_SECTIONS) {
    keys.add(s.labelKey);
    for (const f of s.fields) { keys.add(f.labelKey); if (f.type === "select") for (const o of f.options) keys.add(o.labelKey); }
  }
  return [...keys].sort();
}
