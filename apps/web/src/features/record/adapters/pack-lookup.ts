/**
 * Reads the Record forms' data from offline packs (the phone's own storage). Pure: the packs are handed in. A pack belongs to the
 * person who downloaded it, so the caller passes only that person's packs (`packsFor`); this adapter never filters by user itself.
 */
import type { OfflinePack } from "../../offline/domain/offline-pack.ts";
import type { RecordLookup } from "../ports/record-lookup.ts";

export function createPackLookup(packs: readonly OfflinePack[], source: RecordLookup["source"] = "pack"): RecordLookup {
  const byProject = new Map(packs.map((p) => [p.projectId, p] as const));
  return {
    source,
    projects: async () => packs.map((p) => ({ id: p.projectId, name: p.projectName })).sort((a, b) => a.name.localeCompare(b.name)),
    indicators: async (projectId) => byProject.get(projectId)?.indicators ?? null,
    periods: async (projectId) => byProject.get(projectId)?.periods ?? null,
    plan: async (projectId) => byProject.get(projectId)?.plan ?? null,
    places: async (projectId) => byProject.get(projectId)?.places ?? [],
    forms: async (projectId) => byProject.get(projectId)?.forms ?? [],
    placeEntry: async (projectId) => {
      const pack = byProject.get(projectId);
      return pack?.entryPlaces && pack.indicatorPlaces ? { places: pack.entryPlaces, indicatorPlaces: pack.indicatorPlaces } : null;
    },
    placeCells: async (projectId, periodId, placeId) => {
      const cells = byProject.get(projectId)?.placeCells;
      if (!cells || !cells.some((c) => c.periodId === periodId)) return null;
      return cells.filter((c) => c.periodId === periodId && c.placeId === placeId).map((c) => ({ indicatorId: c.indicatorId, value: c.value, locked: c.locked, ...(c.lockReason ? { lockReason: c.lockReason } : {}) }));
    },
    refresh: () => undefined,
  };
}
