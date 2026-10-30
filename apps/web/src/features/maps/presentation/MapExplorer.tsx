"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getPlaceResultsAction } from "@/lib/actions/places";
import type { PlaceItem, PlaceResults } from "@/lib/server/schemas-places";
import { loadMapAssets } from "@/lib/client/map-assets";
import { provincesOf } from "../../workplan/domain/site-map";
import type { NamedGeoCollection } from "../../workplan/domain/geo/geo-types";
import {
  DEFAULT_LAYERS, OVERLAY_LAYER, buildExplorerModel, defaultView, drillInto, drillUp, levelForView, mapSummary, moveLayer, withDepth, placeForRegion, placePanel,
  setLayerOpacity, toggleLayer, sharedBands, withBands, panelPeriods, type DrillState,
} from "../domain/map-explorer";
import { DRILL_MAP_NAME, WORLD_MAP_NAME, explorerOption } from "../domain/map-option";
import { MapCanvas, type MapRegistration } from "./MapCanvas";
import { LayerPanel } from "./LayerPanel";
import { PlacePanel } from "./PlacePanel";
import { PeriodSlider } from "./PeriodSlider";
import { parseOverlay, type Overlay } from "../domain/overlay-layer";
import { loadBoundaryFile, loadBoundaryManifest } from "@/lib/client/boundary-loader";
import { attributionLine, fileFor, findCountry, levelsFor, type BoundaryManifest } from "../domain/boundary-sources";
import { periodSteps } from "../domain/period-steps";

/**
 * The interactive map (Phase 35.0): hover for the figure, click for the place panel, open a country's provinces,
 * switch the indicator, and show, hide, fade or reorder layers. It composes the pieces; the rules are in `domain/`.
 */
