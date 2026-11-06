/**
 * The Chart Studio's behaviour with no React in it (Phase 34.1): the spec being edited, undo and redo, and the edits that keep a spec
 * valid (choosing a template or a kind never leaves the person with a chart that cannot be drawn). The screen only draws it.
 * One rule per concept: what a chart may be is `CHART_KINDS` / `validateChartSpec` / `buildChart` (domain); nothing here restates it.
 */
import {
  CHART_KIND_ORDER, CHART_KINDS, TEMPLATE_SHAPE, kindsForTemplate,
  type ChartAnnotation, type ChartKind, type ChartSpecV2, type SeriesStyle,
} from "@donordesk/domain/contexts/reporting/chart-spec-v2.js";
import { DATA_CHART_TEMPLATES } from "@donordesk/domain/contexts/reporting/data-charts.js";
import type { DatasetResult } from "@donordesk/domain/contexts/reporting/dataset-query.js";
import type { DataChartTemplate } from "@donordesk/domain/contexts/reporting/data-charts.js";

/** The data templates the studio offers: the finance templates are drawn from the Data Center for now. */
export const STUDIO_TEMPLATES: readonly DataChartTemplate[] = (Object.keys(DATA_CHART_TEMPLATES) as DataChartTemplate[]).filter((t) => TEMPLATE_SHAPE[t] !== null);

export const MAX_UNDO = 50;

export interface StudioState { spec: ChartSpecV2; past: ChartSpecV2[]; future: ChartSpecV2[] }

const same = (a: ChartSpecV2, b: ChartSpecV2): boolean => JSON.stringify(a) === JSON.stringify(b);

/** A first chart: the first indicator over time as bars, period values, drafts shown (and flagged). */
export function initialSpec(indicatorIds: ReadonlyArray<string>): ChartSpecV2 {
  return { version: 2, kind: "BAR", dataset: { template: "INDICATOR_OVER_TIME", indicatorIds: indicatorIds.slice(0, 1), measure: "PERIOD", showTarget: false, includeDraft: true } };
}

export const startStudio = (spec: ChartSpecV2): StudioState => ({ spec, past: [], future: [] });

/** One edit is one undo step; an edit that changes nothing is not a step. */
export function applyEdit(state: StudioState, next: ChartSpecV2): StudioState {
  if (same(state.spec, next)) return state;
  return { spec: next, past: [...state.past, state.spec].slice(-MAX_UNDO), future: [] };
}
export function undo(state: StudioState): StudioState {
  const prev = state.past[state.past.length - 1];
  return prev ? { spec: prev, past: state.past.slice(0, -1), future: [state.spec, ...state.future] } : state;
}
export function redo(state: StudioState): StudioState {
  const next = state.future[0];
  return next ? { spec: next, past: [...state.past, state.spec], future: state.future.slice(1) } : state;
}

/* ---------- edits that keep the spec valid ---------- */

/** The first kind that suits the data, preferring the current kind's family. */
function suitableKind(spec: ChartSpecV2, template: DataChartTemplate): ChartKind {
  const kinds = kindsForTemplate(template);
  if (kinds.includes(spec.kind)) return spec.kind;
  const family = CHART_KINDS[spec.kind]?.family;
  return kinds.find((k) => CHART_KINDS[k].family === family) ?? kinds[0] ?? "BAR";
}

/** Chooses what data the chart is drawn from: the indicator count fits the template, the kind fits the data, the rest is kept. */
export function withTemplate(spec: ChartSpecV2, template: DataChartTemplate, allIndicatorIds: ReadonlyArray<string>): ChartSpecV2 {
  const info = DATA_CHART_TEMPLATES[template];
  const current = spec.dataset.indicatorIds;
  const indicatorIds = info.indicators === "none" ? [] : info.indicators === "one" ? (current.length > 0 ? [current[0]!] : allIndicatorIds.slice(0, 1)) : (current.length > 0 ? current : allIndicatorIds.slice(0, 2));
  const measure = template === "INDICATORS_PROGRESS" && spec.dataset.measure === "PERIOD" ? "PERCENT_OF_TARGET" : spec.dataset.measure;
  return { ...spec, kind: suitableKind(spec, template), dataset: { ...spec.dataset, template, indicatorIds, measure } };
}

/** Chooses the chart type. A planned kind or one the data cannot show is refused (null): the picker does not offer it. */
export function withKind(spec: ChartSpecV2, kind: ChartKind): ChartSpecV2 | null {
  return kindsForTemplate(spec.dataset.template).includes(kind) ? { ...spec, kind } : null;
}

/** Adds or removes an indicator; a template that takes one indicator replaces it. */
export function toggleIndicator(spec: ChartSpecV2, id: string): ChartSpecV2 {
  const info = DATA_CHART_TEMPLATES[spec.dataset.template];
  if (info.indicators === "none") return spec;
  const has = spec.dataset.indicatorIds.includes(id);
  const indicatorIds = info.indicators === "one" ? [id] : has ? spec.dataset.indicatorIds.filter((x) => x !== id) : [...spec.dataset.indicatorIds, id];
  return { ...spec, dataset: { ...spec.dataset, indicatorIds } };
}

/** Which kinds the picker offers for the current data, and why one is not available. */
export interface KindChoice { kind: ChartKind; state: "OK" | "NEEDS_OTHER_DATA" | "PLANNED"; current: boolean }
export function kindChoices(spec: ChartSpecV2): KindChoice[] {
  const fits = new Set(kindsForTemplate(spec.dataset.template));
  return CHART_KIND_ORDER.map((kind) => ({ kind, current: kind === spec.kind, state: CHART_KINDS[kind].status === "PLANNED" ? "PLANNED" : fits.has(kind) ? "OK" : "NEEDS_OTHER_DATA" }));
}

