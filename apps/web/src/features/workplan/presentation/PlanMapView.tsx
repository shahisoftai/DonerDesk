"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { WorkPlanRow } from "@/lib/server/schemas";
import { DELIVERY_SIGNAL_LABEL, WORKPLAN_COPY } from "@donordesk/domain/contexts/workplan/index.js";
import type { DeliverySignal } from "@donordesk/domain/contexts/workplan/index.js";
import { SITE_SIGNAL_COLOR, siteMapData, siteMapSummary, type SiteRiskInput } from "../domain/site-map";
import { SiteMapFigure } from "./SiteMapFigure";

const SIGNALS: readonly DeliverySignal[] = ["LATE", "ON_TIME", "DONE", "CANCELLED"];

/**
 * The plan's Map view: the same rows the List and Timeline show, plotted where they happen. A dot is a
 * place; its color is the worst signal there; a number makes it bigger. Open risks raised at a site are
 * named in its tooltip. Locations that match no known place are listed, never invented (Phase 30 §3).
 */
export default function PlanMapView({ projectId, rows, risks, country, mapLayerUrl }: { projectId: string; rows: WorkPlanRow[]; risks: readonly SiteRiskInput[]; country?: string; mapLayerUrl?: string }) {
  const data = useMemo(
    () =>
      siteMapData(
        rows.map((r) => ({ id: r.id, title: r.title, location: r.location, latitude: r.latitude, longitude: r.longitude, signal: r.signal })),
        { risks, country },
      ),
    [rows, risks, country],
  );
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300" aria-label={WORKPLAN_COPY.mapLegend}>
        <span className="font-medium">{WORKPLAN_COPY.mapLegend}:</span>
        {SIGNALS.map((signal) => (
          <span key={signal} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SITE_SIGNAL_COLOR[signal] }} />
            {DELIVERY_SIGNAL_LABEL[signal]}
          </span>
        ))}
      </div>
      {data.points.length === 0 ? (
        <p className="rounded-lg border border-slate-200 p-3 text-sm text-slate-600 dark:border-white/10 dark:text-slate-300">
          {WORKPLAN_COPY.mapNoSites}
        </p>
      ) : (
        <SiteMapFigure points={data.points} country={country} customLayerUrl={mapLayerUrl} />
      )}
      {data.points.length > 0 && <p className="text-sm text-slate-600 dark:text-slate-300">{siteMapSummary(data)}</p>}
      {data.unplaced.length > 0 && (
        <div className="text-sm text-slate-600 dark:text-slate-300">
          <p>{WORKPLAN_COPY.mapUnplaced}</p>
          <ul className="mt-1 list-disc pl-5">
            {data.unplaced.map((item) => (
              <li key={item.id}>
                <Link className="hover:underline" href={`/projects/${projectId}/activities/plan/${item.id}`}>
                  {item.title}
                </Link>
                {item.location ? ` — ${item.location}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.points.length > 0 && data.unplaced.length === 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400">{WORKPLAN_COPY.mapEverythingPlaced}</p>
      )}
    </div>
  );
}