/** `compact` is the dashboard card: one column, no layer panel, no file layer and no side-by-side periods; everything else (hover, click, drill, detail, indicator, time slider) is the same. */
export function MapExplorer({ projectId, places, initial, periods, compact = false }: { projectId: string; places: readonly PlaceItem[]; initial: PlaceResults | null; periods: ReadonlyArray<{ id: string; label: string }>; compact?: boolean }) {
  const [view, setView] = useState<DrillState>(() => defaultView(places));
  const [results, setResults] = useState<PlaceResults | null>(initial);
  const [indicatorId, setIndicatorId] = useState(initial?.indicators[0]?.id ?? "");
  const [layers, setLayers] = useState(DEFAULT_LAYERS);
  const [selected, setSelected] = useState<{ name: string; placeId: string | null } | null>(null);
  const [geo, setGeo] = useState<{ world: NamedGeoCollection; admin1: NamedGeoCollection } | null>(null);
  const [periodId, setPeriodId] = useState<string | null>(null);
  const steps = useMemo(() => periodSteps(periods), [periods]);
  const [boundaries, setBoundaries] = useState<BoundaryManifest | null>(null);
  const [fine, setFine] = useState<NamedGeoCollection | null>(null);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [overlayError, setOverlayError] = useState<string | null>(null);
  const [compare, setCompare] = useState(false);
  const [panels, setPanels] = useState<Array<{ label: string; results: PlaceResults }>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void loadBoundaryManifest().then(setBoundaries); }, []);
  useEffect(() => { void loadMapAssets().then((a) => setGeo({ world: a.world, admin1: a.admin1 })).catch(() => setError("The map data could not be loaded.")); }, []);

  useEffect(() => {
    const level = levelForView(view, results?.levelsAvailable ?? []);
    let live = true;
    void getPlaceResultsAction(projectId, level, periodId ?? undefined).then((out) => {
      if (!live) return;
      if (!out.ok) { setError(out.error.message); return; }
      setError(null);
      setResults(out.value);
      setIndicatorId((current) => (out.value.indicators.some((i) => i.id === current) ? current : (out.value.indicators[0]?.id ?? "")));
    });
    return () => { live = false; };
    // The level is decided by the view; the available levels do not change what is asked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, projectId, periodId]);

  const panelPeriodsList = useMemo(() => panelPeriods(periods), [periods]);
  useEffect(() => {
    if (!compare) return;
    let live = true;
    const lvl = levelForView(view, results?.levelsAvailable ?? []);
    void Promise.all(panelPeriodsList.map((p) => getPlaceResultsAction(projectId, lvl, p.id).then((o) => (o.ok ? { label: p.label, results: o.value } : null)))).then((all) => {
      if (live) setPanels(all.filter((x): x is { label: string; results: PlaceResults } => x !== null));
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compare, view, projectId, panelPeriodsList]);
  const panelModels = useMemo(() => {
    const models = panels.map((p) => ({ label: p.label, model: buildExplorerModel(p.results, places, indicatorId) })).filter((x): x is { label: string; model: NonNullable<ReturnType<typeof buildExplorerModel>> } => x.model !== null);
    const bands = sharedBands(models.map((m) => m.model));
    return models.map((m) => ({ label: m.label, model: withBands(m.model, bands) }));
  }, [panels, places, indicatorId]);


  const model = useMemo(() => (results ? buildExplorerModel(results, places, indicatorId) : null), [results, places, indicatorId]);
  const countryFiles = useMemo(() => (view.kind === "COUNTRY" && boundaries ? findCountry(boundaries, view.country) : null), [boundaries, view]);
  const finerEntry = view.kind === "COUNTRY" && view.depth > 1 ? fileFor(countryFiles, view.depth as 2 | 3) : null;
  useEffect(() => {
    setFine(null);
    if (finerEntry) void loadBoundaryFile(finerEntry).then((c) => { setFine(c); if (!c) setError("The district boundaries could not be loaded."); });
  }, [finerEntry]);
  const drillCollection = useMemo(() => {
    if (!geo || view.kind !== "COUNTRY") return null;
    return view.depth > 1 ? fine : provincesOf(geo.admin1, view.country);
  }, [geo, view, fine]);
  const baseCollection = view.kind === "WORLD" ? geo?.world ?? null : drillCollection;
  const registrations = useMemo<MapRegistration[]>(() => {
    if (!baseCollection) return [];
    return [{ name: view.kind === "WORLD" ? WORLD_MAP_NAME : DRILL_MAP_NAME, collection: baseCollection }];
  }, [baseCollection, view.kind]);
  const indicator = results?.indicators.find((i) => i.id === indicatorId);
  const option = useMemo(() => {
    if (!model || !baseCollection) return null;
    return explorerOption({ model, layers, view, featureNames: baseCollection.features.map((f) => f.properties.name), unit: indicator?.unit ?? null, selectedPlaceId: selected?.placeId ?? null, overlay });
  }, [model, baseCollection, layers, view, indicator, selected, overlay]);

  const level = levelForView(view, results?.levelsAvailable ?? []);
  const panel = selected?.placeId ? placePanel(selected.placeId, places, results, indicatorId) : null;
  const canDrill = view.kind === "WORLD" && !!geo && !!selected && provincesOf(geo.admin1, selected.name) !== null;

  async function loadOverlay(file: File | undefined) {
    if (!file) return;
    const parsed = parseOverlay(await file.text(), file.name);
    if (!parsed.ok) { setOverlayError(parsed.reason); return; }
    setOverlayError(null);
    setOverlay(parsed.overlay);
    setLayers((l) => (l.some((x) => x.id === "OVERLAY") ? l : [...l, OVERLAY_LAYER]));
  }

  function selectRegion(name: string) {
    setSelected({ name, placeId: placeForRegion(name, places, level)?.id ?? null });
  }

  if (places.length === 0) {
    return <div className="card text-sm"><p>No places are listed yet.</p><Link className="mt-2 inline-block font-medium underline" href="/settings/places">Add places</Link></div>;
  }
  if (results?.noPlaces) return <p className="card text-sm">The places list has no entries for this project.</p>;
  const bands = model?.bands ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <nav aria-label="Map location" className="flex items-center gap-1">
          <button type="button" className="underline" onClick={() => { setView(drillUp(view)); setSelected(null); }} disabled={view.kind === "WORLD"}>World</button>
          {view.kind === "COUNTRY" && <><span aria-hidden>›</span><strong>{view.country}</strong></>}
          {view.kind === "COUNTRY" && levelsFor(countryFiles).length > 0 && (
            <span role="group" aria-label="Detail" className="ms-2 flex gap-1">
              {([1, ...levelsFor(countryFiles)] as const).map((d) => (
                <button key={d} type="button" aria-pressed={view.depth === d} className={`rounded-full border px-2 ${view.depth === d ? "border-brand-600 bg-brand-50" : ""}`} onClick={() => setView(withDepth(view, d))}>{d === 1 ? "Provinces" : d === 2 ? "Districts" : "Sub-districts"}</button>
              ))}
            </span>
          )}
        </nav>
        <label className="flex items-center gap-1">Indicator
          <select className="input" value={indicatorId} onChange={(e) => setIndicatorId(e.target.value)}>
            {(results?.indicators ?? []).map((i) => <option key={i.id} value={i.id}>{i.code} {i.name}</option>)}
          </select>
        </label>
      </div>
      {!compact && <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} /> Compare the latest periods side by side</label>}
      <PeriodSlider steps={steps} periodId={periodId} onChange={setPeriodId} />
      {!compact && compare && baseCollection && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Periods side by side">
          {panelModels.map((m) => (
            <figure key={m.label} className="rounded-lg border p-2">
              <figcaption className="text-sm font-medium">{m.label}</figcaption>
              <MapCanvas height="h-56" option={explorerOption({ model: m.model, layers, view, featureNames: baseCollection.features.map((f) => f.properties.name), unit: indicator?.unit ?? null, selectedPlaceId: null })} registrations={registrations} label={`${m.label}: ${mapSummary(m.model)}`} onRegion={() => {}} onPin={() => {}} />
            </figure>
          ))}
          {panelModels.length === 0 && <p className="text-sm text-slate-500">Loading the periods…</p>}
        </div>
      )}
      {error && <p role="alert" className="text-sm text-danger-600">{error}</p>}
      <div className={compact ? "grid gap-3" : "grid gap-3 lg:grid-cols-[1fr_18rem]"}>
        <div className="space-y-2">
          {option ? (
            <MapCanvas option={option} registrations={registrations} height={compact ? "h-[26rem]" : "h-[28rem]"} label={model ? mapSummary(model) : "Map"} onRegion={selectRegion}
              onPin={(id) => { const p = places.find((x) => x.id === id); if (p) setSelected({ name: p.name, placeId: p.id }); }} />
          ) : <p className="text-sm text-slate-500">{results ? "Nothing to draw yet for this indicator." : "Loading…"}</p>}
          {model && (
            <div className="flex flex-wrap items-center gap-2 text-xs" aria-label="Legend">
              {bands.map((b, i) => <span key={i} className="inline-flex items-center gap-1"><span className="inline-block h-3 w-5" style={{ background: b.color }} />{Math.round(b.from) === Math.round(b.to) ? Math.round(b.from).toLocaleString() : `${Math.round(b.from).toLocaleString()}–${Math.round(b.to).toLocaleString()}`}</span>)}
              <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-5" style={{ background: "#e5e7eb" }} />Not measured</span>
            </div>
          )}
          {model && <p className="text-sm text-slate-600">{mapSummary(model)}</p>}
          {view.kind === "COUNTRY" && view.depth > 1 && countryFiles && <p className="text-xs text-slate-500">{attributionLine(countryFiles, view.depth as 2 | 3)}</p>}
          {model && model.unmapped.length > 0 && <p className="text-xs text-slate-500">Not on the map (no pin): {model.unmapped.map((u) => u.name).join(", ")}</p>}
        </div>
        <div className="space-y-3">
          {!compact && <LayerPanel layers={layers} onToggle={(id) => setLayers((l) => toggleLayer(l, id))} onOpacity={(id, v) => setLayers((l) => setLayerOpacity(l, id, v))} onMove={(id, d) => setLayers((l) => moveLayer(l, id, d))} />}
          {!compact && <div className="text-sm">
            <label className="block font-medium">Add a GeoJSON file as a layer
              <input type="file" accept=".geojson,.json,application/geo+json" className="mt-1 block w-full text-xs" onChange={(e) => void loadOverlay(e.target.files?.[0])} />
            </label>
            <p className="text-xs text-slate-500">Drawn for this visit only; nothing is saved.</p>
            {overlayError && <p role="alert" className="text-xs text-danger-600">{overlayError}</p>}
            {overlay && <button type="button" className="text-xs underline" onClick={() => { setOverlay(null); setLayers((l) => l.filter((x) => x.id !== "OVERLAY")); }}>Remove “{overlay.name}”</button>}
          </div>}
          {selected && <PlacePanel panel={panel} name={selected.name} canDrill={canDrill} onDrill={() => { setView(drillInto(selected.name)); setSelected(null); }} onSelect={(id) => { const p = places.find((x) => x.id === id); if (p) setSelected({ name: p.name, placeId: p.id }); }} onClose={() => setSelected(null)} />}
        </div>
      </div>
    </div>
  );
}
