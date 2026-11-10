import { findCountry, fileFor, type BoundaryFileEntry, type BoundaryManifest } from "../../domain/boundary-sources.ts";
import type { BoundaryUnit } from "../../domain/boundaries/join.ts";
import type { BoundaryIndex } from "../../domain/boundaries/boundary-index.ts";
import type { BoundaryOrigin, BoundarySource, CountryKey } from "../../ports/boundary-source.ts";


type ManifestLoader = () => Promise<BoundaryManifest | null>;
type IndexLoader = (entry: BoundaryFileEntry, version: string) => Promise<BoundaryIndex | null>;

const boxPolygon = (b: readonly number[]): unknown => ({ type: "Polygon", coordinates: [[[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]], [b[0], b[1]]]] });

/**
 * Levels 2 to 4 from vector tiles where the catalogue has them (Phase 49.3): the browser downloads a small index (names, P-codes, boxes) and
 * only the tiles in view, instead of every outline of the country at once. Units carry a `tile` reference and their box as `geometry`, which
 * is enough to frame the view and to pick children by parent P-code. Anything else (levels 0 and 1, a level without tiles, an index that
 * cannot be read) goes to the inner source. Only the results map uses this source: tools that test whether a point lies inside an outline
 * (pin placing, drawing) keep the full outlines.
 */
export class TiledBoundarySource implements BoundarySource {
  private readonly inner: BoundarySource;
  private readonly manifest: ManifestLoader;
  private readonly index: IndexLoader;
  private readonly origin: () => string;

  constructor(inner: BoundarySource, manifest: ManifestLoader, index: IndexLoader, origin: () => string) {
    this.inner = inner;
    this.manifest = manifest;
    this.index = index;
    this.origin = origin;
  }

  levelsFor(country: CountryKey): Promise<readonly number[]> { return this.inner.levelsFor(country); }
  originOf(country: CountryKey, level: number): Promise<BoundaryOrigin | null> { return this.inner.originOf(country, level); }

  async load(country: CountryKey | null, level: number): Promise<BoundaryUnit[] | null> {
    if (!country || level < 2) return this.inner.load(country, level);
    // An organisation's own upload for this country and level wins over the shipped tiles (it is the inner source's job to say so).
    if (await this.inner.originOf(country, level)) return this.inner.load(country, level);
    const manifest = await this.manifest();
    const entry = manifest ? fileFor(findCountry(manifest, country.iso ?? country.name) ?? findCountry(manifest, country.name), level as 2 | 3 | 4) : null;
    if (!manifest || !entry?.tiles || !entry.index) return this.inner.load(country, level);
    const index = await this.index(entry, manifest.generatedAt);
    if (!index) return this.inner.load(country, level);
    const url = `${this.origin()}/geo/${entry.tiles.file}?v=${encodeURIComponent(manifest.generatedAt)}`;
    const tile = { url, sourceLayer: entry.tiles.sourceLayer };
    return index.units.map((u) => ({ ref: u.ref, name: u.name, pcode: u.pcode ?? "", parentPcode: u.parentPcode ?? "", geometry: boxPolygon(u.bbox), tile }));
  }
}
