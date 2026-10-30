/**
 * The viewer's own period filter on a dashboard: it narrows what is drawn for this visit, and the saved dashboard is never changed.
 * A period belongs to one project, so a chart is narrowed only when its project has that period; every other chart stays as saved.
 * Pure: a widget in, a widget out.
 */
import { isSpecV2, type DashboardWidget } from "./dashboard.js";

export function restrictWidgetToPeriod(widget: DashboardWidget, periodId: string, projectPeriodIds: ReadonlyArray<string> | undefined): DashboardWidget {
  if (!projectPeriodIds || !projectPeriodIds.includes(periodId)) return widget;
  const range = { fromPeriodId: periodId, toPeriodId: periodId };
  if (widget.kind === "REPORT" && widget.report) return { ...widget, report: { ...widget.report, ...range } };
  if (widget.kind === "KPI" && widget.kpi) return { ...widget, kpi: { ...widget.kpi, toPeriodId: periodId } };
  if (widget.kind === "TEXT" || !widget.spec) return widget;
  if (isSpecV2(widget.spec)) return { ...widget, spec: { ...widget.spec, dataset: { ...widget.spec.dataset, ...range } } };
  return { ...widget, spec: { ...(widget.spec as object), ...range } as typeof widget.spec };
}
