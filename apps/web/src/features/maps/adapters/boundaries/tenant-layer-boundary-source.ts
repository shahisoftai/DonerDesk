import { normalizeLocationKey } from "@donordesk/domain/contexts/workplan/index.js";
import type { BoundaryUnit } from "../../domain/boundaries/join.ts";
import type { BoundaryOrigin, BoundarySource, CountryKey } from "../../ports/boundary-source.ts";
import type { NamedGeoCollection } from "../../../workplan/domain/geo/geo-types.ts";
import { toUnits } from "./to-units.ts";

/** What the map needs to know about an uploaded layer (the rest is the file itself). */
export interface UploadedLayer { iso: string; countryName: string; adminLevel: number; name: string }

type LayerList = () => Promise<readonly UploadedLayer[]>;
type LayerFile = (iso: string, adminLevel: number) => Promise<NamedGeoCollection | null>;
type IsoOf = (country: CountryKey) => Promise<string | null>;

/**
 * The organisation's own boundary files first, the shipped ones as the fallback. A layer for a country and level REPLACES the shipped file
 * for that level, for this organisation only; every other level, and every country without a layer, goes to the base source untouched.
 * (A decorator: it adds a source without changing the one it wraps.)
 */
export class TenantLayerBoundarySource implements BoundarySource {
  private readonly base: BoundarySource;
  private readonly layers: LayerList;
  private readonly file: LayerFile;
  private readonly isoOf: IsoOf;

  constructor(base: BoundarySource, layers: LayerList, file: LayerFile, isoOf: IsoOf) {
    this.base = base;
    this.layers = layers;
    this.file = file;
    this.isoOf = isoOf;
  }

  async levelsFor(country: CountryKey): Promise<readonly number[]> {
    const [shipped, mine] = await Promise.all([this.base.levelsFor(country), this.layersFor(country)]);
    return [...new Set([...shipped, ...mine.map((l) => l.adminLevel)])].sort((a, b) => a - b);
  }

  async load(country: CountryKey | null, level: number): Promise<BoundaryUnit[] | null> {
    if (country && level > 0) {
      const layer = (await this.layersFor(country)).find((l) => l.adminLevel === level);
      if (layer) {
        const collection = await this.file(layer.iso, layer.adminLevel);
        if (collection) return toUnits(collection);
        // An uploaded file that cannot be read is not silently replaced by the shipped one: the person would be looking at the wrong boundaries.
        return null;
      }
    }
    return this.base.load(country, level);
  }

  async originOf(country: CountryKey, level: number): Promise<BoundaryOrigin | null> {
    const layer = (await this.layersFor(country)).find((l) => l.adminLevel === level);
    return layer ? { kind: "UPLOADED", countryName: layer.countryName, layerName: layer.name } : this.base.originOf(country, level);
  }

  private async layersFor(country: CountryKey): Promise<UploadedLayer[]> {
    const all = await this.layers();
    if (all.length === 0) return [];
    const iso = (country.iso ?? (await this.isoOf(country)))?.toUpperCase() ?? null;
    const name = normalizeLocationKey(country.name);
    return all.filter((l) => (iso ? l.iso.toUpperCase() === iso : false) || normalizeLocationKey(l.countryName) === name);
  }
}
