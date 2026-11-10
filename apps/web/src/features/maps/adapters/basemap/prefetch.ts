import { pmtilesUrlFor } from "./protomaps-basemap.ts";
import { loadMapLibre, warmPmtiles } from "../maplibre/lib.ts";
import type { Bounds } from "../../domain/model/scene.ts";
import type { BasemapRegion } from "../../domain/basemap/regions.ts";
import type { MapPrefetch } from "../../ports/map-prefetch.ts";

/** The MapLibre-and-PMTiles side of `MapPrefetch`: the library chunk and the basemap header are fetched side by side. */
export class PmtilesPrefetch implements MapPrefetch {
  private readonly base: string;
  private readonly origin: () => string;
  private readonly regions: readonly BasemapRegion[] | undefined;
  private readonly extra: () => void;

  constructor(base: string, origin: () => string, regions?: readonly BasemapRegion[], extra: () => void = () => undefined) {
    this.base = base;
    this.origin = origin;
    this.regions = regions;
    this.extra = extra;
  }

  warm(view: Bounds | null): void {
    try {
      void loadMapLibre().catch(() => undefined);
      const url = pmtilesUrlFor(view, this.base, this.origin(), this.regions);
      if (url) warmPmtiles(url);
      this.extra();
    } catch { /* a prefetch never breaks a screen */ }
  }
}
