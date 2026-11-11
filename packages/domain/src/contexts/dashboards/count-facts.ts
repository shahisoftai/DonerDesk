/**
 * Assembling the facts the counts read (Phase 50.3), from records the product already keeps. Pure; the application gathers the inputs
 * under the viewer's own access.
 *
 * - Places reached: places of the places list whose name or alias matches a LOCATION a recorded value names (the same matching the
 *   Data Center uses); each carries the keys of the places above it, so a province's card counts its districts.
 * - Donors: the donor named on the project and the funding sources it has money from. Partners: the project's partner organisation.
 *   Both apply to every place the project recorded a value for (a single project does not say which donor paid for which district).
 * - Facilities: places marked as facilities, with their type.
 */
import type { DataSheet } from "../reporting/data-sheet.js";
import { normalizeLocationKey } from "../workplan/location-key.js";
import type { CountFacts } from "./count-metrics.js";

export interface CountPlace { id: string; name: string; aliases: readonly string[]; adminLevel: number; parentId?: string | undefined; facility?: boolean | undefined; facilityType?: string | undefined; archived?: boolean | undefined }
export interface CountProject { donorName?: string | undefined; partnerOrganization?: string | null | undefined }

export function countFactsFrom(input: { sheets: readonly DataSheet[]; places: readonly CountPlace[]; projects: readonly CountProject[]; fundingSourceNames: readonly string[] }): CountFacts {
  const live = input.places.filter((p) => !p.archived);
  const byId = new Map(live.map((p) => [p.id, p]));
  const keyOf = (p: CountPlace): string => normalizeLocationKey(p.name);
  const above = (p: CountPlace): string[] => { const out: string[] = []; let cur = p.parentId ? byId.get(p.parentId) : undefined; for (let i = 0; cur && i < 6; i++) { out.push(keyOf(cur)); cur = cur.parentId ? byId.get(cur.parentId) : undefined; } return out; };
  const byWord = new Map<string, CountPlace>();
  for (const p of live) for (const w of [p.name, ...p.aliases]) { const k = normalizeLocationKey(w); if (k && !byWord.has(k)) byWord.set(k, p); }

  const recorded = new Set<string>();
  for (const sheet of input.sheets) for (const c of sheet.cells) for (const b of c.breakdown ?? []) {
    if (b.dimension.trim().toUpperCase() !== "LOCATION" || b.value.trim() === "") continue;
    const p = byWord.get(normalizeLocationKey(b.category));
    if (p) recorded.add(p.id);
  }
  const placesWithValues = [...recorded].map((id) => byId.get(id)!).map((p) => ({ key: keyOf(p), level: p.adminLevel, within: above(p) }));
  // The keys of every place with a value and every place above one: a donor of the project is present in all of them.
  const reached = [...new Set(placesWithValues.flatMap((p) => [p.key, ...p.within]))];
  const named = (names: Array<string | null | undefined>) => [...new Set(names.map((n) => (n ?? "").trim()).filter(Boolean))].map((name) => ({ name, placeKeys: reached }));
  return {
    placesWithValues,
    donors: named([...input.projects.map((p) => p.donorName), ...input.fundingSourceNames]),
    partners: named(input.projects.map((p) => p.partnerOrganization)),
    facilities: live.filter((p) => p.facility).map((p) => ({ key: keyOf(p), type: p.facilityType ?? null, within: above(p) })),
  };
}
