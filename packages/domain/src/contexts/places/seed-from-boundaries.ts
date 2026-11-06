/**
 * Creating a country's places from its built-in boundary units (Phase 42.2). Pure: ids come from the caller.
 *
 * The caller (the browser, which has the boundary files) names each unit with a local `ref` and, when it could tell, its `parentRef`
 * (a P-code match, or a position test). Nothing here guesses: a unit whose parent is not known sits directly under the country and is
 * counted, so the person can move it later. A unit already in the list (same P-code, or same name under the same parent) is skipped and
 * stands in for itself, so running the same seed twice creates nothing the second time.
 */
import { normalizeLocationKey } from "../workplan/location-key.js";
import { PlaceRegistry, placeKeys, validatePlace, type AdminLevel, type PlaceRecord } from "./place.js";

export const SEED_UNITS_MAX = 25_000;

export interface SeedUnit {
  /** Local key inside this request. */
  ref: string;
  parentRef?: string | undefined;
  level: 1 | 2 | 3 | 4;
  name: string;
  /** The unit's own P-code, kept as the place's code. */
  code?: string | undefined;
}

export interface BoundarySeedPlan {
  create: PlaceRecord[];
  skipped: number;
  /** Units finer than the coarsest level asked for that sit directly under the country because no parent could be told. */
  underCountry: number;
  problems: string[];
}

const codeKey = (c: string | undefined): string => (c ?? "").trim().toUpperCase();

export function planBoundarySeed(country: { name: string }, units: readonly SeedUnit[], registry: PlaceRegistry, newId: () => string): BoundarySeedPlan {
  const problems: string[] = [];
  if (units.length > SEED_UNITS_MAX) return { create: [], skipped: 0, underCountry: 0, problems: [`That is more than ${SEED_UNITS_MAX} places; choose fewer levels`] };
  const existing = registry.all();
  const created: PlaceRecord[] = [];
  const idByRef = new Map<string, string>();
  let skipped = 0;
  let underCountry = 0;

  // The country itself: an existing place of that name at level 0, else a new one.
  const countryKey = normalizeLocationKey(country.name);
  const found = existing.find((p) => p.adminLevel === 0 && !p.archived && placeKeys(p).includes(countryKey));
  let countryId: string;
  if (found) countryId = found.id;
  else {
    countryId = newId();
    const record = validatePlace({ id: countryId, name: country.name, kind: "AREA", adminLevel: 0, country: country.name, aliases: [], archived: false }, existing);
    if (!record.ok) return { create: [], skipped: 0, underCountry: 0, problems: [`${country.name}: ${record.error.message}`] };
    created.push(record.value);
  }

  const byCode = new Map(existing.filter((p) => p.code && !p.archived).map((p) => [codeKey(p.code), p] as const));
  // The coarsest level asked for can only sit under the country, so it is never counted as "could not be placed".
  const coarsest = units.reduce((m, u) => Math.min(m, u.level), 4);
  // Parents first: a finer level never precedes a coarser one.
  for (const unit of [...units].sort((a, b) => a.level - b.level)) {
    const hit = unit.code ? byCode.get(codeKey(unit.code)) : undefined;
    let parentId = (unit.parentRef ? idByRef.get(unit.parentRef) : undefined);
    if (!parentId) { parentId = countryId; if (unit.level > coarsest) underCountry += 1; }
    const sameName = hit ?? [...existing, ...created].find((p) => !p.archived && (p.parentId ?? "") === parentId && placeKeys(p).includes(normalizeLocationKey(unit.name)));
    if (sameName) { idByRef.set(unit.ref, sameName.id); skipped += 1; continue; }
    const id = newId();
    const record: PlaceRecord = {
      id, name: unit.name.trim(), kind: "AREA", adminLevel: unit.level as AdminLevel, parentId, country: country.name,
      ...(unit.code?.trim() ? { code: unit.code.trim() } : {}), aliases: [], archived: false, placedBy: "IMPORT",
    };
    const valid = validatePlace(record, [...existing, ...created]);
    if (!valid.ok) { problems.push(`${unit.name} (level ${unit.level}): ${valid.error.message}`); continue; }
    created.push(valid.value);
    idByRef.set(unit.ref, id);
    if (unit.code?.trim()) byCode.set(codeKey(unit.code), valid.value);
  }
  return { create: problems.length ? [] : created, skipped, underCountry, problems };
}
