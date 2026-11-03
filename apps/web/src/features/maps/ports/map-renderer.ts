import type { BasemapNote } from "../domain/basemap/regions.ts";
import type { Bounds, FeatureRef, MapScene } from "../domain/model/scene.ts";

export interface DrawResult {
  /** Why something expected is missing (no street basemap here), as a code the screen says in its own words, else null. */
  note: BasemapNote | null;
}

/**
 * The only thing a map screen calls. Implementations (MapLibre, ECharts) turn a scene into pixels and report what was chosen.
 * Deliberately small: editing is a separate port (`DrawingTool`), so a read-only map never sees it.
 */
export interface MapRenderer {
  draw(scene: MapScene): DrawResult;
  fit(bounds: Bounds): void;
  /** One handler at a time; null means the empty ground (or a cleared selection) was chosen. */
  onSelect(handler: (ref: FeatureRef | null) => void): void;
  dispose(): void;
}

export type RendererFactory = (container: HTMLElement) => Promise<MapRenderer>;
