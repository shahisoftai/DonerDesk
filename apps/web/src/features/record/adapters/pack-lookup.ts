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
    refresh: () => undefined,
  };
}
