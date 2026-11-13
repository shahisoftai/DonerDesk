/**
 * The country a results map opens on (Phase 53.1: a chain of rules, first answer wins; a new rule is a row).
 * 1. An organisation with one country place opens on it.
 * 2. Results that all sit in one country open on it.
 * 3. The project's own country, when it names a country the map knows.
 * Otherwise the world (null). Pure: no React, no map engine; a name is never guessed.
 */
export interface HomeCountryPlace { name: string; adminLevel: number; archived: boolean }
export interface HomeCountryResults { indicators: ReadonlyArray<{ rollup: { rows: ReadonlyArray<{ path: string }> } }> }
export interface HomeCountryInput { places: ReadonlyArray<HomeCountryPlace>; results: HomeCountryResults | null; projectCountry?: string | null | undefined; knownCountries?: ReadonlyArray<string> | undefined }
export type HomeCountryRule = (input: HomeCountryInput) => string | null;

const norm = (s: string): string => s.trim().toLowerCase();
const lastPart = (path: string): string => norm(path.split("›").pop() ?? "");
const countriesOf = (input: HomeCountryInput) => input.places.filter((p) => !p.archived && p.adminLevel === 0);

export const onlyCountryPlace: HomeCountryRule = (input) => {
  const countries = countriesOf(input);
  return countries.length === 1 ? countries[0]!.name : null;
};

export const countryOfAllResults: HomeCountryRule = (input) => {
  if (!input.results) return null;
  const seen = new Set(input.results.indicators.flatMap((i) => i.rollup.rows.map((r) => lastPart(r.path))).filter(Boolean));
  const matches = countriesOf(input).filter((c) => seen.has(norm(c.name)));
  return seen.size > 0 && matches.length === 1 && [...seen].every((s) => s === norm(matches[0]!.name)) ? matches[0]!.name : null;
};

export const projectCountry: HomeCountryRule = (input) => {
  const wanted = input.projectCountry ? norm(input.projectCountry) : "";
  if (!wanted) return null;
  const fromPlaces = countriesOf(input).find((c) => norm(c.name) === wanted);
  if (fromPlaces) return fromPlaces.name;
  return input.knownCountries?.find((c) => norm(c) === wanted) ?? null;
};

export const HOME_COUNTRY_RULES: readonly HomeCountryRule[] = [onlyCountryPlace, countryOfAllResults, projectCountry];

export function homeCountryOf(input: HomeCountryInput): string | null {
  for (const rule of HOME_COUNTRY_RULES) { const answer = rule(input); if (answer) return answer; }
  return null;
}

/** Kept for existing callers: places and results only. */
export function homeCountry(places: ReadonlyArray<HomeCountryPlace>, results: HomeCountryResults | null): string | null {
  return homeCountryOf({ places, results });
}
