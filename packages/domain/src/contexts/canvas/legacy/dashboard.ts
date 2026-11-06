/**
 * Reads a stored dashboard as a canvas (Phase 45.1). Pure and lossless for what the dashboard could say: each widget kind has a
 * row in `MAPPERS` (a table, not a branch), a v1 chart is lifted with `migrateChartSpec`, tabs become pages, grid cells carry over.
 * A widget it cannot read is returned in `unreadable` with the reason, never dropped silently.
 */
import type { DashboardWidget } from "../../dashboards/dashboard.js";
import { isSpecV2 } from "../../dashboards/dashboard.js";
import { migrateChartSpec } from "../../reporting/chart-spec-v2.js";
import { definitionFor } from "../blocks/registry.js";
import type { BlockInstance, Canvas, CanvasPage } from "../canvas.js";

/** A block reads a project when its definition has a project slot; the list of projects and text do not. */
const readsProject = (kind: string): boolean => definitionFor(kind)?.slots.some((slot) => slot.slot === "project") === true;

type Mapped = Pick<BlockInstance, "kind" | "props"> | string;
const MAPPERS: Readonly<Record<NonNullable<DashboardWidget["kind"]>, (w: DashboardWidget) => Mapped>> = {
  CHART: (w) => {
    const spec = isSpecV2(w.spec) ? w.spec : migrateChartSpec(w.spec);
    return spec ? { kind: "CHART", props: { spec } } : "The chart's settings could not be read.";
  },
  TEXT: (w) => ({ kind: "TEXT", props: { text: w.text ?? "", role: (w.text ?? "").startsWith("# ") ? "heading" : "body" } }),
  KPI: (w) => (w.kpi ? { kind: "KPI", props: w.kpi } : "A KPI tile without its indicator."),
  METRIC: (w) => (w.metric ? { kind: "METRIC", props: w.metric } : "A number tile without its figure."),
  MAP: (w) => (w.map ? { kind: "MAP", props: w.map } : "A map without its view."),
  REPORT: (w) => (w.report ? { kind: "TABLE", props: { query: w.report, title: w.text } } : "A table without its question."),
  PROJECT_LIST: (w) => (w.projectList ? { kind: "PROJECT_LIST", props: w.projectList } : "A project list without filters."),
};

export interface LegacyCanvas { pages: CanvasPage[]; unreadable: Array<{ widgetId: string; reason: string }> }

export function legacyDashboardToPages(widgets: ReadonlyArray<DashboardWidget>): LegacyCanvas {
  const pages = new Map<string, CanvasPage>();
  const unreadable: LegacyCanvas["unreadable"] = [];
  for (const w of widgets) {
    const mapped = MAPPERS[w.kind ?? "CHART"](w);
    if (typeof mapped === "string") { unreadable.push({ widgetId: w.id, reason: mapped }); continue; }
    const title = w.tab ?? "";
    let page = pages.get(title);
    if (!page) { page = { id: `page-${pages.size + 1}`, title: title || "Overview", format: "WEB_FLUID", blocks: [] }; pages.set(title, page); }
    page.blocks.push({ id: w.id, kind: mapped.kind, props: mapped.props, bindings: readsProject(mapped.kind) ? [{ type: "PROJECT", slot: "project", projectId: w.projectId }] : [], bounds: { x: w.x, y: w.y, w: w.w, h: w.h } });
  }
  return { pages: [...pages.values()], unreadable };
}

/** Which project each legacy widget reads from (the converted block now carries it as a `PROJECT` binding; this is kept for callers that only have the widgets). */
export const legacyProjectIds = (widgets: ReadonlyArray<DashboardWidget>): Record<string, string> => Object.fromEntries(widgets.map((w) => [w.id, w.projectId]));

export function legacyDashboardToCanvas(input: { id: string; title: string; scope: Canvas["scope"]; revision: number; widgets: ReadonlyArray<DashboardWidget> }): { canvas: Canvas; unreadable: LegacyCanvas["unreadable"] } {
  const { pages, unreadable } = legacyDashboardToPages(input.widgets);
  return { canvas: { id: input.id, scope: input.scope, mode: "LIVE", profile: "LIVE_INTERNAL", title: input.title, language: "en", themeId: "default", pages: pages.length ? pages : [{ id: "page-1", title: "Overview", format: "WEB_FLUID", blocks: [] }], revision: input.revision }, unreadable };
}
