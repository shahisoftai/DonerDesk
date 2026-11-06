"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getPlaceResultsAction } from "@/lib/actions/places";
import type { PlaceResults } from "@/lib/server/schemas-places";
import { loadBoundaryManifest } from "@/lib/client/boundary-loader";
import { useColorMode } from "../../design/presentation/use-color-mode";
import { attributionLine, fileFor, findCountry, type BoundaryManifest } from "../domain/boundary-sources";
import { joinUnits, matchedByNameOnly, nameRef } from "../domain/boundaries/join";
import { WORLD_PATH, decodePath, encodePath, levelBelow, open, resultsLevelFor, shownLevel, toCrumb, type DrillPath } from "../domain/drill/drill-path";
import { NO_BASEMAP, type BasemapNote } from "../domain/basemap/regions";
import type { BoundaryOrigin } from "../ports/boundary-source";
import { buildMapTable } from "../domain/table/map-table";
import { DEFAULT_LAYERS, OVERLAY_LAYER, buildExplorerModel, summaryCounts, moveLayer, panelPeriods, placePanel, setLayerOpacity, sharedBands, toggleLayer, withBands, type ExplorerModel } from "../domain/map-explorer";
import type { FeatureRef } from "../domain/model/scene";
import type { Overlay } from "../domain/overlay-layer";
import { periodSteps } from "../domain/period-steps";
import { buildResultsScene } from "../domain/scene/build-scene";
import { LayerPanel } from "./LayerPanel";
import { MapBreadcrumbs } from "./MapBreadcrumbs";
import { MapDataTable } from "./MapDataTable";
import { MapLibreCanvas } from "./MapLibreCanvas";
import { useMapServices } from "./MapServices";
import { OverlayPanel } from "./OverlayPanel";
import { PeriodSlider } from "./PeriodSlider";
import { PlacePanel } from "./PlacePanel";
import { PlaceTree } from "./PlaceTree";
import { pathForPlace } from "../domain/drill/place-path";
import { useBoundaryView } from "./useBoundaryView";
import { useMapText } from "./useMapText";
import type { ExplorerProps } from "./results-loader";

const EMPTY_MODEL: ExplorerModel = { indicatorId: "", level: 1, pins: [], regions: [], unmapped: [], bands: [], isRate: false };
const ADDRESS_KEY = "map";

interface Selection { ref: string | null; placeId: string | null; name: string }

/**
 * The interactive results map on the new engine: a real basemap, smooth zoom, clustering, and drilling from the world down to
 * admin 4 wherever boundary files exist. It composes the pieces; the rules are in `domain/` and the drawing is behind a port.
 */
