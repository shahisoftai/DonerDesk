/**
 * Where a place is on the drawn map, in pixels (Phase 50.3d). A separate, small port (interface segregation): only a screen that lays
 * something over the map (figure cards beside areas) asks for it; the renderer port stays as it was.
 */
export interface MapProjection {
  /** The pixel position of a point inside the map's frame, or null when the map is not ready. */
  project(lng: number, lat: number): { x: number; y: number } | null;
  size(): { w: number; h: number };
  /** Called after every move or zoom; returns the way to stop listening. */
  onView(handler: () => void): () => void;
}
