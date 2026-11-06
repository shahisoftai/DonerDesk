/**
 * Reads the Record forms' data from the server: the same project pack the phone downloads, fetched fresh and kept in memory for the
 * visit. One source of truth for what the forms need, so the network and the pack cannot disagree; nothing is stored on the device.
 */
import type { OfflinePack } from "../../offline/domain/offline-pack.ts";
import type { RecordLookup, RecordProject } from "../ports/record-lookup.ts";
import { createPackLookup } from "./pack-lookup.ts";

export interface NetworkSource {
  /** The projects the person can record into. */
  listProjects(): Promise<RecordProject[]>;
  /** The current pack for one project. Rejects when the server cannot be reached; the caller decides what to say. */
  fetchPack(projectId: string): Promise<OfflinePack>;
}

export function createNetworkLookup(source: NetworkSource): RecordLookup {
  const cache = new Map<string, Promise<OfflinePack>>();
  const pack = (projectId: string): Promise<OfflinePack> => {
    let hit = cache.get(projectId);
    if (!hit) {
      hit = source.fetchPack(projectId);
      // A failed read must not stick: the next ask tries again.
      hit.catch(() => cache.delete(projectId));
      cache.set(projectId, hit);
    }
    return hit;
  };
  const view = async (projectId: string) => createPackLookup([await pack(projectId)], "network");
  return {
    source: "network",
    projects: () => source.listProjects(),
    indicators: async (projectId) => (await view(projectId)).indicators(projectId),
    periods: async (projectId) => (await view(projectId)).periods(projectId),
    plan: async (projectId) => (await view(projectId)).plan(projectId),
    places: async (projectId) => (await view(projectId)).places(projectId),
    forms: async (projectId) => (await view(projectId)).forms(projectId),
    refresh: (projectId) => void cache.delete(projectId),
  };
}
