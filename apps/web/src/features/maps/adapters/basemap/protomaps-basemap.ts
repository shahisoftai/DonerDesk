import { layers as protomapsLayers, namedFlavor } from "@protomaps/basemaps";
import { basemapFileFor, BASEMAP_REGIONS, LOW_DETAIL_BASEMAP, NO_BASEMAP, WORLD_BASEMAP, type BasemapRegion } from "../../domain/basemap/regions.ts";
import type { BasemapDetail, BasemapMode, Bounds } from "../../domain/model/scene.ts";
import { GROUND_COLOUR, SIMPLE_TILE_LAYERS } from "../../domain/ground.ts";
import type { BasemapSource, BasemapStyle } from "../../ports/basemap-source.ts";

/** The languages the basemap can name places in (it is built for these four). */
const LABEL_LANGUAGES: readonly string[] = ["en", "fr", "es", "ar"];
const PLAIN_GROUND = GROUND_COLOUR;
const ATTRIBUTION = '<a href="https://protomaps.com" target="_blank" rel="noreferrer">Protomaps</a> © <a href="https://openstreetmap.org" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';
/** A view smaller than this (square degrees) is "a country or less": on the world file it is worth saying that streets are not shown. */
const COUNTRY_SIZED = 400;

/** A region file's address, stamped with its build so nginx may cache it for a year (a rebuilt file is a new address). */
const fileUrl = (origin: string, base: string, region: BasemapRegion): string => `${origin}${base}/${region.file}?v=${region.built}`;

const sized = (b: Bounds | null): number => (b ? (b[2] - b[0]) * (b[3] - b[1]) : Infinity);

/** The PMTiles address for a view (the file `ProtomapsBasemap` would draw), or null for none. Shared with the prefetch so both name the same file. */
export function pmtilesUrlFor(view: Bounds | null, base: string, origin: string, regions?: readonly BasemapRegion[], world: BasemapRegion | null = WORLD_BASEMAP): string | null {
  const region = basemapFileFor(view, regions && regions.length > 0 ? regions : BASEMAP_REGIONS, world);
  return region ? fileUrl(origin, base, region) : null;
}

/**
 * Street and terrain ground from our own host: a PMTiles file per region under `<base>/` and the label fonts under `<base>/fonts/`.
 * Nothing leaves our domain. A view no detailed region holds is drawn on the low-zoom world file (Phase 49.2); "plain" mode, or a source
 * built with no world file, is a flat colour.
 */
export class ProtomapsBasemap implements BasemapSource {
  private readonly base: string;
  private readonly origin: () => string;
  private readonly regions: readonly BasemapRegion[];
  private readonly world: BasemapRegion | null;
  private readonly offline: () => { url: string; bbox: Bounds } | null;

  /** `offline`: the street map kept on this device (Phase 49.4), drawn instead of the host's files when there is no network. */
  constructor(base = "/tiles", origin: () => string = () => (typeof location === "undefined" ? "" : location.origin), regions: readonly BasemapRegion[] = [], world: BasemapRegion | null = WORLD_BASEMAP, offline: () => { url: string; bbox: Bounds } | null = () => null) {
    this.base = base;
    this.origin = origin;
    this.regions = regions;
    this.world = world;
    this.offline = offline;
  }

  private keptFor(view: Bounds | null): string | null {
    if (typeof navigator === "undefined" || navigator.onLine !== false) return null;
    const kept = this.offline();
    if (!kept) return null;
    const b = kept.bbox;
    const inside = !view || (view[0] >= b[0] - 1 && view[1] >= b[1] - 1 && view[2] <= b[2] + 1 && view[3] <= b[3] + 1);
    return inside ? `${this.origin()}${kept.url}` : null;
  }

  styleFor(mode: BasemapMode, view: Bounds | null, language?: string, detail: BasemapDetail = "STREETS"): BasemapStyle {
    const lang = LABEL_LANGUAGES.includes(language ?? "") ? (language as string) : "en";
    const tone = mode === "dark" ? "dark" : "light";
    const kept = mode === "plain" ? null : this.keptFor(view);
    const region = mode === "plain" ? null : kept ? { ...(this.world ?? WORLD_BASEMAP), id: "offline", maxzoom: 14 } : basemapFileFor(view, this.regions.length > 0 ? this.regions : BASEMAP_REGIONS, this.world);
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
    // Icons need a sprite we do not host; place names, roads, water and land stay. SIMPLE keeps only land, water, borders and place names.
    const drawn = protomapsLayers("protomaps", namedFlavor(tone), { lang })
      .filter((l) => !("layout" in l && l.layout && "icon-image" in l.layout))
      .filter((l) => detail === "STREETS" || !("source-layer" in l) || SIMPLE_TILE_LAYERS.includes(l["source-layer"] as string));
    const lowDetail = region.id === this.world?.id && sized(view) < COUNTRY_SIZED;
    return {
      key: `${region.id}:${tone}:${lang}${detail === "SIMPLE" ? ":simple" : ""}`,
      regionId: region.id,
      note: lowDetail ? LOW_DETAIL_BASEMAP : null,
      style: {
        version: 8,
        glyphs,
        sources: { protomaps: { type: "vector", url: `pmtiles://${kept ?? fileUrl(this.origin(), this.base, region)}`, attribution: ATTRIBUTION, maxzoom: region.maxzoom } },
        layers: drawn,
      },
    };
  }
}
