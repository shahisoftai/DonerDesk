/** Cuts a small basemap file for one area from the files on the host (Phase 49.4). Infrastructure decides how (the pmtiles tool). */
export interface OfflineBasemapFile { path: string; bytes: number; maxzoom: number }
export interface IOfflineBasemapBuilder {
  /** Null when the host cannot cut one (no basemap file covers the area, or the tool is missing). Repeated calls for one box reuse the file. */
  build(bbox: readonly [number, number, number, number], maxzoom: number): Promise<OfflineBasemapFile | null>;
}

/** Population grids on the host (Phase 49.7): the grid that covers a box, or null when none does. */
export interface IPopulationGrids {
  covering(box: readonly [number, number, number, number]): Promise<import("@donordesk/domain").PopulationGrid | null>;
}
