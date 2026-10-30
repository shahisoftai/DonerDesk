"use client";

import type { ChartDrawing } from "@/lib/server/schemas-dashboards";
import { segmentPath, sparkSegments } from "../domain/sparkline";
import { TILE_BACKGROUND } from "../domain/tile-theme";

type Kpi = NonNullable<ChartDrawing["kpi"]>;

/** One big figure with its period, target, share of target and a sparkline. Nothing recorded says so; it never shows a placeholder figure. */
export function KpiTileView({ kpi }: { kpi: Kpi }) {
  const segments = sparkSegments(kpi.spark.map((s) => s.value), 120, 32);
  return (
    <div className={`flex h-full flex-col justify-between rounded-md p-3 ${kpi.color ? "text-white" : ""}`} style={kpi.color ? { backgroundColor: TILE_BACKGROUND[kpi.color] } : undefined} data-testid="kpi-widget">
      {kpi.value === null ? (
        <p className={`text-sm ${kpi.color ? "" : "text-slate-500"}`}>Not yet reported</p>
      ) : (
        <div>
          <p className="text-3xl font-semibold tabular-nums">{kpi.value.toLocaleString()}{kpi.unit ? <span className={`ms-1 text-sm font-normal ${kpi.color ? "" : "text-slate-500"}`}>{kpi.unit}</span> : null}</p>
          <p className={`text-xs ${kpi.color ? "" : "text-slate-500"}`}>
            {kpi.periodLabel}{kpi.unverified ? " · not verified yet" : ""}
            {kpi.target ? ` · target ${kpi.target}` : ""}
            {kpi.percentOfTarget !== null ? ` · ${Math.round(kpi.percentOfTarget)}% of target` : ""}
          </p>
        </div>
      )}
      {segments.length > 0 && (
        <svg viewBox="0 0 120 32" className="h-8 w-full" role="img" aria-label={`Trend over ${kpi.spark.length} periods`} preserveAspectRatio="none">
          {segments.map((s, i) => (s.points.length > 1
            ? <path key={i} d={segmentPath(s)} fill="none" stroke="currentColor" strokeWidth="1.5" className={kpi.color ? "text-white" : "text-brand-600"} />
            : <circle key={i} cx={s.points[0]![0]} cy={s.points[0]![1]} r="1.8" className={kpi.color ? "fill-white" : "fill-brand-600"} />))}
        </svg>
      )}
    </div>
  );
}