export function ResultsMap({ projectId, places, initial, periods, compact = false, loadResults, staticData = false, activityCounts, lockedIndicatorId, periodId: heldPeriod, onPeriodChange, onUnavailable }: ExplorerProps & { onUnavailable: () => void }) {
  const services = useMapServices();
  const { t, lang, levelPlural } = useMapText();
  const read = loadResults ?? ((id: string, level: number, period?: string) => getPlaceResultsAction(id, level, period));
  const dark = useColorMode() === "dark";
  const addressed = !compact && !staticData;

  const [path, setPath] = useState<DrillPath>(WORLD_PATH);
  const [results, setResults] = useState<PlaceResults | null>(initial);
  const [chosenIndicator, setIndicatorId] = useState(initial?.indicators[0]?.id ?? "");
  const indicatorId = lockedIndicatorId ?? chosenIndicator;
  const [layers, setLayers] = useState(DEFAULT_LAYERS);
  const [selected, setSelected] = useState<Selection | null>(null);
  /** What opening the chosen boundary would show ("districts"), or null when it cannot be opened. */
  const [openLevel, setOpenLevel] = useState<number | null>(null);
  const [ownPeriod, setOwnPeriod] = useState<string | null>(null);
  const periodId = heldPeriod !== undefined ? heldPeriod : ownPeriod;
  const setPeriodId = onPeriodChange ?? setOwnPeriod;
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [ground, setGround] = useState<"auto" | "plain">("auto");
  const [note, setNote] = useState<BasemapNote | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [manifest, setManifest] = useState<BoundaryManifest | null>(null);
  const [compare, setCompare] = useState(false);
  const [panels, setPanels] = useState<Array<{ label: string; results: PlaceResults }>>([]);
  const [error, setError] = useState<string | null>(null);
  /** Set when the drawn level is the organisation's own upload: its credit replaces the shipped files'. */
  const [credit, setCredit] = useState<BoundaryOrigin | null>(null);
  const steps = useMemo(() => periodSteps(periods), [periods]);
  const view = useBoundaryView(path, services.boundaries);

  useEffect(() => { void loadBoundaryManifest().then(setManifest); }, []);

  // A project working in one country opens on it; a bookmarked address (?map=0:name:uganda/1:UG01) opens where it was.
  useEffect(() => {
    const fromAddress = addressed ? decodePath(new URLSearchParams(window.location.search).get(ADDRESS_KEY)) : [];
    if (fromAddress.length > 0) { setPath(fromAddress.map((c) => ({ level: c.level, ref: c.ref, name: c.ref.replace(/^name:/, "").replace(/_/g, " ") }))); return; }
    const countries = places.filter((p) => !p.archived && p.adminLevel === 0);
    if (countries.length === 1) setPath([{ level: 0, name: countries[0]!.name, ref: nameRef(countries[0]!.name) }]);
    // Once, on opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Names learnt from the loaded boundaries replace the placeholders an address gave.
  useEffect(() => {
    if (view.opened.length === 0) return;
    const named = path.map((c, i) => (view.opened[i] && view.opened[i]!.name !== c.name ? { ...c, name: view.opened[i]!.name } : c));
    if (named.some((c, i) => c !== path[i])) setPath(named);
  }, [view.opened, path]);

  useEffect(() => {
    if (!addressed) return;
    const url = new URL(window.location.href);
    if (path.length === 0) url.searchParams.delete(ADDRESS_KEY); else url.searchParams.set(ADDRESS_KEY, encodePath(path));
    window.history.replaceState(null, "", url);
  }, [path, addressed]);

  useEffect(() => {
    if (view.status === "loading") return;
    const level = resultsLevelFor(view.shown, results?.levelsAvailable ?? []);
    let live = true;
    void read(projectId, level, periodId ?? undefined).then((out) => {
      if (!live) return;
      if (!out.ok) { setError(out.error.message); return; }
      setError(null);
      setResults(out.value);
      setIndicatorId((current) => (out.value.indicators.some((i) => i.id === current) ? current : (out.value.indicators[0]?.id ?? "")));
    });
    return () => { live = false; };
    // Asked again when the drawn level or the period changes; the levels available do not change what is asked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.shown, view.status, projectId, periodId]);

  useEffect(() => {
    setCredit(null);
    if (!path[0] || view.shown < 1 || view.status !== "ready") return;
    let live = true;
    void services.boundaries.originOf({ name: path[0].name }, view.shown).then((c) => { if (live) setCredit(c); });
    return () => { live = false; };
  }, [path, view.shown, view.status, services]);

  const model = useMemo(() => (results ? buildExplorerModel(results, places, indicatorId) : null), [results, places, indicatorId]);
  const indicator = results?.indicators.find((i) => i.id === indicatorId);
  const joined = useMemo(() => {
    const ids = new Set((model ?? EMPTY_MODEL).regions.map((r) => r.placeId));
    return joinUnits(view.units, places.filter((p) => ids.has(p.id)), places);
  }, [view.units, model, places]);

  const scene = useMemo(() => buildResultsScene({
    model: model ?? EMPTY_MODEL, layers, joined, unit: indicator?.unit ?? null, selectedRef: selected?.ref ?? null,
    selectedPlaceId: selected?.placeId ?? null, overlay, basemap: ground === "plain" ? "plain" : dark ? "dark" : "light", lang,
    label: t("maps.summary", { ...summaryCounts(model ?? EMPTY_MODEL) }),
  }), [model, layers, joined, indicator, selected, overlay, ground, dark, lang, t]);

  // Side-by-side periods: one small map per period on one shared scale.
  const latest = useMemo(() => panelPeriods(periods), [periods]);
  useEffect(() => {
    if (!compare || view.status === "loading") return;
    let live = true;
    const level = resultsLevelFor(view.shown, results?.levelsAvailable ?? []);
    void Promise.all(latest.map((p) => read(projectId, level, p.id).then((o) => (o.ok ? { label: p.label, results: o.value } : null)))).then((all) => { if (live) setPanels(all.filter((x): x is { label: string; results: PlaceResults } => x !== null)); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compare, view.shown, view.status, projectId, latest]);
  const panelScenes = useMemo(() => {
    const models = panels.map((p) => ({ label: p.label, model: buildExplorerModel(p.results, places, indicatorId) })).filter((x): x is { label: string; model: ExplorerModel } => x.model !== null);
    const bands = sharedBands(models.map((m) => m.model));
    return models.map((m) => ({ label: m.label, scene: buildResultsScene({ model: withBands(m.model, bands), layers, joined: joinUnits(view.units, places.filter((p) => m.model.regions.some((r) => r.placeId === p.id)), places), unit: indicator?.unit ?? null, selectedRef: null, selectedPlaceId: null, basemap: "plain", lang, label: `${m.label}: ${t("maps.summary", { ...summaryCounts(m.model) })}` }) }));
  }, [panels, places, indicatorId, layers, view.units, indicator, lang, t]);

  // Whether the chosen boundary can be opened. At the world that depends on the chosen country's own files.
  useEffect(() => {
    setOpenLevel(null);
    if (!selected?.ref || staticData) return;
    if (path.length > 0) { setOpenLevel(levelBelow(view.shown, view.levels)); return; }
    let live = true;
    void services.boundaries.levelsFor({ name: selected.name }).then((levels) => { if (live) setOpenLevel(levelBelow(shownLevel(WORLD_PATH, levels), levels)); });
    return () => { live = false; };
  }, [selected, path, view.levels, services, staticData]);

  const tableRows = useMemo(() => (model ? buildMapTable(model, joined, (id) => places.find((p) => p.id === id)?.adminLevel) : []), [model, joined, places]);

  const choose = useCallback((ref: FeatureRef | null) => {
    if (!ref) { setSelected(null); return; }
    if (ref.kind === "PIN") { const p = places.find((x) => x.id === ref.id); setSelected(p ? { ref: null, placeId: p.id, name: p.name } : null); return; }
    const hit = joined.find((j) => j.unit.ref === ref.id);
    setSelected(hit ? { ref: hit.unit.ref, placeId: hit.placeId, name: hit.unit.name } : null);
  }, [places, joined]);

  /** From the place tree: take the map to the place (its ancestors opened, its own boundary chosen). */
  const focusPlace = useCallback((placeId: string) => {
    const hit = pathForPlace(places, placeId);
    const place = places.find((p) => p.id === placeId);
    if (!hit || !place) return;
    setPath(hit.path);
    setSelected({ ref: hit.ref, placeId, name: place.name });
  }, [places]);
  const figureIds = useMemo(() => (model ? [...model.regions, ...model.pins].filter((r) => r.value !== null).map((r) => r.placeId) : []), [model]);

  async function openSelected() {
    if (!selected?.ref) return;
    const levels = path.length === 0 ? await services.boundaries.levelsFor({ name: selected.name }) : view.levels;
    setPath(open(path, { name: selected.name, ref: selected.ref }, levels));
    setSelected(null);
  }

  const showOverlay = useCallback((o: Overlay | null) => {
    setOverlay(o);
    setLayers((l) => (o ? (l.some((x) => x.id === "OVERLAY") ? l : [...l, OVERLAY_LAYER]) : l.filter((x) => x.id !== "OVERLAY")));
  }, []);

  if (places.length === 0) return <div className="card text-sm"><p>{t("maps.noPlaces")}</p><Link className="mt-2 inline-block font-medium underline" href="/settings/places">{t("maps.addPlaces")}</Link></div>;
  if (results?.noPlaces) return <p className="card text-sm">{t("maps.noEntries")}</p>;

  const country = path[0] && manifest ? findCountry(manifest, path[0].name) : null;
  const fileEntry = country && view.shown >= 2 ? fileFor(country, view.shown as 2 | 3 | 4) : null;
  const panel = selected?.placeId ? placePanel(selected.placeId, places, results, indicatorId) : null;
  const byName = matchedByNameOnly(joined);
  const bands = model?.bands ?? [];
  const finest = view.levels[view.levels.length - 1];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <MapBreadcrumbs path={path} onBack={(i) => { setPath(toCrumb(path, i)); setSelected(null); }} />
        {!lockedIndicatorId && <label className="flex items-center gap-1">{t("maps.indicator")}
          <select className="input" value={indicatorId} onChange={(e) => setIndicatorId(e.target.value)}>
            {(results?.indicators ?? []).map((i) => <option key={i.id} value={i.id}>{i.code} {i.name}</option>)}
          </select>
        </label>}
        {!compact && (
          <label className="flex items-center gap-1">{t("maps.ground")}
            <select className="input" value={ground} onChange={(e) => setGround(e.target.value as "auto" | "plain")}>
              <option value="auto">{t("maps.ground.auto")}</option>
              <option value="plain">{t("maps.ground.plain")}</option>
            </select>
          </label>
        )}
      </div>
      {!compact && (
        <div className="flex flex-wrap items-center gap-4" data-no-print>
          {!staticData && <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} /> {t("maps.compare")}</label>}
          <button type="button" className="text-sm font-medium underline" onClick={() => window.print()}>{t("maps.print")}</button>
        </div>
      )}
      <p className="hidden text-sm print:block">{t("maps.printLine", { indicator: indicator ? `${indicator.code} ${indicator.name}` : t("maps.printTitle"), where: path.length > 0 ? path[path.length - 1]!.name : t("maps.world"), date: new Date().toISOString().slice(0, 10) })}</p>
      <PeriodSlider steps={steps} periodId={periodId} onChange={setPeriodId} />
      {!compact && compare && !staticData && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label={t("maps.sideBySide")}>
          {panelScenes.map((m) => (
            <figure key={m.label} className="rounded-lg border p-2">
              <figcaption className="text-sm font-medium">{m.label}</figcaption>
              <MapLibreCanvas scene={m.scene} height="h-56" onSelect={() => {}} onFailed={onUnavailable} />
            </figure>
          ))}
          {panelScenes.length === 0 && <p className="text-sm text-slate-500">{t("maps.loadingPeriods")}</p>}
        </div>
      )}
      {error && <p role="alert" className="text-sm text-danger-600">{error}</p>}
      {view.status === "error" && <p role="alert" className="text-sm text-danger-600">{t("maps.boundariesFailed")}</p>}
      <div className={compact ? "grid gap-3" : "grid gap-3 lg:grid-cols-[1fr_18rem]"}>
        <div className="space-y-2">
          <MapLibreCanvas scene={scene} height={compact ? "h-[26rem]" : "h-[28rem]"} onSelect={choose} onNote={setNote} onFailed={onUnavailable} />
          {model && (
            <div className="flex flex-wrap items-center gap-2 text-xs" aria-label={t("maps.legend")}>
              {bands.map((b, i) => <span key={i} className="inline-flex items-center gap-1"><span className="inline-block h-3 w-5" style={{ background: b.color }} /><bdi dir="ltr">{Math.round(b.from) === Math.round(b.to) ? Math.round(b.from).toLocaleString() : `${Math.round(b.from).toLocaleString()}–${Math.round(b.to).toLocaleString()}`}</bdi></span>)}
              <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-5" style={{ background: "#e5e7eb" }} />{t("maps.notMeasured")}</span>
            </div>
          )}
          {model && <p className="text-sm text-slate-600">{t("maps.summary", { ...summaryCounts(model) })}</p>}
          {note === NO_BASEMAP && <p className="text-xs text-slate-500">{t("maps.noBasemap")}</p>}
          {path.length === 1 && view.status === "ready" && finest !== undefined && finest < 4 && <p className="text-xs text-slate-500">{t("maps.finest", { country: path[0]!.name, level: levelPlural(finest) })}</p>}
          {byName > 0 && <p className="text-xs text-slate-500">{t("maps.byNameOnly", { count: byName })}</p>}
          {credit ? <p className="text-xs text-slate-500" data-testid="boundary-credit">{t("maps.credit.uploaded", { country: credit.countryName, name: credit.layerName })}</p> : country && fileEntry && <p className="text-xs text-slate-500">{attributionLine(country, view.shown as 2 | 3 | 4)}</p>}
          <p className="text-xs text-slate-500" data-no-print><Link className="underline" href="/maps/sources">{t("maps.sources.link")}</Link></p>
          {model && model.unmapped.length > 0 && <p className="text-xs text-slate-500">{t("maps.unmappedList", { names: model.unmapped.map((u) => u.name).join(", ") })}</p>}
          <div data-no-print>
            <button type="button" className="text-sm font-medium underline" aria-expanded={showTable} aria-controls="map-as-table" onClick={() => setShowTable((v) => !v)}>{showTable ? t("maps.table.hide") : t("maps.table.show")}</button>
            {showTable && <div id="map-as-table" className="mt-2"><MapDataTable rows={tableRows} unit={indicator?.unit ?? null} selectedPlaceId={selected?.placeId ?? null} onSelect={(row) => setSelected({ ref: row.ref, placeId: row.placeId, name: row.name })} /></div>}
          </div>
        </div>
        <div className="space-y-3" data-no-print>
          {!compact && <PlaceTree places={places} activityCounts={activityCounts ?? {}} figurePlaceIds={figureIds} selectedId={selected?.placeId ?? null} onSelect={focusPlace} />}
          {!compact && <LayerPanel layers={layers} onToggle={(id) => setLayers((l) => toggleLayer(l, id))} onOpacity={(id, v) => setLayers((l) => setLayerOpacity(l, id, v))} onMove={(id, d) => setLayers((l) => moveLayer(l, id, d))} />}
          {!compact && <OverlayPanel onOverlay={showOverlay} />}
          {selected && <PlacePanel panel={panel} name={selected.name} canDrill={openLevel !== null} drillLabel={openLevel !== null ? t("maps.open", { level: levelPlural(openLevel) }) : undefined} onDrill={() => void openSelected()} onSelect={(id) => { const p = places.find((x) => x.id === id); if (p) setSelected({ ref: null, placeId: p.id, name: p.name }); }} onClose={() => setSelected(null)} />}
        </div>
      </div>
    </div>
  );
}
