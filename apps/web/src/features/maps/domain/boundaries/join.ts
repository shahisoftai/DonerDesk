/**
 * Which place a boundary unit stands for. Pure.
 *
 * Order, strongest first, and it never guesses:
 *  1. PCODE            the place's code equals the unit's P-code (the standard way; survives renaming and repeated names)
 *  2. NAME_AND_PARENT  same name, and the place sits inside the place whose code is the unit's parent P-code
 *  3. NAME             same name, and neither side has a twin (one place, one unit with that name)
 * Anything else is unjoined: the unit is drawn grey and the place is listed as not on the map, never given to a namesake.
 */
import { normalizeLocationKey } from "@donordesk/domain/contexts/workplan/index.js";

export interface BoundaryUnit {
  /** Stable key: the P-code, else `name:<key>`. */
  ref: string;
  name: string;
  /** Empty when the source carries none. */
  pcode: string;
  parentPcode: string;
  geometry: unknown;
}

export interface JoinPlace { id: string; name: string; code?: string | undefined; parentId?: string | undefined; aliases?: readonly string[] | undefined }

export type JoinBasis = "PCODE" | "NAME_AND_PARENT" | "NAME";
export interface JoinedUnit { unit: BoundaryUnit; placeId: string | null; basis: JoinBasis | null }

const codeKey = (code: string | undefined): string => (code ?? "").trim().toUpperCase();
const namesOf = (p: JoinPlace): string[] => [p.name, ...(p.aliases ?? [])].map(normalizeLocationKey).filter(Boolean);

export function joinUnits(units: readonly BoundaryUnit[], candidates: readonly JoinPlace[], allPlaces: readonly JoinPlace[] = candidates): JoinedUnit[] {
  const byId = new Map(allPlaces.map((p) => [p.id, p]));
  const unitsPerName = new Map<string, number>();
  for (const u of units) { const k = normalizeLocationKey(u.name); unitsPerName.set(k, (unitsPerName.get(k) ?? 0) + 1); }
  const taken = new Set<string>();

  return units.map((unit): JoinedUnit => {
    const miss: JoinedUnit = { unit, placeId: null, basis: null };
    const pcode = codeKey(unit.pcode);
    if (pcode) {
      const hits = candidates.filter((p) => codeKey(p.code) === pcode);
      if (hits.length === 1 && !taken.has(hits[0]!.id)) { taken.add(hits[0]!.id); return { unit, placeId: hits[0]!.id, basis: "PCODE" }; }
      if (hits.length > 1) return miss; // two places claim one P-code: a data problem to fix, not to pick from
    }
    const key = normalizeLocationKey(unit.name);
    const sameName = candidates.filter((p) => !taken.has(p.id) && namesOf(p).includes(key));
    if (sameName.length === 0) return miss;
    const parentCode = codeKey(unit.parentPcode);
    if (parentCode) {
      const inside = sameName.filter((p) => (p.parentId ? codeKey(byId.get(p.parentId)?.code) === parentCode : false));
      if (inside.length === 1) { taken.add(inside[0]!.id); return { unit, placeId: inside[0]!.id, basis: "NAME_AND_PARENT" }; }
      if (inside.length > 1) return miss;
    }
    if (sameName.length === 1 && (unitsPerName.get(key) ?? 0) === 1) { taken.add(sameName[0]!.id); return { unit, placeId: sameName[0]!.id, basis: "NAME" }; }
    return miss;
  });
}

/** The ref of a unit with no P-code: its name key, spaces as underscores (safe in an address). */
export const nameRef = (name: string): string => `name:${normalizeLocationKey(name).replace(/\s+/g, "_")}`;

/** The file a country's provinces are kept in (`/geo/ADM1/<key>.json`): its name as the places list spells it, folded and joined with underscores. */
export const admin1FileKey = (country: string): string => normalizeLocationKey(country).replace(/\s+/g, "_");

/** A boundary unit from a GeoJSON feature of our boundary files (`properties.id` is the P-code, `parentId` its parent's). */
export function unitFromFeature(f: { properties?: { name?: unknown; id?: unknown; parentId?: unknown } | null; geometry?: unknown }): BoundaryUnit | null {
  const name = typeof f.properties?.name === "string" ? f.properties.name.trim() : "";
  if (!name || !f.geometry) return null;
  const pcode = typeof f.properties?.id === "string" ? f.properties.id.trim() : "";
  const parentPcode = typeof f.properties?.parentId === "string" ? f.properties.parentId.trim() : "";
  return { ref: pcode || nameRef(name), name, pcode, parentPcode, geometry: f.geometry };
}

/** Of the joined units, how many matched only by name (flagged in the place panel: "matched by name"). */
export const matchedByNameOnly = (joined: readonly JoinedUnit[]): number => joined.filter((j) => j.basis === "NAME").length;
