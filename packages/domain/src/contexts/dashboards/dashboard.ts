/**
 * Dashboards (Phase 33.8): a page of Data Center charts the team keeps. A widget is a saved chart spec for one project plus
 * where it sits on a 12-column grid. A dashboard stores specs and positions, never data: the numbers are drawn from the
 * project's data sheet each time it is opened, so a dashboard cannot go stale or hold a figure nobody can trace.
 * Pure: layout, validation and visibility are rules with no clock, storage or network.
 */
import { MAX_REPORT_NAME, validateReportQuery, type ReportQuery } from "../reporting/report-query.js";
import { DATA_CHART_TEMPLATES, HEX_COLOUR, type DataChartSpec, type DataChartTemplate } from "../reporting/data-charts.js";
import { validateChartSpec, type ChartSpecV2 } from "../reporting/chart-spec-v2.js";
import { validateKpiQuery, type KpiQuery } from "./kpi.js";
import { validateMetricQuery, type MetricQuery } from "./metric-tile.js";
import { validateMapWidget, type MapWidgetQuery } from "./map-widget.js";

export const GRID_COLUMNS = 12;
export const WIDGET_MIN_W = 3;
export const WIDGET_MIN_H = 2;
export const WIDGET_MAX_H = 10;
export const MAX_WIDGETS = 24;
export const DEFAULT_WIDGET_W = 6;
export const DEFAULT_WIDGET_H = 4;

export type DashboardScope = "ORG" | "PROJECT" | "MINE";
export const DASHBOARD_SCOPES: readonly DashboardScope[] = ["ORG", "PROJECT", "MINE"];

export const MAX_TEXT_WIDGET = 2000;
export const MAX_TAB_NAME = 40;
export const MAX_TABS = 8;

/** The older chart specification (the original six kinds) or the Chart Studio's `ChartSpecV2`; a v2 spec has `version: 2`. */
export type WidgetSpec = DataChartSpec | ChartSpecV2;
export const isSpecV2 = (spec: unknown): spec is ChartSpecV2 => typeof spec === "object" && spec !== null && (spec as { version?: unknown }).version === 2;

export interface DashboardWidget {
  id: string;
  /** The project whose data sheet this chart is drawn from (for a text block, the project it sits with). */
  projectId: string;
  /** CHART (the default) draws `spec`; TEXT shows `text`. */
  kind?: "CHART" | "TEXT" | "REPORT" | "KPI" | "METRIC" | "MAP" | undefined;
  /** MAP: an interactive map of the project (results by place, or where the activities are). */
  map?: MapWidgetQuery | undefined;
  /** METRIC: a coloured number tile (a money or activity figure). */
  metric?: MetricQuery | undefined;
  /** KPI: the indicator whose latest figure the tile shows. */
  kpi?: KpiQuery | undefined;
  spec?: WidgetSpec | undefined;
  /** REPORT: the saved-report question (indicators, periods, measure, rows); the table is run against the data sheet whenever the dashboard is opened. `text` is its title. */
  report?: ReportQuery | undefined;
  /** TEXT: a short note in plain text. */
  text?: string | undefined;
  /** The tab the chart sits on; none = the first, unnamed tab. */
  tab?: string | undefined;
  /** Grid cells: column, row, width, height. */
  x: number;
  y: number;
  w: number;
  h: number;
}

const int = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n);

export interface WidgetProblem { widgetId: string; message: string }

