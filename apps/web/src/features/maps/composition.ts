/**
 * The one place that knows which concrete adapters back the map ports. Presentation receives `MapServices` and never imports an adapter.
 */
import { provincesOf } from "../workplan/domain/site-map";
import { loadAdmin1File, loadBoundaryFile, loadBoundaryIndex, loadBoundaryManifest } from "@/lib/client/boundary-loader";
import { admin1FileKey } from "./domain/boundaries/join";
import type { NamedGeoCollection } from "../workplan/domain/geo/geo-types";
import { loadBoundaryLayerFile, loadBoundaryLayerList } from "@/lib/client/tenant-boundary-layers";
import { findCountry } from "./domain/boundary-sources";
import { ProtomapsBasemap } from "./adapters/basemap/protomaps-basemap";
import { PmtilesPrefetch } from "./adapters/basemap/prefetch";
import { currentOfflineMap } from "../offline/infrastructure/offline-maps";
import { BASEMAP_REGIONS, WORLD_BASEMAP } from "./domain/basemap/regions";
import type { MapPrefetch } from "./ports/map-prefetch";
import { FilesBoundarySource } from "./adapters/boundaries/files-boundary-source";
import { TenantLayerBoundarySource } from "./adapters/boundaries/tenant-layer-boundary-source";
import { TiledBoundarySource } from "./adapters/boundaries/tiled-boundary-source";
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
  /** The same boundaries for a results map: levels 2 to 4 from vector tiles where they exist (Phase 49.3). Outlines are boxes; never test a point against them. */
  viewBoundaries: BoundarySource;
  /** Starts the map library, the basemap header and the boundary catalogue before the map exists (Phase 49.1). */
  prefetch: MapPrefetch;
  /** False on a machine with no WebGL: the screen then keeps the ECharts map. */
  canUseWebGL(): boolean;
  /** False for a public page (a share link or an embed): nothing there may call a server action that needs a session. */
  signedIn: boolean;
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

/**
 * `signedIn: false` builds the services for a public page (a share link, an embed): no call that needs a session is ever made. A server action
 * that needs one answers a visitor with a redirect to the login page, which cannot be caught and throws the whole page away, so the
 * organisation's own uploaded boundaries (read through such an action) are simply not offered there; the shipped boundaries are.
 */
export function createMapServices(options: { signedIn?: boolean } = {}): MapServices {
  const basemap = new ProtomapsBasemap("/tiles", undefined, BASEMAP_REGIONS, WORLD_BASEMAP, currentOfflineMap);
  const origin = () => (typeof location === "undefined" ? "" : location.origin);
  // The organisation's own boundary files first; the shipped ones for everything else.
  const shipped = new FilesBoundarySource(loadWorld, (name) => loadAdmin1File(admin1FileKey(name)), loadBundledAdmin1, loadBoundaryManifest, loadBoundaryFile, provincesOf);
  const boundaries: BoundarySource = options.signedIn === false ? shipped : new TenantLayerBoundarySource(
    shipped,
    loadBoundaryLayerList,
    loadBoundaryLayerFile,
    async (country) => { const manifest = await loadBoundaryManifest(); return (manifest ? findCountry(manifest, country.name)?.iso : undefined) ?? null; },
  );
  return {
    createRenderer: (container) => MapLibreRenderer.create(container, basemap),
    createPinPlacer: (container, options) => MapLibrePinPlacer.create(container, options, basemap),
    createDrawingTool: (container, options) => MapLibreAreaTool.create(container, options, basemap),
    boundaries,
    viewBoundaries: new TiledBoundarySource(boundaries, loadBoundaryManifest, loadBoundaryIndex, origin),
    prefetch: new PmtilesPrefetch("/tiles", origin, undefined, () => { void loadBoundaryManifest(); }),
    canUseWebGL: webGl,
    signedIn: options.signedIn !== false,
  };
}
