/**
 * What a map draws, as plain data. A builder (`scene/build-scene.ts`) produces it; a renderer (`ports/map-renderer.ts`)
 * turns it into pixels and events. Nothing here knows about MapLibre, ECharts or React.
 */
export type Bounds = readonly [west: number, south: number, east: number, north: number];
export type BasemapMode = "light" | "dark" | "plain";
export type BasemapDetail = "STREETS" | "SIMPLE";

/** What a click or hover landed on: a boundary (by its stable ref) or a pin (by place id). */
export interface FeatureRef { kind: "REGION" | "PIN"; id: string }

export interface RegionFeature {
  /** Stable key of the boundary unit: its P-code, else a name key. */
  ref: string;
  name: string;
  /** What is written on the area when labels are on (name, figure, or both). */
  label?: string | undefined;
  color: string;
  geometry: unknown;
  /** Drawn from this tile file instead of `geometry` (which is then only the box). All features of one layer share one file. */
  tile?: { url: string; sourceLayer: string } | undefined;
}

export interface PinFeature {
  id: string; name: string; lng: number; lat: number; color: string; radius: number;
  /** How bad this pin's state is (higher = worse). A cluster is coloured by the worst rank inside it, from `rankColors` on its layer. */
  rank?: number;
}

export interface FillLayerSpec { kind: "FILL"; features: readonly RegionFeature[]; opacity: number; outline: boolean; selectedRef: string | null; /** Text drawn on each area (Phase 50.3d), from the feature's `label`; absent = none. */ labels?: boolean | undefined }
export interface PinsLayerSpec { kind: "PINS"; pins: readonly PinFeature[]; opacity: number; selectedId: string | null; cluster: boolean; /** Colour per rank, worst last; when set, a cluster shows its worst pin's colour, not a count shade. */ rankColors?: readonly string[] }
export interface OverlayLayerSpec {
  kind: "OVERLAY";
  points: ReadonlyArray<{ name: string; lng: number; lat: number }>;
  lines: ReadonlyArray<{ name: string; coords: ReadonlyArray<readonly [number, number]> }>;
  opacity: number;
}
/**
 * A context layer under the results (Phase 49.6): population cells, facility or settlement points, or the organisation's own imagery.
 * Context only: it carries no figure of the project and is never pickable.
 */
export interface ContextLayerSpec {
  kind: "CONTEXT";
  id: string;
  type: "raster" | "points" | "imagery";
  /** A PMTiles address (raster, points) or a tile template (imagery). */
  url: string;
  sourceLayer?: string;
  opacity: number;
  attribution: string;
}
/** Hides everything outside one country (Phase 51): the world with the country cut out, drawn over the street map and under the data. */
export interface MaskLayerSpec { kind: "MASK"; geometry: { type: "Polygon"; coordinates: unknown }; /** The colour of the ground it covers with. */ color: string }
export type LayerSpec = ContextLayerSpec | FillLayerSpec | PinsLayerSpec | OverlayLayerSpec | MaskLayerSpec;

/** Text shown when pointing at a feature. Plain text: the renderer never treats it as markup. */
export interface Tip { title: string; lines: readonly string[] }

export interface MapScene {
  /** The sentence a screen reader gets for the whole map. */
  label: string;
  basemap: BasemapMode;
  /** How much of the street map to draw: all of it, or land, water, borders and place names only (Phase 51). Absent = all. */
  detail?: BasemapDetail;
  /** The language of the basemap's own labels ("en", "fr", "es", "ar"); absent = English. */
  lang?: string;
  /** Where to look; null leaves the view alone. */
  bounds: Bounds | null;
  /** Bottom to top. */
  layers: readonly LayerSpec[];
  /** Keyed by region ref, or `pin:<placeId>`. */
  tips: Readonly<Record<string, Tip>>;
}

export const pinTipKey = (placeId: string): string => `pin:${placeId}`;
