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
import { LOW_DETAIL_BASEMAP, NO_BASEMAP, type BasemapNote } from "../domain/basemap/regions";
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
import { CalloutLayer } from "./CalloutLayer";
import { MapLegend } from "./MapLegend";
import { calloutAnchors } from "../domain/scene/callout-anchors";
import { useMapServices } from "./MapServices";
import { OverlayPanel } from "./OverlayPanel";
import { PeriodSlider } from "./PeriodSlider";
import { PlacePanel } from "./PlacePanel";
import { PlaceTree } from "./PlaceTree";
import { pathForPlace } from "../domain/drill/place-path";
import { useBoundaryView } from "./useBoundaryView";
import { useMapContext } from "./useMapContext";
import { GROUND_COLOUR, MAP_GROUNDS, groundOf, groundPlan, type MapGround } from "../domain/ground";
import { countryMask } from "../domain/scene/country-mask";
import type { MaskLayerSpec } from "../domain/model/scene";
import { AnalysisPanel } from "./AnalysisPanel";
import { ContextLayerToggles } from "./ContextLayerToggles";
import { contextLayers, offeredContext, type ContextToggle } from "../domain/scene/context-layers";
import { useMapText } from "./useMapText";
import type { ExplorerProps } from "./results-loader";
import { firstIndicator } from "./results-loader";
import { homeCountry } from "../domain/drill/home-country";

const EMPTY_MODEL: ExplorerModel = { indicatorId: "", level: 1, pins: [], regions: [], unmapped: [], bands: [], isRate: false };
const ADDRESS_KEY = "map";

interface Selection { ref: string | null; placeId: string | null; name: string }

/**
 * The interactive results map on the new engine: a real basemap, smooth zoom, clustering, and drilling from the world down to
 * admin 4 wherever boundary files exist. It composes the pieces; the rules are in `domain/` and the drawing is behind a port.
 */
