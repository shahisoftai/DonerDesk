/**
 * Boundary files below admin 1 (Phase 35, licence rule revised in Phase 41): which source files may ship, and how a country's file is found.
 * Pure: the generator scripts, the manifest reader, the sources page and the map all use these functions, so there is one rule.
 *
 * - SHIP: attribution and public-domain licences. We credit the source in the footer and on /maps/sources.
 * - SHARE_ALIKE: ODbL and CC BY-SA. Open licences that need no permission: we ship the file, credit the source, and record that a
 *   derived copy (simplified, re-coded, tiled) is offered under the same licence. Our app, tenant data and figures stay ours.
 * - HOLD: "other", unknown or unstated licences. These need a person's decision and are listed, never shipped silently.
 */

export type LicenceVerdict = "SHIP" | "SHARE_ALIKE" | "HOLD";

const SHARE_ALIKE_PATTERNS: readonly RegExp[] = [/share-?\s?alike/i, /\bodbl\b/i, /open database/i];
const HOLD_PATTERNS: readonly RegExp[] = [/\bother\b/i, /direct permission/i, /unknown|^$/i];

export function licenceVerdict(licence: string | undefined | null): LicenceVerdict {
  const text = (licence ?? "").trim();
  if (HOLD_PATTERNS.some((p) => p.test(text))) return "HOLD";
  return SHARE_ALIKE_PATTERNS.some((p) => p.test(text)) ? "SHARE_ALIKE" : "SHIP";
}

/** True when a derived copy of the file must be offered under the same licence. */
export const requiresShareAlike = (licence: string | undefined | null): boolean => licenceVerdict(licence) === "SHARE_ALIKE";

export type BoundaryLevel = 1 | 2 | 3 | 4;

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
  /** Set when a derived copy must be offered under the same licence (ODbL, CC BY-SA). */
  shareAlike?: boolean;
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

/**
 * One line for the map footer: where this file's lines come from. A file's own credit is used; the country-level fields describe whichever
 * file was written last, so they are never borrowed for a file that has no credit of its own (a wrong credit is worse than a general one).
 */
export function attributionLine(country: BoundaryCountry, level?: BoundaryLevel): string {
  const entry = level ? fileFor(country, level) : null;
  const ocha = (entry?.origin ?? "geoBoundaries") === "OCHA COD-AB";
  const via = ocha ? "Via OCHA COD-AB (Humanitarian Data Exchange)." : "Via geoBoundaries (William & Mary geoLab).";
  if (entry && !entry.source && !entry.origin) return `${country.name} boundaries: geoBoundaries (William & Mary geoLab); the source and licence of each file are listed on the map sources page.`;
  const own = entry?.source ?? country.source;
  return `${country.name} boundaries: ${own} (${entry?.yearRepresented ?? country.yearRepresented}), ${entry?.licence ?? country.licence}. ${via}`;
}

/** Coordinate rounding used by the generator: 3 decimals is about 100 m (districts), 4 about 10 m (admin 4 units are small). */
export const roundCoordinate = (n: number, digits = 3): number => { const f = 10 ** digits; return Math.round(n * f) / f; };

export function roundGeometry(value: unknown, digits = 3): unknown {
  if (typeof value === "number") return roundCoordinate(value, digits);
  if (Array.isArray(value)) return value.map((v) => roundGeometry(v, digits));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, k === "coordinates" ? roundGeometry(v, digits) : v]));
  return value;
}

/** Simplification tolerance (degrees) per level: finer where units are smaller. */
export const SIMPLIFY_EPSILON: Readonly<Record<BoundaryLevel, number>> = { 1: 0.02, 2: 0.01, 3: 0.005, 4: 0.002 };
export const ROUND_DIGITS: Readonly<Record<BoundaryLevel, number>> = { 1: 3, 2: 3, 3: 3, 4: 4 };

/** One row of the public sources page (/maps/sources): every shipped file with its credit and obligations. */
export interface SourceRow {
  iso: string;
  country: string;
  level: BoundaryLevel;
  file: string;
  source: string;
  licence: string;
  yearRepresented: string;
  /** A derived copy of this file is offered under the same licence. */
  shareAlike: boolean;
}

/** Every shipped file, one row each, sorted by country then level. Held files are not listed here (they are not shipped). */
export function sourcesPageRows(manifest: BoundaryManifest): SourceRow[] {
  return manifest.countries
    .flatMap((c) => c.files.map((f): SourceRow => ({
      iso: c.iso,
      country: c.name,
      level: f.level,
      file: f.file,
      source: f.source ?? c.source,
      licence: f.licence ?? c.licence,
      yearRepresented: f.yearRepresented ?? c.yearRepresented,
      shareAlike: f.shareAlike === true || requiresShareAlike(f.licence ?? c.licence),
    })))
    .sort((a, b) => a.country.localeCompare(b.country) || a.level - b.level);
}
