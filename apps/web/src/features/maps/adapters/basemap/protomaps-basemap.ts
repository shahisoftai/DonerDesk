import { layers as protomapsLayers, namedFlavor } from "@protomaps/basemaps";
import { basemapRegionFor, NO_BASEMAP, type BasemapRegion } from "../../domain/basemap/regions.ts";
import type { BasemapMode, Bounds } from "../../domain/model/scene.ts";
import type { BasemapSource, BasemapStyle } from "../../ports/basemap-source.ts";

/** The languages the basemap can name places in (it is built for these four). */
const LABEL_LANGUAGES: readonly string[] = ["en", "fr", "es", "ar"];
const PLAIN_GROUND: Readonly<Record<"light" | "dark", string>> = { light: "#eef2f6", dark: "#111827" };
const ATTRIBUTION = '<a href="https://protomaps.com" target="_blank" rel="noreferrer">Protomaps</a> © <a href="https://openstreetmap.org" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

/**
 * Street and terrain ground from our own host: a PMTiles file per region under `<base>/` and the label fonts under `<base>/fonts/`.
 * Nothing leaves our domain. Outside the extracted regions (or in "plain" mode) the ground is a flat colour.
 */
export class ProtomapsBasemap implements BasemapSource {
  private readonly base: string;
  private readonly origin: () => string;
  private readonly regions: readonly BasemapRegion[];

  constructor(base = "/tiles", origin: () => string = () => (typeof location === "undefined" ? "" : location.origin), regions: readonly BasemapRegion[] = []) {
    this.base = base;
    this.origin = origin;
    this.regions = regions;
  }

  styleFor(mode: BasemapMode, view: Bounds | null, language?: string): BasemapStyle {
    const lang = LABEL_LANGUAGES.includes(language ?? "") ? (language as string) : "en";
    const tone = mode === "dark" ? "dark" : "light";
    const region = mode === "plain" ? null : (this.regions.length > 0 ? basemapRegionFor(view, this.regions) : basemapRegionFor(view));
    const glyphs = `${this.origin()}${this.base}/fonts/{fontstack}/{range}.pbf`;
    if (!region) {
      return {
        key: `plain:${tone}`,
        regionId: null,
        note: mode === "plain" ? null : NO_BASEMAP,
        style: { version: 8, glyphs, sources: {}, layers: [{ id: "dd-ground", type: "background", paint: { "background-color": PLAIN_GROUND[tone] } }] },
      };
    }
    // Icons need a sprite we do not host; place names, roads, water and land stay.
    const drawn = protomapsLayers("protomaps", namedFlavor(tone), { lang }).filter((l) => !("layout" in l && l.layout && "icon-image" in l.layout));
    return {
      key: `${region.id}:${tone}:${lang}`,
      regionId: region.id,
      note: null,
      style: {
        version: 8,
        glyphs,
        sources: { protomaps: { type: "vector", url: `pmtiles://${this.origin()}${this.base}/${region.file}`, attribution: ATTRIBUTION, maxzoom: 12 } },
        layers: drawn,
      },
    };
  }
}
