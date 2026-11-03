import type { BasemapMode, Bounds } from "../domain/model/scene.ts";
import type { Pin } from "../domain/marking/pin.ts";

export interface PinPlacerOptions {
  basemap: BasemapMode;
  /** Where to look first (the project's country); null opens on the world. */
  focus: Bounds | null;
  /** Boundary outlines to help find the spot (a GeoJSON FeatureCollection), or null. Context only. */
  outline: unknown | null;
  /** The language of the map's own place names. */
  lang?: string | undefined;
}

export type HowPlaced = "CLICK" | "DRAG";

/**
 * Putting one pin on a map. Separate from `MapRenderer` on purpose: a read-only map never sees editing, and a pin picker
 * never sees layers or scenes. The pin it reports is already in range; rounding and wrapping are the domain's (`makePin`).
 */
export interface PinPlacer {
  /** Moves the marker (null removes it). Does not call the handler: only a person's own gesture does. */
  setPin(pin: Pin | null): void;
  onPlace(handler: (pin: Pin, how: HowPlaced) => void): void;
  dispose(): void;
}

export type PinPlacerFactory = (container: HTMLElement, options: PinPlacerOptions) => Promise<PinPlacer>;