/** Sets or clears one series' styling; a style with nothing left in it is removed. */
export function withSeriesStyle(spec: ChartSpecV2, index: number, patch: Partial<Omit<SeriesStyle, "index">>): ChartSpecV2 {
  const rest = (spec.series ?? []).filter((s) => s.index !== index);
  const merged: SeriesStyle = { ...(spec.series ?? []).find((s) => s.index === index), index, ...patch };
  const empty = merged.label === undefined && merged.color === undefined && merged.kind === undefined && merged.lineStyle === undefined && merged.showLabels === undefined && !merged.hidden && merged.axis === undefined;
  const series = empty ? rest : [...rest, merged].sort((a, b) => a.index - b.index);
  const { series: _old, ...without } = spec;
  return series.length > 0 ? { ...without, series } : without;
}

type AxisName = "x" | "y" | "y2";
type AxisPatch = NonNullable<NonNullable<ChartSpecV2["axes"]>[AxisName]>;
export function withAxis(spec: ChartSpecV2, axis: AxisName, patch: Partial<AxisPatch>): ChartSpecV2 {
  const clean = Object.fromEntries(Object.entries({ ...(spec.axes?.[axis] ?? {}), ...patch }).filter(([, v]) => v !== undefined && v !== "" && !(typeof v === "number" && Number.isNaN(v)))) as AxisPatch;
  const axes = { ...(spec.axes ?? {}), [axis]: Object.keys(clean).length > 0 ? clean : undefined };
  const kept = Object.fromEntries(Object.entries(axes).filter(([, v]) => v !== undefined));
  const { axes: _old, ...without } = spec;
  return Object.keys(kept).length > 0 ? { ...without, axes: kept as ChartSpecV2["axes"] } : without;
}

export function addAnnotation(spec: ChartSpecV2, a: ChartAnnotation): ChartSpecV2 {
  return { ...spec, annotations: [...(spec.annotations ?? []), a] };
}
export function updateAnnotation(spec: ChartSpecV2, id: string, patch: Partial<ChartAnnotation>): ChartSpecV2 {
  return { ...spec, annotations: (spec.annotations ?? []).map((a) => (a.id === id ? ({ ...a, ...patch } as ChartAnnotation) : a)) };
}
export function removeAnnotation(spec: ChartSpecV2, id: string): ChartSpecV2 {
  const annotations = (spec.annotations ?? []).filter((a) => a.id !== id);
  const { annotations: _old, ...without } = spec;
  return annotations.length > 0 ? { ...without, annotations } : without;
}

/** An empty text, number or setting is removed from the spec rather than stored as "". */
export function withText<K extends "title" | "subtitle" | "caption" | "altText">(spec: ChartSpecV2, key: K, text: string): ChartSpecV2 {
  const { [key]: _old, ...without } = spec;
  return text.trim() === "" ? (without as ChartSpecV2) : { ...spec, [key]: text };
}

/* ---------- when the builder refuses: a one-click fix where there is one ---------- */

export interface SuggestedFix { label: string; apply: (spec: ChartSpecV2) => ChartSpecV2 }

/** A fix for a refusal the person can act on without leaving the screen, or null. Matches the builder's own sentences. */
export function suggestedFix(reason: string): SuggestedFix | null {
  if (/different units/.test(reason) || /one colour scale needs/.test(reason) || /must share a unit/.test(reason)) {
    return { label: "Show as % of target", apply: (s) => ({ ...s, dataset: { ...s.dataset, measure: "PERCENT_OF_TARGET" } }) };
  }
  if (/Every series is hidden/.test(reason)) return { label: "Show all series", apply: (s) => ({ ...s, series: (s.series ?? []).map((x) => ({ ...x, hidden: false })) }) };
  if (/No values are recorded/.test(reason) && /drafts|not verified/.test(reason) === false) return null;
  return null;
}

/* ---------- the data behind the chart, as a table and as a file ---------- */

export interface DataTable { columns: string[]; rows: Array<Array<string>> }

/** Every plotted point as a row: indicator, period, value (empty when nothing is recorded or the value is withheld), and its status. */
export function dataTable(data: DatasetResult): DataTable {
  const byId = new Map(data.indicators.map((i) => [i.id, i]));
  return {
    columns: ["Code", "Indicator", "Period", "Value", "Status"],
    rows: data.points.map((p) => [byId.get(p.indicatorId)?.code ?? "", byId.get(p.indicatorId)?.name ?? "", p.periodLabel, p.value === null ? "" : String(p.value), p.value === null ? "" : p.verified ? "Verified" : "Not verified yet"]),
  };
}

/** Comma-separated text for a download: cells with a comma, quote or line break are quoted; a cell that would run as a formula is made safe. */
export function toCsv(table: DataTable): string {
  const cell = (v: string): string => {
    const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return [table.columns, ...table.rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

/** A file name for a download: letters, digits and dashes only. */
export function fileNameFor(title: string, extension: string): string {
  const base = title.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return `${base || "chart"}.${extension}`;
}

/** The Maps screen's first chart: the first indicator by place, as graduated symbols, one level below the country. */
export function initialMapSpec(indicatorIds: ReadonlyArray<string>): ChartSpecV2 {
  return { version: 2, kind: "GRADUATED_SYMBOLS", dataset: { template: "RESULTS_BY_PLACE", indicatorIds: indicatorIds.slice(0, 1), measure: "PERIOD", placeLevel: 1, showTarget: false, includeDraft: true } };
}

/** The kinds the Maps screen offers: maps, rankings and parts of a whole by place, and tables. Everything else is for the Chart Studio. */
export const MAP_FAMILIES: ReadonlySet<string> = new Set(["GEOGRAPHIC", "COMPARISON", "PART_TO_WHOLE", "TABLE"]);
