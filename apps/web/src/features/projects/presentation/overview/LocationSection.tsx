import Link from "next/link";
import { DELIVERY_SIGNAL_LABEL, WORKPLAN_COPY } from "@donordesk/domain/contexts/workplan/index.js";
import type { DeliverySignal } from "@donordesk/domain/contexts/workplan/index.js";
import { OVERVIEW_SECTION_LABEL } from "@/features/projects/domain/overview-sections";
import { SITE_SIGNAL_COLOR, siteMapSummary } from "@/features/workplan/domain/site-map";
import type { LocationData } from "@/features/projects/application/overview-view";
import { SiteMapFigure } from "@/features/workplan/presentation/SiteMapFigure";
import { OverviewSection } from "./overview-pieces";

const SIGNALS: readonly DeliverySignal[] = ["LATE", "ON_TIME", "DONE", "CANCELLED"];

/**
 * "Where we work": the plan's sites on the map, colored by the same delivery signals the Delivery
 * section words use. It reads; the only way onward is the link to the plan (Phase 30 §3).
 */
export function LocationSection({ location, projectId }: { location: LocationData; projectId: string }) {
  const { sites } = location;
  const where = [location.region, location.country].filter(Boolean).join(", ");
  return (
    <OverviewSection kicker="Location" title={OVERVIEW_SECTION_LABEL.LOCATION} href={`/projects/${projectId}/activities?view=planned`} linkLabel="See the plan">
      <div className="card max-w-3xl">
        {where ? <p className="text-sm text-slate-600 dark:text-slate-300">{where}</p> : null}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300" aria-label={WORKPLAN_COPY.mapLegend}>
          <span className="font-medium">{WORKPLAN_COPY.mapLegend}:</span>
          {SIGNALS.map((signal) => (
            <span key={signal} className="inline-flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SITE_SIGNAL_COLOR[signal] }} />
              {DELIVERY_SIGNAL_LABEL[signal]}
            </span>
          ))}
        </div>
        <div className="mt-3">
          <SiteMapFigure points={sites.points} country={location.country} customLayerUrl={location.mapLayerUrl} />
        </div>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{siteMapSummary(sites)}</p>
        {sites.unplaced.length > 0 ? (
          <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            <p>{WORKPLAN_COPY.mapUnplaced}</p>
            <ul className="mt-1 list-disc pl-5">
              {sites.unplaced.slice(0, 5).map((item) => (
                <li key={item.id}>
                  <Link className="hover:underline" href={`/projects/${projectId}/activities/plan/${item.id}`}>
                    {item.title}
                  </Link>
                  {item.location ? ` — ${item.location}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{WORKPLAN_COPY.mapEverythingPlaced}</p>
        )}
      </div>
    </OverviewSection>
  );
}
