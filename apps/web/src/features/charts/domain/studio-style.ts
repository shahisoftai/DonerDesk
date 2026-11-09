/**
 * The Chart Studio's style editing with no React in it (Phase 47.4): which options a chart type offers, reading and writing one option on
 * the spec (an empty option is removed, never stored as ""), resetting a group, and which group a click on the picture belongs to.
 * What an option is, its range and its scope are the domain's table (`STYLE_FIELDS`); nothing here restates them.
 */
import type { ChartSpecV2 } from "@donordesk/domain/contexts/reporting/chart-spec-v2.js";
import { STYLE_FIELDS, STYLE_GROUPS, inScope, validateChartStyle, type ChartStyle, type StyleField, type StyleGaugeBand, type StyleGroup } from "@donordesk/domain/contexts/reporting/chart-style.js";

export interface StyleGroupView { group: StyleGroup; label: string; fields: StyleField[] }

/** The groups of options a chart type offers, in the Studio's order; a group with nothing that applies is not listed. */
export function groupsFor(kind: ChartSpecV2["kind"]): StyleGroupView[] {
  return STYLE_GROUPS.flatMap(({ group, label }) => {
    const fields = STYLE_FIELDS.filter((f) => f.path.startsWith(`${group}.`) && inScope(f.scope, kind));
    return fields.length > 0 || (group === "gauge" && inScope("GAUGE", kind)) ? [{ group, label, fields }] : [];
  });
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function styleValue(spec: ChartSpecV2, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (isRecord(o) ? o[k] : undefined), spec.style);
}

const prune = (o: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    const x = isRecord(v) ? prune(v) : v;
    if (x === undefined || (isRecord(x) && Object.keys(x).length === 0) || (typeof x === "number" && Number.isNaN(x)) || x === "") continue;
    out[k] = x;
  }
  return out;
};

/** The spec with one option set (or cleared when `value` is undefined, empty or not a number); a style with nothing left is removed. */
export function withStyleValue(spec: ChartSpecV2, path: string, value: unknown): ChartSpecV2 {
  const [group, key] = path.split(".") as [string, string];
  const style = { ...(spec.style ?? {}) } as Record<string, unknown>;
  style[group] = { ...(isRecord(style[group]) ? style[group] as Record<string, unknown> : {}), [key]: value };
  const clean = prune(style) as ChartStyle;
  const { style: _old, ...without } = spec;
  void _old;
  return Object.keys(clean).length > 0 ? { ...without, style: clean } : without;
}

export function resetGroup(spec: ChartSpecV2, group: StyleGroup): ChartSpecV2 {
  const { [group]: _drop, ...rest } = (spec.style ?? {}) as Record<string, unknown>;
  void _drop;
  const { style: _old, ...without } = spec;
  void _old;
  return Object.keys(rest).length > 0 ? { ...without, style: rest as ChartStyle } : without;
}

export function resetStyle(spec: ChartSpecV2): ChartSpecV2 {
  const { style: _old, ...without } = spec;
  void _old;
  return without;
}

export function withBands(spec: ChartSpecV2, bands: StyleGaugeBand[]): ChartSpecV2 {
  return withStyleValue(spec, "gauge.bands", bands.length > 0 ? bands : undefined);
}

/** How many options a group has set (shown beside its name). */
export function changedIn(spec: ChartSpecV2, group: StyleGroup): number {
  const v = (spec.style as Record<string, unknown> | undefined)?.[group];
  return isRecord(v) ? Object.keys(v).length : 0;
}

/** "ROUND_RECT" as "Round rect": the words of a choice, until each has its own translation. */
export const humanize = (word: string): string => word.charAt(0) + word.slice(1).toLowerCase().replace(/_/g, " ");

const SERIES_GROUP: Record<string, StyleGroup> = { bar: "bars", line: "lines", pie: "pie", scatter: "points", gauge: "gauge", heatmap: "heat", radar: "radar", funnel: "funnel", sankey: "flow", map: "map", pictorialBar: "pictorial", tree: "labels", graph: "labels" };

/** Which group of options a click on the picture belongs to (null when it is not on anything styled). */
export function groupOfEvent(p: { componentType?: string; seriesType?: string; seriesName?: string; componentSubType?: string }): StyleGroup | null {
  switch (p.componentType) {
    case "title": return "title";
    case "xAxis": return "xAxis";
    case "yAxis": return "yAxis";
    case "legend": return "legend";
    case "visualMap": return "heat";
    case "series":
      if (p.seriesName === "icons" || p.seriesName === "figures") return "pictorial";
      return (p.seriesType && SERIES_GROUP[p.seriesType]) || "effects";
    default: return null;
  }
}

/** The option with the clickable parts switched on (screen only): the title and the axes report a click, so the Studio can open their options. */
export function withClickTargets(option: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...option };
  const mark = (v: unknown): unknown => (Array.isArray(v) ? v.map(mark) : isRecord(v) ? { ...v, triggerEvent: true } : v);
  if (isRecord(out["title"])) out["title"] = { ...out["title"], triggerEvent: true };
  if (out["xAxis"] !== undefined) out["xAxis"] = mark(out["xAxis"]);
  if (out["yAxis"] !== undefined) out["yAxis"] = mark(out["yAxis"]);
  return out;
}

/** Back to the product's own look: the style and a theme's colours are removed (a named palette the person chose stays). */
export function resetLook(spec: ChartSpecV2): ChartSpecV2 {
  const { style: _s, paletteId, ...rest } = spec;
  void _s;
  return paletteId !== undefined && !paletteId.startsWith("preset:") ? { ...rest, paletteId } : rest;
}

/**
 * The spec with the style groups the chart type cannot use taken out, so changing the type never leaves a style that cannot be saved
 * (bar settings on a pie). The options are removed, not remembered: choosing the old type again starts from the defaults for those groups.
 */
export function pruneStyleForKind(spec: ChartSpecV2): ChartSpecV2 {
  if (!spec.style) return spec;
  const refused = new Set(validateChartStyle(spec.style, spec.kind).filter((p) => p.code === "STYLE_NOT_FOR_KIND").map((p) => p.path.replace(/^style\./, "")));
  if (refused.size === 0) return spec;
  const kept = Object.fromEntries(Object.entries(spec.style).filter(([group]) => !refused.has(group))) as ChartStyle;
  const { style: _old, ...without } = spec;
  void _old;
  return Object.keys(kept).length > 0 ? { ...without, style: kept } : without;
}
