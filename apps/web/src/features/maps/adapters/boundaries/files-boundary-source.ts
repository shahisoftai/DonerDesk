import { findCountry, fileFor, levelsFor, type BoundaryManifest } from "../../domain/boundary-sources.ts";
import type { BoundaryUnit } from "../../domain/boundaries/join.ts";
import { toUnits } from "./to-units.ts";
import type { BoundarySource, CountryKey } from "../../ports/boundary-source.ts";
import type { NamedGeoCollection } from "../../../workplan/domain/geo/geo-types.ts";

/** The world's countries (a small module bundled with the app). */
type WorldLoader = () => Promise<NamedGeoCollection>;
/** Every country's provinces as one module: big, so only the fallback when a country's own file (`/geo/ADM1/<key>.json`) has not been synced. */
type BundledAdmin1 = () => Promise<NamedGeoCollection>;
/** One country's provinces from its own small file, or null when there is none. */
type Admin1File = (country: string) => Promise<NamedGeoCollection | null>;
type ManifestLoader = () => Promise<BoundaryManifest | null>;
type FileLoader = (entry: NonNullable<ReturnType<typeof fileFor>>) => Promise<NamedGeoCollection | null>;
type ProvinceFilter = (admin1: NamedGeoCollection, country: string) => NamedGeoCollection | null;

/**
 * Boundaries from the files we ship: the bundled world and provinces (levels 0 and 1) and, per country, the static
 * files under /geo for levels 2 to 4. The catalogue (`manifest.json`) says which levels exist; this class never assumes one.
 * Everything arrives as the same `BoundaryUnit`, with the file's own P-code and its parent's when it has them.
 */
export class FilesBoundarySource implements BoundarySource {
  private readonly world: WorldLoader;
  private readonly admin1File: Admin1File;
  private readonly bundledAdmin1: BundledAdmin1;
  private readonly manifest: ManifestLoader;
  private readonly file: FileLoader;
  private readonly provincesOf: ProvinceFilter;

  constructor(world: WorldLoader, admin1File: Admin1File, bundledAdmin1: BundledAdmin1, manifest: ManifestLoader, file: FileLoader, provincesOf: ProvinceFilter) {
    this.world = world;
    this.admin1File = admin1File;
    this.bundledAdmin1 = bundledAdmin1;
    this.manifest = manifest;
    this.file = file;
    this.provincesOf = provincesOf;
  }

  /** A country's provinces: its own small file first; the big bundled module only when that file is not there. */
  private async provinces(country: string): Promise<NamedGeoCollection | null> {
    return (await this.admin1File(country)) ?? this.provincesOf(await this.bundledAdmin1(), country);
  }

  async levelsFor(country: CountryKey): Promise<readonly number[]> {
    const [provinces, manifest] = await Promise.all([this.provinces(country.name), this.manifest()]);
    const files = manifest ? levelsFor(findCountry(manifest, country.iso ?? country.name) ?? findCountry(manifest, country.name)) : [];
    return [...new Set([...(provinces ? [1] : []), ...files])].sort((a, b) => a - b);
  }

  /** The files we ship are credited by the catalogue (the footer reads it); nothing extra to say here. */
  async originOf(): Promise<null> { return null; }

  async load(country: CountryKey | null, level: number): Promise<BoundaryUnit[] | null> {
    if (level === 0) return toUnits(await this.world());
    if (!country) return null;
    if (level === 1) {
      const provinces = await this.provinces(country.name);
      return provinces ? toUnits(provinces) : null;
    }
    const manifest = await this.manifest();
    const entry = manifest ? fileFor(findCountry(manifest, country.iso ?? country.name) ?? findCountry(manifest, country.name), level as 2 | 3 | 4) : null;
    const collection = entry ? await this.file(entry) : null;
    return collection ? toUnits(collection) : null;
  }
}
