/**
 * Ticking areas on a project's "Where we work" page (Phase 53.4). The wizard keeps its ticks in a draft; here a tick goes straight into the
 * organisation's places list through the ordinary boundary import, so these are the two rules that page needs. Pure.
 */
import { normalizeLocationKey } from "@donordesk/domain/contexts/workplan/index.js";
import type { BoundaryPick } from "@donordesk/domain";
import type { BoundaryUnit } from "../../maps/domain/boundaries/join";

export interface ListedPlace { name: string; adminLevel: number; code?: string | null | undefined; archived: boolean }
export interface SeedUnit { ref: string; parentRef?: string; level: 1 | 2 | 3 | 4; name: string; code?: string }

/** The refs of loaded areas the places list already holds: by code when the place has one, else by name at the same level. Never guessed across levels. */
export function listedRefs(units: ReadonlyMap<number, readonly BoundaryUnit[]>, places: readonly ListedPlace[]): Set<string> {
  const out = new Set<string>();
  for (const [level, list] of units) {
    const here = places.filter((p) => !p.archived && p.adminLevel === level);
    const pcodes = new Set(list.map((u) => u.pcode).filter(Boolean));
    const codes = new Set(here.map((p) => p.code).filter((c): c is string => !!c && pcodes.has(c)));
    // A place whose code names an area here is matched by that code only; any other place (no code, or a code from another scheme)
    // is matched by name at the same level. Never across levels, never by a partial name.
    const names = new Set(here.filter((p) => !p.code || !pcodes.has(p.code)).map((p) => normalizeLocationKey(p.name)));
    for (const u of list) if ((u.pcode && codes.has(u.pcode)) || names.has(normalizeLocationKey(u.name))) out.add(u.ref);
  }
  return out;
}

/** What the boundary import needs for the ticked areas and the areas above them (the country itself is never sent; levels 1-4 only). */
export function seedUnitsFor(picks: readonly BoundaryPick[]): SeedUnit[] {
  const levels = new Map(picks.map((p) => [p.ref, p.adminLevel]));
  return picks.filter((p) => p.adminLevel >= 1 && p.adminLevel <= 4).map((p) => ({
    ref: p.ref, level: p.adminLevel as 1 | 2 | 3 | 4, name: p.name,
    ...(p.parentRef && (levels.get(p.parentRef) ?? 0) >= 1 ? { parentRef: p.parentRef } : {}),
    ...(p.code ? { code: p.code } : {}),
  }));
}

/** Phase 56: which loaded unit each of the project's areas is (same rule as `listedRefs`: code when it names a unit, else name at the level). */
export function areaRefs(units: ReadonlyMap<number, readonly BoundaryUnit[]>, areas: ReadonlyArray<ListedPlace & { id: string }>): Map<string, string> {
  const out = new Map<string, string>();
  for (const [level, list] of units) {
    for (const a of areas.filter((x) => !x.archived && x.adminLevel === level)) {
      const byCode = a.code ? list.find((u) => u.pcode && u.pcode === a.code) : undefined;
      const hit = byCode ?? list.find((u) => normalizeLocationKey(u.name) === normalizeLocationKey(a.name));
      if (hit) out.set(hit.ref, a.id);
    }
  }
  return out;
}
