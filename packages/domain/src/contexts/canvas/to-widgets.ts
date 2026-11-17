/**
 * The chart-style blocks of a canvas (indicator tiles, number tiles, maps, charts, tables) as dashboard widgets (Phase 45.3), so they are drawn by the one code path that already draws
 * them (`drawCharts`), with its visibility and honesty rules, instead of a second copy. The inverse of `legacyDashboardToCanvas`.
 * A kind with a row here is drawn that way; every other block resolves through its own model.
 */
import { isSpecV2, type DashboardWidget } from "../dashboards/dashboard.js";
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

/**
 * What the block's "Labels" formatting means for a chart: show or hide the values, where they sit and how large. A setting the chart's own
 * `labels` / `style.labels` already holds is kept; the formatting fills what the chart left unset.
 */
export function specWithFormatLabels(spec: ChartSpecV2, f: NonNullable<BlockInstance["format"]>["labels"] & object): ChartSpecV2 {
  const show = f.density === "none" ? false : f.show;
  const POS = { inside: "INSIDE", outside: "OUTSIDE", auto: "AUTO" } as const;
  const SIZE = { S: 10, M: 12, L: 14 } as const;
  const labels = spec.labels ?? (show === undefined ? undefined : { show, format: "VALUE" as const });
  const own = spec.style?.labels;
  const style = {
    ...(spec.style ?? {}),
    labels: {
      ...(f.position && !own?.position ? { position: POS[f.position] } : {}),
      ...(f.size && own?.size === undefined ? { size: SIZE[f.size] } : {}),
      ...(f.density === "auto" && own?.hideOverlap === undefined ? { hideOverlap: true } : {}),
      ...(own ?? {}),
    },
  };
  return { ...spec, ...(labels ? { labels } : {}), style: Object.keys(style.labels).length > 0 ? style : spec.style };
}

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
      const made = fields(block.props as never);
      // The block's "Labels" formatting reaches its chart (Phase 61.10); the chart's own label settings, where it has them, win.
      if (made.kind === "CHART" && made.spec && isSpecV2(made.spec) && block.format?.labels) made.spec = specWithFormatLabels(made.spec, block.format.labels);
      widgets.push({ id: block.id, projectId, ...made, ...(pageIndex > 0 ? { tab: page.title } : {}), x: block.bounds.x, y: block.bounds.y, w: block.bounds.w, h: block.bounds.h });
    }
  });
  return { widgets, withoutProject };
}
