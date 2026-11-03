import type * as ML from "maplibre-gl";
import type { BasemapMode, Bounds } from "../../domain/model/scene.ts";
import type { BasemapSource } from "../../ports/basemap-source.ts";
import { loadMapLibre } from "./lib.ts";

export interface BaseMapOptions {
  basemap: BasemapMode;
  /** Where to look first; null opens on the world. */
  focus: Bounds | null;
  /** Boundary outlines to help find the spot (a GeoJSON FeatureCollection), or null. Context only. */
  outline: unknown | null;
  /** A neighbouring shape drawn as a guide (for example the parent area's own outline), or null. */
  guide?: unknown | null;
  /** The language of the map's own place names. */
  lang?: string | undefined;
}

const OUTLINE = { source: "dd-outline-src", layer: "dd-outline" } as const;
const GUIDE = { source: "dd-guide-src", layer: "dd-guide" } as const;

/**
 * One map, opened the same way for every tool that edits something on it (the pin placer, the shape tool): the self-hosted ground,
 * zoom and scale controls, the view on the project's country, and the outlines it was given as context.
 */
export async function openMap(container: HTMLElement, options: BaseMapOptions, basemap: BasemapSource): Promise<{ lib: typeof import("maplibre-gl"); map: ML.Map }> {
  const lib = await loadMapLibre();
  const ground = basemap.styleFor(options.basemap, options.focus, options.lang);
  const map = new lib.Map({
    container, style: ground.style as ML.StyleSpecification, attributionControl: { compact: true }, dragRotate: false, touchPitch: false, maxZoom: 18, center: [20, 5], zoom: 2,
    ...(options.focus ? { bounds: [[options.focus[0], options.focus[1]], [options.focus[2], options.focus[3]]] as ML.LngLatBoundsLike, fitBoundsOptions: { padding: 24, maxZoom: 9 } } : {}),
  });
  map.addControl(new lib.NavigationControl({ showCompass: false }), "top-right");
  map.addControl(new lib.ScaleControl({ unit: "metric" }), "bottom-left");
  map.on("style.load", () => {
    if (options.outline && !map.getSource(OUTLINE.source)) {
      map.addSource(OUTLINE.source, { type: "geojson", data: options.outline as never });
      map.addLayer({ id: OUTLINE.layer, type: "line", source: OUTLINE.source, paint: { "line-color": "#475569", "line-width": 1, "line-opacity": 0.7 } });
    }
    if (options.guide && !map.getSource(GUIDE.source)) {
      map.addSource(GUIDE.source, { type: "geojson", data: { type: "Feature", properties: {}, geometry: options.guide } as never });
      map.addLayer({ id: GUIDE.layer, type: "line", source: GUIDE.source, paint: { "line-color": "#7c3aed", "line-width": 2, "line-dasharray": [2, 2] } });
    }
  });
  return { lib, map };
}
