"use client";

import Link from "next/link";
import type { BasemapNote } from "../domain/basemap/regions";
import { LOW_DETAIL_BASEMAP, NO_BASEMAP } from "../domain/basemap/regions";
import type { BoundaryOrigin } from "../ports/boundary-source";
import { useMapText } from "./useMapText";

/** The small print under a map: what the ground is, the finest level available, names matched only by name, credits and unmapped places. Reads props only. */
export function MapFootnotes({ note, finest, countryName, shownLevel, byName, credit, attribution, unmapped }: {
  note: BasemapNote | null;
  /** Set only when the finest level of the opened country is coarser than level 4 and the country itself is shown. */
  finest: { country: string; level: number } | null;
  countryName: string | null;
  shownLevel: number;
  byName: number;
  credit: BoundaryOrigin | null;
  attribution: string | null;
  unmapped: ReadonlyArray<{ name: string }>;
}) {
  const { t, levelPlural } = useMapText();
  void countryName; void shownLevel;
  return (
    <>
      {note === NO_BASEMAP && <p className="text-xs text-slate-500">{t("maps.noBasemap")}</p>}
      {note === LOW_DETAIL_BASEMAP && <p className="text-xs text-slate-500">{t("maps.lowDetailBasemap")}</p>}
      {finest && <p className="text-xs text-slate-500">{t("maps.finest", { country: finest.country, level: levelPlural(finest.level) })}</p>}
      {byName > 0 && <p className="text-xs text-slate-500">{t("maps.byNameOnly", { count: byName })}</p>}
      {credit ? <p className="text-xs text-slate-500" data-testid="boundary-credit">{t("maps.credit.uploaded", { country: credit.countryName, name: credit.layerName })}</p> : attribution && <p className="text-xs text-slate-500">{attribution}</p>}
      <p className="text-xs text-slate-500" data-no-print><Link className="underline" href="/maps/sources">{t("maps.sources.link")}</Link></p>
      {unmapped.length > 0 && <p className="text-xs text-slate-500">{t("maps.unmappedList", { names: unmapped.map((u) => u.name).join(", ") })}</p>}
    </>
  );
}
