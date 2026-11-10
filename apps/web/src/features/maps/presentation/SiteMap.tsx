"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { WORKPLAN_COPY } from "@donordesk/domain/contexts/workplan/index.js";
import type { SiteMapPoint } from "../../workplan/domain/site-map";
import { useLowData } from "../../design/presentation/use-low-data";
import { buildSiteTable } from "../domain/table/map-table";
import { SitesMap } from "./SitesMap";
import { SitesTable } from "./SitesTable";
import { useMapEngine } from "./useMapEngine";
import { useMapText } from "./useMapText";

/**
 * The one "sites on a map" every screen uses (the plan's Map view, the project Overview, the portfolio, the photos): the map when the
 * device can draw it, the table otherwise (Phase 49.9: one engine). Same points in, same facts out; nothing here decides what a dot means.
 * Every one can be read as a table, and in low-data mode the table is what is shown (no map library, no tiles).
 */
export function SiteMap(props: { points: readonly SiteMapPoint[]; country?: string | undefined; caption?: string | undefined; customLayerUrl?: string | undefined }) {
  const { engine, markFailed } = useMapEngine();
  const { lowData } = useLowData();
  const { t } = useMapText();
  const [showAnyway, setShowAnyway] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const rows = useMemo(() => buildSiteTable(props.points), [props.points]);
  if (props.points.length === 0) return null;
  if ((lowData && !showAnyway) || engine === "none") {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3 text-sm" role="note">
          <p>{t(engine === "none" ? "maps.noWebGl" : "maps.lowData.note")}</p>
          {engine !== "none" && <button type="button" className="font-medium underline" onClick={() => setShowAnyway(true)}>{t("maps.lowData.show")}</button>}
        </div>
        <SitesTable rows={rows} />
      </div>
    );
  }
  if (engine === "pending") return null;
  const label = props.caption ?? WORKPLAN_COPY.mapCaption;
  return (
    <div className="space-y-2">
      <SitesMap {...props} label={label} onFailed={markFailed} />
      <div data-no-print>
        <button type="button" className="text-sm font-medium underline" aria-expanded={showTable} aria-controls="sites-as-table" onClick={() => setShowTable((v) => !v)}>{showTable ? t("maps.table.hide") : t("maps.table.show")}</button>
        {showTable && <div id="sites-as-table" className="mt-2"><SitesTable rows={rows} /></div>}
        <p className="mt-1 text-xs text-slate-500"><Link className="underline" href="/maps/sources">{t("maps.sources.link")}</Link></p>
      </div>
    </div>
  );
}
