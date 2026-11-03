/**
 * The one place that knows which concrete adapters back the map ports. Presentation receives `MapServices` and never imports an adapter.
 */
import { provincesOf } from "../workplan/domain/site-map";
import { loadAdmin1File, loadBoundaryFile, loadBoundaryManifest } from "@/lib/client/boundary-loader";
import { admin1FileKey } from "./domain/boundaries/join";
import type { NamedGeoCollection } from "../workplan/domain/geo/geo-types";
import { loadBoundaryLayerFile, loadBoundaryLayerList } from "@/lib/client/tenant-boundary-layers";
import { findCountry } from "./domain/boundary-sources";
import { ProtomapsBasemap } from "./adapters/basemap/protomaps-basemap";
import { FilesBoundarySource } from "./adapters/boundaries/files-boundary-source";
import { TenantLayerBoundarySource } from "./adapters/boundaries/tenant-layer-boundary-source";
import { MapLibreAreaTool } from "./adapters/maplibre/area-tool";
import { MapLibrePinPlacer } from "./adapters/maplibre/pin-placer";
import { MapLibreRenderer } from "./adapters/maplibre/renderer";
import type { BoundarySource } from "./ports/boundary-source";
import type { RendererFactory } from "./ports/map-renderer";
import type { DrawingToolFactory } from "./ports/drawing-tool";
import type { PinPlacerFactory } from "./ports/pin-placer";

export interface MapServices {
  createRenderer: RendererFactory;
  createPinPlacer: PinPlacerFactory;
  createDrawingTool: DrawingToolFactory;
  boundaries: BoundarySource;
  /** False on a machine with no WebGL: the screen then keeps the ECharts map. */
  canUseWebGL(): boolean;
}

// The world's countries are a small module; every country's provinces together are a big one, loaded only as the fallback (see FilesBoundarySource).
let world: Promise<NamedGeoCollection> | undefined;
let bundledAdmin1: Promise<NamedGeoCollection> | undefined;
const loadWorld = () => (world ??= import("../workplan/domain/geo/world-geo").then((m) => m.WORLD_GEO));
const loadBundledAdmin1 = () => (bundledAdmin1 ??= import("../workplan/domain/geo/admin1-geo").then((m) => m.ADMIN1_GEO));

function webGl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch { return false; }
}

export function createMapServices(): MapServices {
  const basemap = new ProtomapsBasemap("/tiles");
  return {
    createRenderer: (container) => MapLibreRenderer.create(container, basemap),
    createPinPlacer: (container, options) => MapLibrePinPlacer.create(container, options, basemap),
    createDrawingTool: (container, options) => MapLibreAreaTool.create(container, options, basemap),
    // The organisation's own boundary files first; the shipped ones for everything else.
    boundaries: new TenantLayerBoundarySource(
      new FilesBoundarySource(loadWorld, (name) => loadAdmin1File(admin1FileKey(name)), loadBundledAdmin1, loadBoundaryManifest, loadBoundaryFile, provincesOf),
      loadBoundaryLayerList,
      loadBoundaryLayerFile,
      async (country) => { const manifest = await loadBoundaryManifest(); return (manifest ? findCountry(manifest, country.name)?.iso : undefined) ?? null; },
    ),
    canUseWebGL: webGl,
  };
}
