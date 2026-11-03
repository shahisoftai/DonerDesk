"use client";

import Link from "next/link";
import { SiteMap } from "@/features/maps/presentation/SiteMap";
import { SITE_SIGNAL_COLOR, type SiteMapPoint } from "@/features/workplan/domain/site-map";
import { BAND_SIGNAL, BAND_WORDS, portfolioMapSummary, type PortfolioMapData, type ProjectBand } from "../domain/portfolio-map";

const BANDS: readonly ProjectBand[] = ["ON_TRACK", "AT_RISK", "OFF_TRACK", "NO_PLAN"];

/**
 * Where we work (after DevResults' Project Map tile): every place a project's planned work happens, one dot per place, coloured by the worst delivery
 * label of the projects there. The words under the map carry the same facts (a list by place), so the map is never the only way to read it.
 */
export function PortfolioMapPanel({ data, total }: { data: PortfolioMapData; total: number }) {
  const byPlace: SiteMapPoint[] = [...data.points].sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300" aria-label="Map legend">
        {BANDS.map((b) => (
          <span key={b} className="inline-flex items-center gap-1.5"><span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SITE_SIGNAL_COLOR[BAND_SIGNAL[b]] }} />{BAND_WORDS[b]}</span>
        ))}
      </div>
      {data.points.length > 0 ? <SiteMap points={data.points} /> : <p className="rounded-lg border border-slate-200 p-3 text-sm text-slate-600 dark:border-white/10 dark:text-slate-300">No project has planned work with a known place yet. Add a place to a planned activity and it appears here.</p>}
      <p className="text-sm text-slate-600 dark:text-slate-300">{portfolioMapSummary(data, total)}</p>
      {byPlace.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">Projects by place</summary>
          <ul className="mt-2 space-y-1">
            {byPlace.map((p) => (
              <li key={`${p.lat}|${p.lng}`}>
                <span className="font-medium">{p.name}</span>{p.country ? <span className="text-slate-500"> · {p.country}</span> : null}:{" "}
                {p.items.map((i, k) => <span key={i.id}>{k > 0 ? ", " : ""}<Link className="hover:underline" href={`/projects/${i.id}`}>{i.title}</Link> ({i.label})</span>)}
              </li>
            ))}
          </ul>
        </details>
      )}
      {data.notOnMap.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">Not on the map ({data.notOnMap.length})</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {data.notOnMap.map((n) => <li key={n.projectId}><Link className="hover:underline" href={`/projects/${n.projectId}/activities`}>{n.title}</Link> — {n.reason}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}
