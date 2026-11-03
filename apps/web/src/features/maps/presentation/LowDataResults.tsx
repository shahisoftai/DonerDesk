"use client";

import { useEffect, useMemo, useState } from "react";
import { getPlaceResultsAction } from "@/lib/actions/places";
import type { PlaceResults } from "@/lib/server/schemas-places";
import { buildExplorerModel, placePanel } from "../domain/map-explorer";
import { periodSteps } from "../domain/period-steps";
import { buildMapTable } from "../domain/table/map-table";
import { MapDataTable } from "./MapDataTable";
import { PeriodSlider } from "./PeriodSlider";
import { PlacePanel } from "./PlacePanel";
import { useMapText } from "./useMapText";
import type { ExplorerProps } from "./results-loader";

/**
 * Results by place for a slow connection (low-data mode): the same figures as the map, as a table, with no map library, no tiles and no boundary
 * files. Everything that is a choice stays: the indicator, the level, the period, and a place's details. "Show the map anyway" is one click.
 */
export function LowDataResults({ projectId, places, initial, periods, loadResults, onShowMap }: ExplorerProps & { onShowMap: () => void }) {
  const { t, levelSingular } = useMapText();
  const read = loadResults ?? ((id: string, level: number, period?: string) => getPlaceResultsAction(id, level, period));
  const [results, setResults] = useState<PlaceResults | null>(initial);
  const [indicatorId, setIndicatorId] = useState(initial?.indicators[0]?.id ?? "");
  const [level, setLevel] = useState<number | null>(initial?.level ?? null);
  const [periodId, setPeriodId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const steps = useMemo(() => periodSteps(periods), [periods]);

  useEffect(() => {
    if (level === null) return;
    let live = true;
    void read(projectId, level, periodId ?? undefined).then((out) => {
      if (!live) return;
      if (!out.ok) { setError(out.error.message); return; }
      setError(null);
      setResults(out.value);
      setIndicatorId((current) => (out.value.indicators.some((i) => i.id === current) ? current : (out.value.indicators[0]?.id ?? "")));
    });
    return () => { live = false; };
    // Asked again when the level or the period changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, periodId, projectId]);

  const model = useMemo(() => (results ? buildExplorerModel(results, places, indicatorId) : null), [results, places, indicatorId]);
  const indicator = results?.indicators.find((i) => i.id === indicatorId);
  const rows = useMemo(() => (model ? buildMapTable(model, [], (id) => places.find((p) => p.id === id)?.adminLevel) : []), [model, places]);
  const panel = selectedId ? placePanel(selectedId, places, results, indicatorId) : null;
  const selectedName = selectedId ? places.find((p) => p.id === selectedId)?.name ?? "" : "";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-sm" role="note">
        <p>{t("maps.lowData.note")}</p>
        <button type="button" className="font-medium underline" onClick={onShowMap}>{t("maps.lowData.show")}</button>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1">{t("maps.indicator")}
          <select className="input" value={indicatorId} onChange={(e) => setIndicatorId(e.target.value)}>
            {(results?.indicators ?? []).map((i) => <option key={i.id} value={i.id}>{i.code} {i.name}</option>)}
          </select>
        </label>
        {(results?.levelsAvailable.length ?? 0) > 1 && (
          <label className="flex items-center gap-1">{t("maps.levelShown")}
            <select className="input" value={level ?? ""} onChange={(e) => setLevel(Number(e.target.value))}>
              {results!.levelsAvailable.map((l) => <option key={l} value={l}>{levelSingular(l)}</option>)}
            </select>
          </label>
        )}
      </div>
      <PeriodSlider steps={steps} periodId={periodId} onChange={setPeriodId} />
      {error && <p role="alert" className="text-sm text-danger-600">{error}</p>}
      <div className="grid gap-3 lg:grid-cols-[1fr_18rem]">
        <MapDataTable rows={rows} unit={indicator?.unit ?? null} selectedPlaceId={selectedId} onSelect={(row) => setSelectedId(row.placeId)} />
        {selectedId && <PlacePanel panel={panel} name={selectedName} canDrill={false} onDrill={() => undefined} onSelect={(id) => setSelectedId(id)} onClose={() => setSelectedId(null)} />}
      </div>
    </div>
  );
}
