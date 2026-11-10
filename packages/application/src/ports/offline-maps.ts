/** Cuts a small basemap file for one area from the files on the host (Phase 49.4). Infrastructure decides how (the pmtiles tool). */
export interface OfflineBasemapFile { path: string; bytes: number; maxzoom: number }
export interface IOfflineBasemapBuilder {
  /** Null when the host cannot cut one (no basemap file covers the area, or the tool is missing). Repeated calls for one box reuse the file. */
  build(bbox: readonly [number, number, number, number], maxzoom: number): Promise<OfflineBasemapFile | null>;
}
