import type { ChartDrawing } from "@/lib/server/schemas-dashboards";
import { TILE_BACKGROUND } from "../domain/tile-theme";

type Metric = NonNullable<ChartDrawing["metric"]>;

/** A big coloured number with its unit, like the management cards. Its name is the card's title bar (also its handle), so it is not said twice. With no figure it says why, in words, and never shows a placeholder number. */
export function MetricTileView({ metric }: { metric: Metric }) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-md px-3 py-2 text-center text-white" style={{ backgroundColor: TILE_BACKGROUND[metric.color] }} data-testid="metric-widget" role="group" aria-label={`${metric.title}: ${metric.value === null ? (metric.note ?? "no figure") : `${metric.text} ${metric.unit}`}`}>
      {metric.value === null
        ? <p className="text-base">{metric.note ?? "Not recorded yet"}</p>
        : <p className="text-5xl font-bold leading-none tabular-nums">{metric.text}</p>}
      {metric.unit && <p className="mt-1 text-sm">{metric.unit}</p>}
    </div>
  );
}
