/**
 * The chart-style blocks of a canvas (indicator tiles, number tiles, maps, charts, tables) as dashboard widgets (Phase 45.3), so they are drawn by the one code path that already draws
 * them (`drawCharts`), with its visibility and honesty rules, instead of a second copy. The inverse of `legacyDashboardToCanvas`.
 * A kind with a row here is drawn that way; every other block resolves through its own model.
 */
import type { DashboardWidget } from "../dashboards/dashboard.js";
import type { KpiQuery } from "../dashboards/kpi.js";
import type { MapWidgetQuery } from "../dashboards/map-widget.js";
import type { MetricQuery } from "../dashboards/metric-tile.js";
import type { ChartSpecV2 } from "../reporting/chart-spec-v2.js";
import type { ReportQuery } from "../reporting/report-query.js";
import { projectOf } from "./binding.js";
import type { BlockInstance, Canvas } from "./canvas.js";

type Fields = Partial<Pick<DashboardWidget, "kind" | "kpi" | "metric" | "map" | "spec" | "report" | "text">>;
const WIDGET_FIELDS: Readonly<Record<string, (props: never) => Fields>> = {
  KPI: (p: KpiQuery) => ({ kind: "KPI", kpi: p }),
  METRIC: (p: MetricQuery) => ({ kind: "METRIC", metric: p }),
  MAP: (p: MapWidgetQuery) => ({ kind: "MAP", map: p }),
  CHART: (p: { spec: ChartSpecV2 }) => ({ kind: "CHART", spec: p.spec }),
  TABLE: (p: { query: ReportQuery; title?: string }) => ({ kind: "REPORT", report: p.query, ...(p.title ? { text: p.title } : {}) }),
};

export const isDashboardKind = (kind: string): boolean => kind in WIDGET_FIELDS;

export interface CanvasWidgets { widgets: DashboardWidget[]; /** blocks of these kinds, in the canvas, that no widget could be made for (no project) */ withoutProject: string[] }

export function canvasToWidgets(canvas: Canvas, fallbackProjectId?: string): CanvasWidgets {
  const widgets: DashboardWidget[] = [];
  const withoutProject: string[] = [];
  canvas.pages.forEach((page, pageIndex) => {
    for (const block of page.blocks as BlockInstance[]) {
      const fields = WIDGET_FIELDS[block.kind];
      if (!fields || block.style?.hidden) continue;
      const projectId = projectOf(block.bindings) ?? fallbackProjectId;
      if (!projectId) { withoutProject.push(block.id); continue; }
      widgets.push({ id: block.id, projectId, ...fields(block.props as never), ...(pageIndex > 0 ? { tab: page.title } : {}), x: block.bounds.x, y: block.bounds.y, w: block.bounds.w, h: block.bounds.h });
    }
  });
  return { widgets, withoutProject };
}
