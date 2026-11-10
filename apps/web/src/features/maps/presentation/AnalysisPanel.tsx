"use client";

import { useMemo, useState } from "react";
import { nearestFacility, ringPolygon, withinRings } from "@donordesk/domain/contexts/places/analysis/index.js";
import { populationWithinAction } from "@/lib/actions/map-analysis";
import type { PopulationAnswerDto } from "@/lib/server/schemas-map-context";
import type { Overlay } from "../domain/overlay-layer";
import { formatFullNumber } from "@/features/design/domain/number-format";
import { useMapText } from "./useMapText";

interface PlaceLike { id: string; name: string; latitude?: number | undefined; longitude?: number | undefined; facility?: boolean | undefined; archived?: boolean | undefined }

/**
 * "Analyse" (Phase 49.7): rings of N km around the places that have a figure, the places and facilities inside them, the straight-line
 * distance from each to the nearest facility, and the people living inside the rings. Every distance says "straight line"; every population
 * figure names its source and year; nothing here is stored or sent to a report.
 */
export function AnalysisPanel({ projectId, places, siteIds, onRings }: { projectId: string; places: readonly PlaceLike[]; siteIds: readonly string[]; onRings: (overlay: Overlay | null) => void }) {
  const { t, lang } = useMapText();
  const [km, setKm] = useState(5);
  const [shown, setShown] = useState(false);
  const [population, setPopulation] = useState<PopulationAnswerDto | null>(null);
  const [busy, setBusy] = useState(false);
  const live = places.filter((p) => !p.archived);
  const pin = (p: PlaceLike) => ({ id: p.id, name: p.name, lng: p.longitude, lat: p.latitude });
  const sites = useMemo(() => live.filter((p) => siteIds.includes(p.id) && p.latitude !== undefined && p.longitude !== undefined), [live, siteIds]);
  const centres = sites.map((s) => ({ lng: s.longitude!, lat: s.latitude! }));
  const inside = useMemo(() => (centres.length > 0 ? withinRings(centres, km, live.filter((p) => !siteIds.includes(p.id)).map(pin)) : null), [centres, km, live, siteIds]);
  const nearest = useMemo(() => nearestFacility(sites.map(pin), live.filter((p) => p.facility).map(pin)), [sites, live]);

  async function run() {
    setShown(true);
    onRings({ name: t("maps.analysis.ringsName", { km: String(km) }), points: [], lines: centres.map((c, i) => ({ name: sites[i]!.name, coords: ringPolygon(c, km) })) });
    setBusy(true);
    try {
      const r = await populationWithinAction(projectId, centres.slice(0, 50).map((c) => ({ ...c, km })));
      setPopulation(r.ok ? r.value : { ok: false, reason: "ERROR" });
    } finally { setBusy(false); }
  }

  if (sites.length === 0) return null;
  return (
    <section className="space-y-2 text-sm" aria-labelledby="analysis-title">
      <h3 id="analysis-title" className="font-medium">{t("maps.analysis.title")}</h3>
      <label className="flex items-center gap-2">
        {t("maps.analysis.radius")}
        <input type="number" min={0.1} max={100} step={0.5} value={km} onChange={(e) => setKm(Math.min(100, Math.max(0.1, Number(e.target.value) || 1)))} className="w-20 rounded border px-1" />
        km
      </label>
      <div className="flex gap-2">
        <button type="button" className="rounded border px-2 py-1" onClick={() => void run()} disabled={busy}>{t("maps.analysis.run", { count: String(sites.length) })}</button>
        {shown && <button type="button" className="rounded border px-2 py-1" onClick={() => { setShown(false); setPopulation(null); onRings(null); }}>{t("maps.analysis.clear")}</button>}
      </div>
      {shown && (
        <div className="space-y-2">
          {population?.ok === true && <p>{t("maps.analysis.population", { people: formatFullNumber(population.people, lang), km: String(km), cell: String(population.cellKm), source: population.source, year: population.year })}</p>}
          {population?.ok === false && <p className="text-xs text-slate-500">{t(population.reason === "NO_GRID" || population.reason === "OUTSIDE_GRID" ? "maps.analysis.noPopulation" : "maps.analysis.populationFailed")}</p>}
          {inside?.ok && <p>{t("maps.analysis.inside", { count: String(inside.inside.length), km: String(km) })}{inside.inside.length > 0 && `: ${inside.inside.slice(0, 12).map((x) => x.name).join(", ")}${inside.inside.length > 12 ? "…" : ""}`}</p>}
          <div>
            <p className="font-medium">{t("maps.analysis.nearestTitle")}</p>
            <ul className="text-xs">
              {nearest.rows.slice(0, 15).map((r) => <li key={r.siteId}>{r.siteName}: {r.km === null ? t("maps.analysis.noFacility") : t("maps.analysis.nearest", { name: r.facilityName ?? "", km: r.km.toFixed(1) })}</li>)}
            </ul>
          </div>
          <p className="text-xs text-slate-500">{t("maps.analysis.note")}</p>
        </div>
      )}
    </section>
  );
}
