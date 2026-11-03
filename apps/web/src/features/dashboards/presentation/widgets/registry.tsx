import { forScreen } from "@donordesk/domain/contexts/reporting/chart-screen.js";
import type { ChartDrawing } from "@/lib/server/schemas-dashboards";
import { ChartBody } from "./ChartBody";
import { KpiTileView } from "../KpiTileView";
import { MetricTileView } from "../MetricTileView";
import { MapWidget } from "../MapWidget";
import { TextBlock } from "../TextBlock";
import type { WidgetContext, WidgetRenderer } from "./types";

function TableBody({ table }: { table: NonNullable<ChartDrawing["table"]> }) {
  return (
    <div className="h-full overflow-auto" data-testid="table-widget">
      <table className="w-full text-xs"><thead><tr>{table.columns.map((c) => <th key={c} className="border-b px-2 py-1 text-start">{c}</th>)}</tr></thead>
        <tbody>{table.rows.map((r, i) => <tr key={i} className="border-t border-slate-100 dark:border-slate-800">{r.map((c, j) => <td key={j} className="px-2 py-1">{c}</td>)}</tr>)}</tbody></table>
      {table.notes.length > 0 && <ul className="px-2 py-1 text-xs text-slate-500">{table.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
    </div>
  );
}

/**
 * The kinds of widget, in the order they are tried. A new kind is a row here (and its component); the canvas is not edited.
 * The first row whose `matches` is true draws; the last row is the chart, which also says plainly when a chart cannot be drawn.
 */
export const WIDGET_RENDERERS: ReadonlyArray<WidgetRenderer> = [
  { key: "map", matches: (d) => d.map !== undefined, title: ({ drawing }) => drawing.map?.title, render: ({ drawing }) => <MapWidget view={drawing.map!.view} projectId={drawing.map!.projectId} preloaded={drawing.map!.preloaded} /> },
  { key: "metric", matches: (d) => d.metric !== undefined, title: ({ drawing }) => drawing.metric?.title, render: ({ drawing }) => <MetricTileView metric={drawing.metric!} /> },
  { key: "kpi", matches: (d) => d.kpi !== undefined, title: ({ drawing }) => drawing.kpi?.title, render: ({ drawing }) => <KpiTileView kpi={drawing.kpi!} /> },
  { key: "text", matches: (d) => d.text !== undefined, title: () => undefined, render: ({ drawing }) => <TextBlock text={drawing.text!} /> },
  { key: "table", matches: (d) => d.table !== undefined, title: ({ drawing }) => drawing.table?.title, render: ({ drawing }) => <TableBody table={drawing.table!} /> },
  {
    key: "chart", matches: () => true, title: ({ drawing }) => drawing.chart?.title,
    // The tile header already names the chart, so the title the builder draws inside the picture is dropped here, its space goes to the plot and a few lines are named at their ends (exports keep the builder's own look).
    subtitle: ({ drawing }) => (drawing.chart ? forScreen(drawing.chart.option).subtitle : undefined),
    render: ({ drawing, onPick, hoverName, onHover }: WidgetContext) => drawing.chart
      ? <ChartBody chart={drawing.chart} onPick={onPick} hoverName={hoverName} onHover={onHover} />
      : <p className="p-3 text-sm text-slate-500">{drawing.unavailable ?? "This chart cannot be drawn."}</p>,
  },
];

export const rendererFor = (drawing: ChartDrawing): WidgetRenderer => WIDGET_RENDERERS.find((r) => r.matches(drawing)) ?? WIDGET_RENDERERS[WIDGET_RENDERERS.length - 1]!;