/** Everything wrong with a set of widgets, as sentences. An empty list means the dashboard can be saved. */
export function widgetProblems(widgets: ReadonlyArray<DashboardWidget>): WidgetProblem[] {
  const problems: WidgetProblem[] = [];
  if (widgets.length > MAX_WIDGETS) problems.push({ widgetId: "", message: `A dashboard holds at most ${MAX_WIDGETS} charts.` });
  const seen = new Set<string>();
  if (tabsOf(widgets).length > MAX_TABS) problems.push({ widgetId: "", message: `A dashboard has at most ${MAX_TABS} tabs.` });
  for (const w of widgets) {
    const add = (message: string) => problems.push({ widgetId: w.id, message });
    if (!w.id || seen.has(w.id)) add("Two charts share an id.");
    seen.add(w.id);
    if (!w.projectId) add("A chart needs a project.");
    if (![w.x, w.y, w.w, w.h].every(int) || w.x < 0 || w.y < 0) add("A chart's position and size must be whole, non-negative cells.");
    else {
      if (w.w < WIDGET_MIN_W || w.h < WIDGET_MIN_H) add(`A chart is at least ${WIDGET_MIN_W} wide and ${WIDGET_MIN_H} high.`);
      if (w.h > WIDGET_MAX_H) add(`A chart is at most ${WIDGET_MAX_H} high.`);
      if (w.x + w.w > GRID_COLUMNS) add(`A chart cannot go past column ${GRID_COLUMNS}.`);
    }
    if (w.tab !== undefined && (!w.tab.trim() || w.tab.length > MAX_TAB_NAME)) add(`A tab name is 1 to ${MAX_TAB_NAME} characters.`);
    if (w.kind === "REPORT") {
      const found = w.report ? validateReportQuery(w.report) : [{ message: "A report widget needs its question." }];
      if (found.length > 0) add(found[0]!.message);
      if ((w.text?.length ?? 0) > MAX_REPORT_NAME) add(`A report's title is at most ${MAX_REPORT_NAME} characters.`);
      continue;
    }
    if (w.kind === "MAP") {
      const found = w.map ? validateMapWidget(w.map) : "A map needs to say what it shows.";
      if (found) add(found);
      continue;
    }
    if (w.kind === "METRIC") {
      const found = w.metric ? validateMetricQuery(w.metric) : "A number tile needs a figure to show.";
      if (found) add(found);
      continue;
    }
    if (w.kind === "KPI") {
      const found = w.kpi ? validateKpiQuery(w.kpi) : "A KPI tile needs an indicator.";
      if (found) add(found);
      continue;
    }
    if (w.kind === "TEXT") {
      if (!w.text?.trim()) add("A text block needs some text.");
      else if (w.text.length > MAX_TEXT_WIDGET) add(`A text block is at most ${MAX_TEXT_WIDGET} characters.`);
      continue;
    }
    if (isSpecV2(w.spec)) {
      // The Chart Studio's chart: checked by the one validator the studio and the API share.
      const found = validateChartSpec(w.spec);
      if (found.length > 0) add(found[0]!.message);
      continue;
    }
    if (!w.spec) { add("A chart needs its settings."); continue; }
    const info = DATA_CHART_TEMPLATES[w.spec.template as DataChartTemplate];
    if (!info) { add("The chart's template is not known."); continue; }
    if (!info.types.includes(w.spec.type)) add(`${info.label} cannot be drawn as a ${w.spec.type.toLowerCase()} chart.`);
    const n = w.spec.indicatorIds?.length ?? 0;
    if (info.indicators === "one" && n !== 1) add("Choose exactly one indicator for this chart.");
    if (info.indicators === "many" && n < 1) add("Choose at least one indicator for this chart.");
    if (info.indicators === "none" && n !== 0) add("This chart takes no indicators.");
    if ((w.spec.colors ?? []).some((c) => !HEX_COLOUR.test(c))) add("A colour must be written as #rrggbb.");
    if (w.spec.title !== undefined && w.spec.title.length > 200) add("A chart's title is at most 200 characters.");
  }
  return problems;
}

/** Anything that sits on the dashboard grid: a saved chart, or a widget of a template. */
export interface GridBox { id: string; x: number; y: number; w: number; h: number }

const overlaps = (a: Pick<DashboardWidget, "x" | "y" | "w" | "h">, b: Pick<DashboardWidget, "x" | "y" | "w" | "h">): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/**
 * Settles a layout: the pinned widget (the one being moved or resized) keeps its requested place, every other widget falls to
 * the highest free row beneath what is already placed, in reading order. Deterministic, never overlaps, never leaves a gap
 * above a chart. Positions are clamped to the grid first.
 */
export function settleLayout<T extends GridBox>(widgets: ReadonlyArray<T>, pinnedId?: string): T[] {
  const fit = (w: T): T => {
    const width = clamp(w.w, WIDGET_MIN_W, GRID_COLUMNS);
    return { ...w, w: width, h: clamp(w.h, WIDGET_MIN_H, WIDGET_MAX_H), x: clamp(w.x, 0, GRID_COLUMNS - width), y: Math.max(0, w.y) };
  };
  const all = widgets.map(fit);
  const pinned = pinnedId ? all.find((w) => w.id === pinnedId) : undefined;
  const rest = all.filter((w) => w !== pinned).sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
  const placed: T[] = pinned ? [pinned] : [];
  for (const w of rest) {
    let y = 0;
    for (;;) {
      const candidate = { ...w, y };
      const hit = placed.find((p) => overlaps(candidate, p));
      if (!hit) { placed.push(candidate); break; }
      y = hit.y + hit.h;
    }
  }
  // Back in the order they were given, so a caller's list does not reshuffle.
  return widgets.map((w) => placed.find((p) => p.id === w.id)!);
}

export function moveWidget<T extends GridBox>(widgets: ReadonlyArray<T>, id: string, x: number, y: number): T[] {
  return settleLayout(widgets.map((w) => (w.id === id ? { ...w, x: Math.round(x), y: Math.round(y) } : w)), id);
}

export function resizeWidget<T extends GridBox>(widgets: ReadonlyArray<T>, id: string, w: number, h: number): T[] {
  return settleLayout(widgets.map((it) => (it.id === id ? { ...it, w: Math.round(w), h: Math.round(h) } : it)), id);
}

