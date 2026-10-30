/**
 * Boundary files below admin 1 (Phase 35): which source files may ship, and how a country's file is found.
 * Pure: the generator script, the manifest reader and the map all use these functions, so there is one rule.
 *
 * geoBoundaries carries a licence per country. Attribution and public-domain licences ship. Share-alike licences
 * (ODbL, CC BY-SA) would oblige us to license derived data the same way, and "other" ones need a person's decision:
 * both are held back and listed, never shipped silently.
 */

export type LicenceVerdict = "SHIP" | "HOLD";

const HOLD_PATTERNS: readonly RegExp[] = [/share-?\s?alike/i, /\bodbl\b/i, /open database/i, /\bother\b/i, /direct permission/i, /unknown|^$/i];

export function licenceVerdict(licence: string | undefined | null): LicenceVerdict {
  const text = (licence ?? "").trim();
  return HOLD_PATTERNS.some((p) => p.test(text)) ? "HOLD" : "SHIP";
}

export type BoundaryLevel = 1 | 2 | 3;

export interface BoundaryFileEntry {
  level: BoundaryLevel;
  /** Path under /geo, e.g. "SDN/ADM2.json". */
  file: string;
  units: number;
  bytes: number;
  /** Set when this file's origin differs from the country's default (OCHA for one level, geoBoundaries for another). */
  origin?: "OCHA COD-AB" | "geoBoundaries";
  source?: string;
  licence?: string;
  yearRepresented?: string;
}

export interface BoundaryCountry {
  iso: string;
  name: string;
  /** The source's own words, shown in the map footer and exports. */
  source: string;
  licence: string;
  yearRepresented: string;
  files: BoundaryFileEntry[];
}

export interface BoundaryManifest {
  generatedAt: string;
  dataset: "geoBoundaries gbOpen";
  attribution: string;
  countries: BoundaryCountry[];
  /** Countries/levels left out for their licence: kept so the gap is visible. */
  held: Array<{ iso: string; name: string; level: BoundaryLevel; licence: string }>;
}

const fold = (s: string): string => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function findCountry(manifest: BoundaryManifest, nameOrIso: string): BoundaryCountry | null {
  const wanted = fold(nameOrIso);
  if (!wanted) return null;
  return manifest.countries.find((c) => fold(c.iso) === wanted || fold(c.name) === wanted) ?? null;
}

export const levelsFor = (country: BoundaryCountry | null): BoundaryLevel[] => (country ? country.files.map((f) => f.level).sort() : []);

export const fileFor = (country: BoundaryCountry | null, level: BoundaryLevel): BoundaryFileEntry | null => country?.files.find((f) => f.level === level) ?? null;

/** One line for the map footer: where this country's lines come from. */
export function attributionLine(country: BoundaryCountry, level?: BoundaryLevel): string {
  const entry = level ? fileFor(country, level) : null;
  const via = (entry?.origin ?? "geoBoundaries") === "OCHA COD-AB" ? "Via OCHA COD-AB (Humanitarian Data Exchange)." : "Via geoBoundaries (William & Mary geoLab).";
  return `${country.name} boundaries: ${entry?.source ?? country.source} (${entry?.yearRepresented ?? country.yearRepresented}), ${entry?.licence ?? country.licence}. ${via}`;
}

/** Whole-coordinate rounding used by the generator: 3 decimals is about 100 m, plenty for a district map. */
export const roundCoordinate = (n: number): number => Math.round(n * 1000) / 1000;

export function roundGeometry(value: unknown): unknown {
  if (typeof value === "number") return roundCoordinate(value);
  if (Array.isArray(value)) return value.map(roundGeometry);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, k === "coordinates" ? roundGeometry(v) : v]));
  return value;
}
