/**
 * The country a results map opens on. An organisation with one country opens on it; one working in several opens on the country
 * every place with a result sits in (the last part of each row's path), so a Kenya project's map opens on Kenya, not the world.
 * Results spread over several countries, or none, open on the world (null). Pure: no React, no map engine.
 */
export interface HomeCountryPlace { name: string; adminLevel: number; archived: boolean }
export interface HomeCountryResults { indicators: ReadonlyArray<{ rollup: { rows: ReadonlyArray<{ path: string }> } }> }

const lastPart = (path: string): string => (path.split("›").pop() ?? "").trim().toLowerCase();

export function homeCountry(places: ReadonlyArray<HomeCountryPlace>, results: HomeCountryResults | null): string | null {
  const countries = places.filter((p) => !p.archived && p.adminLevel === 0);
  if (countries.length === 1) return countries[0]!.name;
  if (!results) return null;
  const seen = new Set(results.indicators.flatMap((i) => i.rollup.rows.map((r) => lastPart(r.path))).filter(Boolean));
  const matches = countries.filter((c) => seen.has(c.name.trim().toLowerCase()));
  return seen.size > 0 && matches.length === 1 && [...seen].every((s) => s === matches[0]!.name.trim().toLowerCase()) ? matches[0]!.name : null;
}