/** What a person can change about a widget without removing it. Each change fits one kind of widget; a change for another kind is refused (null). */
export type WidgetChange =
  | { kind: "METRIC"; metric: MetricQuery }
  | { kind: "MAP"; map: MapWidgetQuery }
  | { kind: "KPI"; kpi: KpiQuery }
  | { kind: "TEXT"; text: string }
  /** A chart keeps its data and drawing; only its title changes here (empty clears it). */
  | { kind: "CHART"; title: string };

/**
 * Changes a widget's settings in place: its place on the grid, its size, its tab and its project are untouched. Returns the new list, or null when
 * the widget is not there or the change is for another kind. The caller checks the whole list with `widgetProblems` before keeping it.
 */
export function updateWidgetSettings(widgets: ReadonlyArray<DashboardWidget>, id: string, change: WidgetChange): DashboardWidget[] | null {
  const at = widgets.findIndex((w) => w.id === id);
  const w = widgets[at];
  if (at < 0 || !w) return null;
  const kind = w.kind ?? "CHART";
  if (kind !== change.kind) return null;
  let next: DashboardWidget;
  switch (change.kind) {
    case "METRIC": next = { ...w, metric: change.metric }; break;
    case "MAP": next = { ...w, map: change.map }; break;
    case "KPI": next = { ...w, kpi: change.kpi }; break;
    case "TEXT": next = { ...w, text: change.text }; break;
    case "CHART": {
      if (!w.spec) return null;
      const title = change.title.trim();
      const { title: _gone, ...rest } = w.spec as { title?: string };
      next = { ...w, spec: (title ? { ...rest, title } : rest) as typeof w.spec };
      break;
    }
  }
  return widgets.map((x, i) => (i === at ? next : x));
}

export function removeWidget<T extends GridBox>(widgets: ReadonlyArray<T>, id: string): T[] {
  return settleLayout(widgets.filter((w) => w.id !== id));
}

/** A new chart goes below everything else, at the default size. Refused (null) at the limit. */
export function addWidget(widgets: ReadonlyArray<DashboardWidget>, input: { id: string; projectId: string; spec?: WidgetSpec | undefined; kind?: "CHART" | "TEXT" | "REPORT" | "KPI" | "METRIC" | "MAP" | undefined; text?: string | undefined; report?: ReportQuery | undefined; kpi?: KpiQuery | undefined; metric?: MetricQuery | undefined; map?: MapWidgetQuery | undefined }): DashboardWidget[] | null {
  if (widgets.length >= MAX_WIDGETS) return null;
  const bottom = widgets.reduce((max, w) => Math.max(max, w.y + w.h), 0);
  return settleLayout([...widgets, { ...input, x: 0, y: bottom, w: DEFAULT_WIDGET_W, h: DEFAULT_WIDGET_H }]);
}

/** The charts in reading order, for a narrow screen where the grid is not drawn. */
export function readingOrder(widgets: ReadonlyArray<DashboardWidget>): DashboardWidget[] {
  return [...widgets].sort((a, b) => a.y - b.y || a.x - b.x);
}

export function gridRows(widgets: ReadonlyArray<DashboardWidget>): number {
  return widgets.reduce((max, w) => Math.max(max, w.y + w.h), 0);
}

export interface DashboardAccessFacts {
  scope: DashboardScope;
  ownerId: string;
  projectId?: string | undefined;
}

export interface DashboardViewer {
  userId: string;
  /** Holds `project.edit`: may change shared dashboards that are not their own. */
  canManageShared: boolean;
}

/** Who may change a dashboard: its owner always; for a shared one (organisation or project) also anyone who manages shared work. */
export function canEditDashboard(d: DashboardAccessFacts, viewer: DashboardViewer): boolean {
  if (d.ownerId === viewer.userId) return true;
  return d.scope !== "MINE" && viewer.canManageShared;
}

/** A personal dashboard is seen only by its owner; a shared one by any member (the charts still obey project access). */
export function canSeeDashboard(d: DashboardAccessFacts, viewer: Pick<DashboardViewer, "userId">): boolean {
  return d.scope !== "MINE" || d.ownerId === viewer.userId;
}

/** A project dashboard names its project; the other kinds do not. */
export function dashboardScopeProblem(d: DashboardAccessFacts): string | null {
  if (d.scope === "PROJECT" && !d.projectId) return "A project dashboard needs a project.";
  if (d.scope !== "PROJECT" && d.projectId) return "Only a project dashboard belongs to one project.";
  return null;
}

/** The named tabs in the order they first appear (reading order of the widgets), without repeats. */
export function tabsOf(widgets: ReadonlyArray<Pick<DashboardWidget, "tab" | "x" | "y">>): string[] {
  const named = widgets.filter((w) => w.tab?.trim()).sort((a, b) => a.y - b.y || a.x - b.x);
  return [...new Set(named.map((w) => w.tab!.trim()))];
}

/** The widgets on one tab ("" = those with no tab). */
export function widgetsOnTab<T extends Pick<DashboardWidget, "tab">>(widgets: ReadonlyArray<T>, tab: string): T[] {
  return widgets.filter((w) => (w.tab?.trim() ?? "") === tab);
}
