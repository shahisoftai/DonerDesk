/**
 * Dashboards (Phase 33.8): a page of Data Center charts the team keeps. A widget is a saved chart spec for one project plus
 * where it sits on a 12-column grid. A dashboard stores specs and positions, never data: the numbers are drawn from the
 * project's data sheet each time it is opened, so a dashboard cannot go stale or hold a figure nobody can trace.
 * Pure: layout, validation and visibility are rules with no clock, storage or network.
 */
import { DATA_CHART_TEMPLATES, HEX_COLOUR, type DataChartSpec, type DataChartTemplate } from "../reporting/data-charts.js";

export const GRID_COLUMNS = 12;
export const WIDGET_MIN_W = 3;
export const WIDGET_MIN_H = 2;
export const WIDGET_MAX_H = 10;
export const MAX_WIDGETS = 24;
export const DEFAULT_WIDGET_W = 6;
export const DEFAULT_WIDGET_H = 4;

export type DashboardScope = "ORG" | "PROJECT" | "MINE";
export const DASHBOARD_SCOPES: readonly DashboardScope[] = ["ORG", "PROJECT", "MINE"];

export interface DashboardWidget {
  id: string;
  /** The project whose data sheet this chart is drawn from. */
  projectId: string;
  spec: DataChartSpec;
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
    const info = DATA_CHART_TEMPLATES[w.spec?.template as DataChartTemplate];
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

const overlaps = (a: Pick<DashboardWidget, "x" | "y" | "w" | "h">, b: Pick<DashboardWidget, "x" | "y" | "w" | "h">): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/**
 * Settles a layout: the pinned widget (the one being moved or resized) keeps its requested place, every other widget falls to
 * the highest free row beneath what is already placed, in reading order. Deterministic, never overlaps, never leaves a gap
 * above a chart. Positions are clamped to the grid first.
 */
export function settleLayout(widgets: ReadonlyArray<DashboardWidget>, pinnedId?: string): DashboardWidget[] {
  const fit = (w: DashboardWidget): DashboardWidget => {
    const width = clamp(w.w, WIDGET_MIN_W, GRID_COLUMNS);
    return { ...w, w: width, h: clamp(w.h, WIDGET_MIN_H, WIDGET_MAX_H), x: clamp(w.x, 0, GRID_COLUMNS - width), y: Math.max(0, w.y) };
  };
  const all = widgets.map(fit);
  const pinned = pinnedId ? all.find((w) => w.id === pinnedId) : undefined;
  const rest = all.filter((w) => w !== pinned).sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
  const placed: DashboardWidget[] = pinned ? [pinned] : [];
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

export function moveWidget(widgets: ReadonlyArray<DashboardWidget>, id: string, x: number, y: number): DashboardWidget[] {
  return settleLayout(widgets.map((w) => (w.id === id ? { ...w, x: Math.round(x), y: Math.round(y) } : w)), id);
}

export function resizeWidget(widgets: ReadonlyArray<DashboardWidget>, id: string, w: number, h: number): DashboardWidget[] {
  return settleLayout(widgets.map((it) => (it.id === id ? { ...it, w: Math.round(w), h: Math.round(h) } : it)), id);
}

export function removeWidget(widgets: ReadonlyArray<DashboardWidget>, id: string): DashboardWidget[] {
  return settleLayout(widgets.filter((w) => w.id !== id));
}

/** A new chart goes below everything else, at the default size. Refused (null) at the limit. */
export function addWidget(widgets: ReadonlyArray<DashboardWidget>, input: { id: string; projectId: string; spec: DataChartSpec }): DashboardWidget[] | null {
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
