import type { Bounds } from "../domain/model/scene.ts";

/**
 * Starts the slow parts of a first map before the map exists (Phase 49.1): the map library, the basemap file's header for the view, and the
 * boundary catalogue. Calling it is always safe: it never throws, never blocks, and repeats nothing already started.
 */
export interface MapPrefetch {
  warm(view: Bounds | null): void;
}