export function ResultsMap({ projectId, places, initial, initialIndicatorId, periods, compact = false, loadResults, staticData = false, activityCounts, mapContext: serverMapContext, lockedIndicatorId, periodId: heldPeriod, onPeriodChange, onUnavailable, areaStyle, callouts, ground: savedGround }: ExplorerProps & { onUnavailable: () => void }) {
  const services = useMapServices();
  const { t, lang, levelPlural } = useMapText();
  const read = loadResults ?? ((id: string, level: number, period?: string) => getPlaceResultsAction(id, level, period));
  const dark = useColorMode() === "dark";
  const addressed = !compact && !staticData;

  const [path, setPath] = useState<DrillPath>(WORLD_PATH);
  const [results, setResults] = useState<PlaceResults | null>(initial);
  const [chosenIndicator, setIndicatorId] = useState(firstIndicator(initial, initialIndicatorId));
  const indicatorId = lockedIndicatorId ?? chosenIndicator;
  const [layers, setLayers] = useState(DEFAULT_LAYERS);
  const [selected, setSelected] = useState<Selection | null>(null);
  /** What opening the chosen boundary would show ("districts"), or null when it cannot be opened. */
  const [openLevel, setOpenLevel] = useState<number | null>(null);
  const [ownPeriod, setOwnPeriod] = useState<string | null>(null);
  const periodId = heldPeriod !== undefined ? heldPeriod : ownPeriod;
  const setPeriodId = onPeriodChange ?? setOwnPeriod;
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [ground, setGround] = useState<MapGround>(() => groundOf(savedGround));
  useEffect(() => setGround(groundOf(savedGround)), [savedGround]);
  // Country only: the country's own provinces, cut out of a world-sized cover. Loaded only when that ground is chosen.
  const [mask, setMask] = useState<ReturnType<typeof countryMask>>(null);
  useEffect(() => {
    const country = path[0];
    if (ground !== "COUNTRY" || !country) { setMask(null); return; }
    let live = true;
    void services.boundaries.load({ name: country.name }, 1).then((units) => { if (live) setMask(units ? countryMask(units) : null); });
    return () => { live = false; };
  }, [ground, path[0]?.name, services]);
  const [note, setNote] = useState<BasemapNote | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [manifest, setManifest] = useState<BoundaryManifest | null>(null);
  const [compare, setCompare] = useState(false);
  const [panels, setPanels] = useState<Array<{ label: string; results: PlaceResults }>>([]);
  const [error, setError] = useState<string | null>(null);
  /** Set when the drawn level is the organisation's own upload: its credit replaces the shipped files'. */
  const [credit, setCredit] = useState<BoundaryOrigin | null>(null);
  const steps = useMemo(() => periodSteps(periods), [periods]);
  const view = useBoundaryView(path, services.viewBoundaries);

  useEffect(() => { void loadBoundaryManifest().then(setManifest); }, []);

  // A project working in one country opens on it; a bookmarked address (?map=0:name:uganda/1:UG01) opens where it was.
  useEffect(() => {
    const fromAddress = addressed ? decodePath(new URLSearchParams(window.location.search).get(ADDRESS_KEY)) : [];
    if (fromAddress.length > 0) { setPath(fromAddress.map((c) => ({ level: c.level, ref: c.ref, name: c.ref.replace(/^name:/, "").replace(/_/g, " ") }))); return; }
    const home = homeCountry(places, initial);
    if (home) setPath([{ level: 0, name: home, ref: nameRef(home) }]);
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
      setIndicatorId((current) => (out.value.indicators.some((i) => i.id === current) ? current : firstIndicator(out.value, initialIndicatorId)));
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

  // Context layers the organisation offers (Phase 49.6): never on a share link (staticData), off until the person switches one on.
  const mapContext = useMapContext(!staticData && services.signedIn, staticData || !services.signedIn ? undefined : serverMapContext);
  const [contextOn, setContextOn] = useState<ReadonlySet<ContextToggle>>(new Set());
  const toggleContext = (key: ContextToggle) => setContextOn((on) => { const next = new Set(on); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  const plan = useMemo(() => groundPlan(ground, dark ? "dark" : "light"), [ground, dark]);
  const anchored = useMemo(() => (callouts ? calloutAnchors(callouts.cards, places, joined) : null), [callouts, places, joined]);
  const scene = useMemo(() => {
    const built = buildResultsScene({
      model: model ?? EMPTY_MODEL, layers, joined, unit: indicator?.unit ?? null, selectedRef: selected?.ref ?? null,
      selectedPlaceId: selected?.placeId ?? null, overlay, basemap: plan.basemap, lang,
      label: t("maps.summary", { ...summaryCounts(model ?? EMPTY_MODEL) }), areaStyle,
    });
    const context = contextLayers(mapContext, contextOn, typeof location === "undefined" ? "" : location.origin);
    const cover: MaskLayerSpec[] = plan.mask && mask ? [{ kind: "MASK", geometry: mask, color: GROUND_COLOUR[dark ? "dark" : "light"] }] : [];
    return { ...built, detail: plan.detail, layers: [...cover, ...context, ...built.layers] };
  }, [model, layers, joined, indicator, selected, overlay, plan, mask, dark, lang, t, mapContext, contextOn, areaStyle]);

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
            <select className="input" value={ground} onChange={(e) => setGround(e.target.value as MapGround)}>
              {MAP_GROUNDS.map((g) => <option key={g} value={g}>{t(`maps.ground.${g}` as never)}</option>)}
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
          <MapLibreCanvas scene={scene} height={compact ? "h-[26rem]" : "h-[28rem]"} onSelect={choose} onNote={setNote} onFailed={onUnavailable} overlay={callouts ? (p) => <CalloutLayer projection={p} cards={anchored!.placed} unplaced={anchored!.unplaced} columns={callouts.columns} accent={callouts.accent} offsets={callouts.offsets} onMove={callouts.onMove} viewerMovable={callouts.viewerMovable} /> : undefined} />
          {model && <MapLegend bands={bands} areaStyle={areaStyle} areas={(scene.layers.find((l) => l.kind === "FILL") as { features?: Array<{ name: string; color: string }> } | undefined)?.features ?? []} />}
          {model && <p className="text-sm text-slate-600">{t("maps.summary", { ...summaryCounts(model) })}</p>}
          {note === NO_BASEMAP && <p className="text-xs text-slate-500">{t("maps.noBasemap")}</p>}
          {note === LOW_DETAIL_BASEMAP && <p className="text-xs text-slate-500">{t("maps.lowDetailBasemap")}</p>}
          {path.length === 1 && view.status === "ready" && finest !== undefined && finest < 4 && <p className="text-xs text-slate-500">{t("maps.finest", { country: path[0]!.name, level: levelPlural(finest) })}</p>}
          {byName > 0 && <p className="text-xs text-slate-500">{t("maps.byNameOnly", { count: byName })}</p>}
          {credit ? <p className="text-xs text-slate-500" data-testid="boundary-credit">{t("maps.credit.uploaded", { country: credit.countryName, name: credit.layerName })}</p> : country && fileEntry && <p className="text-xs text-slate-500">{attributionLine(country, view.shown as 2 | 3 | 4)}</p>}
          <p className="text-xs text-slate-500" data-no-print><Link className="underline" href="/maps/sources">{t("maps.sources.link")}</Link></p>
          {model && model.unmapped.length > 0 && <p className="text-xs text-slate-500">{t("maps.unmappedList", { names: model.unmapped.map((u) => u.name).join(", ") })}</p>}
          <div data-no-print>
            <button type="button" className="text-sm font-medium underline" aria-expanded={showTable} aria-controls="map-as-table" onClick={() => setShowTable((v) => !v)}>{showTable ? t("maps.table.hide") : t("maps.table.show")}</button>
            {showTable && <div id="map-as-table" className="mt-2"><MapDataTable rows={tableRows} unit={indicator?.unit ?? null} selectedPlaceId={selected?.placeId ?? null} onSelect={(row) => setSelected({ ref: row.ref, placeId: row.placeId, name: row.name })} /></div>}
            {!staticData && indicator && results && (
              <p className="mt-2 text-xs text-slate-500">
                {t("maps.download.label")}{" "}
                {(["geojson", "csv"] as const).map((format) => (
                  <a key={format} className="me-2 underline" download href={`/api/projects/${encodeURIComponent(projectId)}/place-results/export?${new URLSearchParams({ format, level: String(results.level), indicatorId: indicator.id, ...(periodId ? { periodId } : {}) })}`}>{t(`maps.download.${format}`)}</a>
                ))}
              </p>
            )}
          </div>
        </div>
        <div className="space-y-3" data-no-print>
          {!compact && <PlaceTree places={places} activityCounts={activityCounts ?? {}} figurePlaceIds={figureIds} selectedId={selected?.placeId ?? null} onSelect={focusPlace} />}
          {!compact && <LayerPanel layers={layers} onToggle={(id) => setLayers((l) => toggleLayer(l, id))} onOpacity={(id, v) => setLayers((l) => setLayerOpacity(l, id, v))} onMove={(id, d) => setLayers((l) => moveLayer(l, id, d))} />}
          {!compact && <ContextLayerToggles offered={offeredContext(mapContext)} on={contextOn} onToggle={toggleContext} />}
          {!compact && !staticData && <AnalysisPanel projectId={projectId} places={places} siteIds={figureIds} onRings={showOverlay} />}
          {!compact && <OverlayPanel onOverlay={showOverlay} />}
          {selected && <PlacePanel panel={panel} name={selected.name} canDrill={openLevel !== null} drillLabel={openLevel !== null ? t("maps.open", { level: levelPlural(openLevel) }) : undefined} onDrill={() => void openSelected()} onSelect={(id) => { const p = places.find((x) => x.id === id); if (p) setSelected({ ref: null, placeId: p.id, name: p.name }); }} onClose={() => setSelected(null)} />}
        </div>
      </div>
    </div>
  );
}
