import type { BoundaryUnit } from "../domain/boundaries/join.ts";

/** A country as the map knows it: its name (always) and ISO3 code (when the catalogue has it). */
export interface CountryKey { name: string; iso?: string | undefined }

/** The organisation's own upload supplied a level. */
export interface BoundaryOrigin { kind: "UPLOADED"; countryName: string; layerName: string }

export interface BoundarySource {
  /** The admin levels below the country that can be drawn, ascending (1 = provinces). Empty when nothing is available. */
  levelsFor(country: CountryKey): Promise<readonly number[]>;
  /** The units at `level` for a country (level 0 ignores `country` and returns every country). Null when the file cannot be read. */
  load(country: CountryKey | null, level: number): Promise<BoundaryUnit[] | null>;
  /** Where a level's boundaries came from, when this source is the one that supplied them (the organisation's own upload); else null. The screen words the credit. */
  originOf(country: CountryKey, level: number): Promise<BoundaryOrigin | null>;
}
