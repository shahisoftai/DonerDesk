/**
 * What a map draws, as plain data. A builder (`scene/build-scene.ts`) produces it; a renderer (`ports/map-renderer.ts`)
 * turns it into pixels and events. Nothing here knows about MapLibre, ECharts or React.
 */
export type Bounds = readonly [west: number, south: number, east: number, north: number];
export type BasemapMode = "light" | "dark" | "plain";

/** What a click or hover landed on: a boundary (by its stable ref) or a pin (by place id). */
export interface FeatureRef { kind: "REGION" | "PIN"; id: string }

export interface RegionFeature {
  /** Stable key of the boundary unit: its P-code, else a name key. */
  ref: string;
  name: string;
  color: string;
  geometry: unknown;
}

export interface PinFeature { id: string; name: string; lng: number; lat: number; color: string; radius: number }

export interface FillLayerSpec { kind: "FILL"; features: readonly RegionFeature[]; opacity: number; outline: boolean; selectedRef: string | null }
export interface PinsLayerSpec { kind: "PINS"; pins: readonly PinFeature[]; opacity: number; selectedId: string | null; cluster: boolean }
export interface OverlayLayerSpec {
  kind: "OVERLAY";
  points: ReadonlyArray<{ name: string; lng: number; lat: number }>;
  lines: ReadonlyArray<{ name: string; coords: ReadonlyArray<readonly [number, number]> }>;
  opacity: number;
}
export type LayerSpec = FillLayerSpec | PinsLayerSpec | OverlayLayerSpec;

/** Text shown when pointing at a feature. Plain text: the renderer never treats it as markup. */
export interface Tip { title: string; lines: readonly string[] }

export interface MapScene {
  /** The sentence a screen reader gets for the whole map. */
  label: string;
  basemap: BasemapMode;
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
