import type * as ML from "maplibre-gl";
import type { Bounds, FeatureRef, MapScene, Tip } from "../../domain/model/scene.ts";
import { pinTipKey } from "../../domain/model/scene.ts";
import type { BasemapNote } from "../../domain/basemap/regions.ts";
import type { BasemapSource } from "../../ports/basemap-source.ts";
import type { DrawResult, MapRenderer } from "../../ports/map-renderer.ts";
import { loadMapLibre } from "./lib.ts";
import { IDS, PICKABLE, SOURCES, buildMapLibreLayers, type Built } from "./layers.ts";

type Handler = (ref: FeatureRef | null) => void;

const reducedMotion = (): boolean => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function tipNode(tip: Tip): HTMLElement {
  const box = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = tip.title; // plain text: an officer-typed name is never markup
  box.append(title);
  for (const line of tip.lines) { const p = document.createElement("div"); p.textContent = line; box.append(p); }
  return box;
}

/**
 * The MapLibre implementation of `MapRenderer`. It decides nothing about colour, size or meaning: it draws the scene it is given,
 * keeps the ground (basemap) the `BasemapSource` asks for, and reports a click as a boundary ref or a pin's place id.
 */
export class MapLibreRenderer implements MapRenderer {
  private scene: MapScene | null = null;
  private built: Built | null = null;
  private groundKey = "";
  private ready = false;
  private fitKey = "";
  private handler: Handler = () => {};
  private note: BasemapNote | null = null;

  private readonly map: ML.Map;
  private readonly basemap: BasemapSource;
  private readonly popup: ML.Popup;

  private constructor(map: ML.Map, basemap: BasemapSource, popup: ML.Popup) {
    this.map = map;
    this.basemap = basemap;
    this.popup = popup;
  }

  static async create(container: HTMLElement, basemap: BasemapSource): Promise<MapLibreRenderer> {
    const lib = await loadMapLibre();
    const first = basemap.styleFor("plain", null);
    const map = new lib.Map({ container, style: first.style as ML.StyleSpecification, attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false, touchPitch: false, maxZoom: 18, minZoom: 0.5, center: [20, 5], zoom: 2 });
    map.addControl(new lib.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new lib.ScaleControl({ unit: "metric" }), "bottom-left");
    const popup = new lib.Popup({ closeButton: false, closeOnClick: false, offset: 10, className: "dd-map-tip" });
    const renderer = new MapLibreRenderer(map, basemap, popup);
    renderer.groundKey = first.key;
    map.on("style.load", () => { renderer.ready = true; renderer.paint(true); });
    map.on("click", (e) => renderer.click(e));
    map.on("mousemove", (e) => renderer.hover(e));
    map.on("mouseout", () => popup.remove());
    return renderer;
  }

  draw(scene: MapScene): DrawResult {
    this.scene = scene;
    // The canvas is the one thing a keyboard stops on, so it carries the name a screen reader gives the whole map.
    this.map.getCanvas().setAttribute("aria-label", scene.label);
    // Says when the map has finished drawing what it was given (tiles and all): the sign a browser test, or a speed measurement, waits for.
    const frame = this.map.getContainer();
    frame.setAttribute("data-map-ready", "false");
    this.map.once("idle", () => frame.setAttribute("data-map-ready", "true"));
    const ground = this.basemap.styleFor(scene.basemap, scene.bounds, scene.lang);
    this.note = ground.note;
    if (ground.key !== this.groundKey) {
      this.groundKey = ground.key;
      this.ready = false;
      this.built = null; // setStyle drops our layers; they are put back on style.load
      this.map.setStyle(ground.style as ML.StyleSpecification, { diff: false });
    } else if (this.ready || this.map.isStyleLoaded()) {
      this.ready = true;
      this.paint(false);
    }
    return { note: this.note };
  }

  fit(bounds: Bounds): void {
    this.map.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], { padding: 28, maxZoom: 11, duration: reducedMotion() ? 0 : 400 });
  }

  onSelect(handler: Handler): void { this.handler = handler; }

  dispose(): void {
    this.popup.remove();
    this.map.remove();
  }

  // ---- drawing ---------------------------------------------------------------------------------------

  private paint(afterStyleLoad: boolean): void {
    const scene = this.scene;
    if (!scene) return;
    const next = buildMapLibreLayers(scene, !this.groundKey.startsWith("plain"));
    if (afterStyleLoad || !this.built || this.built.dataKey !== next.dataKey) this.rebuild(next);
    else this.restyle(next);
    this.built = next;
    const key = JSON.stringify(scene.bounds);
    if (scene.bounds && key !== this.fitKey) { this.fitKey = key; this.fit(scene.bounds); }
  }

  /** New data: put every one of our sources and layers back. */
  private rebuild(next: Built): void {
    for (const layer of this.map.getStyle().layers ?? []) if (layer.id.startsWith("dd-") && layer.id !== "dd-ground") this.map.removeLayer(layer.id);
    for (const id of Object.values(SOURCES)) if (this.map.getSource(id)) this.map.removeSource(id);
    for (const s of next.sources) this.map.addSource(s.id, { type: "geojson", data: s.data as never, ...(s.cluster ? { cluster: true, clusterRadius: 44, clusterMaxZoom: 12 } : {}), ...(s.id === SOURCES.fill ? { tolerance: 0.5 } : {}) });
    for (const l of next.layers) this.map.addLayer(l as unknown as ML.LayerSpecification);
  }

  /** Same data: only the selection and the opacities changed. */
  private restyle(next: Built): void {
    for (const l of next.layers) {
      if (!this.map.getLayer(l.id)) continue;
      if (l.filter) this.map.setFilter(l.id, l.filter as ML.FilterSpecification);
      for (const [name, value] of Object.entries(l.paint)) this.map.setPaintProperty(l.id, name, value as never);
    }
  }

  // ---- events ----------------------------------------------------------------------------------------

  private ours(): string[] { return PICKABLE.concat(IDS.clusters).filter((id) => !!this.map.getLayer(id)); }

  private click(e: ML.MapMouseEvent): void {
    const hits = this.map.queryRenderedFeatures(e.point, { layers: this.ours() });
    const top = hits[0];
    if (!top) { this.handler(null); return; }
    if (top.layer.id === IDS.clusters) { void this.zoomCluster(top); return; }
    if (top.layer.id === IDS.pins) this.handler({ kind: "PIN", id: String(top.properties?.id) });
    else this.handler({ kind: "REGION", id: String(top.properties?.ref) });
  }

  private async zoomCluster(feature: ML.MapGeoJSONFeature): Promise<void> {
    const source = this.map.getSource(SOURCES.pins) as ML.GeoJSONSource | undefined;
    if (!source || feature.geometry.type !== "Point") return;
    const zoom = await source.getClusterExpansionZoom(Number(feature.properties?.cluster_id));
    this.map.easeTo({ center: feature.geometry.coordinates as [number, number], zoom, duration: reducedMotion() ? 0 : 300 });
  }

  private hover(e: ML.MapMouseEvent): void {
    const hit = this.map.queryRenderedFeatures(e.point, { layers: this.ours().filter((id) => id !== IDS.clusters) })[0];
    this.map.getCanvas().style.cursor = hit ? "pointer" : "";
    const key = hit ? (hit.layer.id === IDS.pins ? pinTipKey(String(hit.properties?.id)) : String(hit.properties?.ref)) : null;
    const tip = key ? this.scene?.tips[key] : undefined;
    if (!tip) { this.popup.remove(); return; }
    this.popup.setLngLat(e.lngLat).setDOMContent(tipNode(tip)).addTo(this.map);
  }
}
