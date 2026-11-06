/**
 * From a place in the list to where the map should be. Pure.
 *
 * The map's path is the boundaries opened from the country down to the one above the place; the place itself is then the selected
 * unit at the level that path draws. A crumb's ref is the place's own code (P-code) when it has one, else its name key: the same
 * rule the boundary units use, so the crumb finds its unit.
 */
import { nameRef } from "../boundaries/join.ts";
import type { DrillPath } from "./drill-path.ts";

export interface PathPlace { id: string; name: string; adminLevel: number; parentId?: string | undefined; code?: string | undefined }

export const refOfPlace = (p: Pick<PathPlace, "name" | "code">): string => (p.code?.trim() ? p.code.trim() : nameRef(p.name));

/** The ancestors of the place (country first) as the path to open, and the ref of the place's own unit. Null when the place is not in the list. */
export function pathForPlace(places: readonly PathPlace[], id: string): { path: DrillPath; ref: string; level: number } | null {
  const byId = new Map(places.map((p) => [p.id, p]));
  const place = byId.get(id);
  if (!place) return null;
  const chain: PathPlace[] = [];
  for (let up = place.parentId ? byId.get(place.parentId) : undefined, guard = 0; up && guard < 8; up = up.parentId ? byId.get(up.parentId) : undefined, guard += 1) chain.unshift(up);
  // Levels must strictly increase from the country; a malformed chain gives the world rather than a broken address.
  const levels = [...chain.map((p) => p.adminLevel), place.adminLevel];
  if (levels.some((l, i) => i > 0 && l <= levels[i - 1]!)) return null;
  return { path: chain.map((p) => ({ level: p.adminLevel, name: p.name, ref: refOfPlace(p) })), ref: refOfPlace(place), level: place.adminLevel };
}
