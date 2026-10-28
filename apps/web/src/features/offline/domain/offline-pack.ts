/**
 * The offline pack (Phase 33.6): what a phone keeps so a project's forms can be filled with no connection. Pure rules only; the
 * browser's storage and the network are passed in. A pack holds the open forms' questions and the places list, nothing else:
 * no records, no figures, no people. It belongs to the person who downloaded it and is removed on sign-out.
 */
import type { FormField } from "@donordesk/domain/contexts/collection/index.js";

export interface PackForm {
  id: string;
  name: string;
  description?: string;
  fields: FormField[];
}

export interface PackPlace {
  id: string;
  name: string;
  /** "Rabak › White Nile › Sudan": tells two places with the same name apart. */
  path: string;
}

export interface OfflinePack {
  version: 1;
  /** Who downloaded it: a pack is only ever shown to, and sent by, this person. */
  userId: string;
  userName: string;
  projectId: string;
  projectName: string;
  /** Milliseconds since the epoch, when the server made it. */
  generatedAt: number;
  forms: PackForm[];
  places: PackPlace[];
}

export interface PackStore {
  list(): Promise<OfflinePack[]>;
  put(pack: OfflinePack): Promise<void>;
  remove(projectId: string): Promise<void>;
  clear(): Promise<void>;
}

export const PACK_STALE_AFTER_DAYS = 14;
const DAY = 86_400_000;

export function packAgeDays(pack: Pick<OfflinePack, "generatedAt">, now: number): number {
  return Math.max(0, Math.floor((now - pack.generatedAt) / DAY));
}

/** One sentence about how fresh the pack is. Old does not block filling: the questions may simply have changed since. */
export function describePackFreshness(pack: Pick<OfflinePack, "generatedAt">, now: number): { stale: boolean; sentence: string } {
  const days = packAgeDays(pack, now);
  if (days === 0) return { stale: false, sentence: "Downloaded today." };
  if (days < PACK_STALE_AFTER_DAYS) return { stale: false, sentence: `Downloaded ${days} day${days === 1 ? "" : "s"} ago.` };
  return { stale: true, sentence: `Downloaded ${days} days ago. Download it again when you are online, in case the questions have changed.` };
}

/** Builds a pack from the server's answer. Dates arrive as text and are kept as numbers. */
export function packFromServer(input: {
  userId: string; userName: string; projectId: string; projectName: string; generatedAt: string; forms: PackForm[]; places: PackPlace[];
}): OfflinePack {
  const at = Date.parse(input.generatedAt);
  return {
    version: 1, userId: input.userId, userName: input.userName, projectId: input.projectId, projectName: input.projectName,
    generatedAt: Number.isFinite(at) ? at : 0, forms: input.forms, places: input.places,
  };
}

const fold = (text: string): string => text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Place names to suggest while a place question is typed, from the pack alone. Names that start with what was typed come before
 * names that merely contain it; two places with the same name are both listed with their paths so the person picks one.
 */
export function suggestPackPlaces(places: ReadonlyArray<PackPlace>, typed: string, limit = 8): PackPlace[] {
  const q = fold(typed);
  if (q.length < 2) return [];
  const starts: PackPlace[] = [];
  const contains: PackPlace[] = [];
  for (const p of places) {
    const name = fold(p.name);
    if (name.startsWith(q)) starts.push(p);
    else if (name.includes(q) || fold(p.path).includes(q)) contains.push(p);
  }
  return [...starts, ...contains].slice(0, limit);
}

/** Packs that belong to someone else are never shown or sent: on a shared phone they would be the previous person's. */
export function packsFor(packs: ReadonlyArray<OfflinePack>, userId: string): OfflinePack[] {
  return packs.filter((p) => p.userId === userId).sort((a, b) => a.projectName.localeCompare(b.projectName));
}

/** The in-memory store: the test double, and the fallback where the browser has no durable storage. */
export function createMemoryPackStore(): PackStore {
  const packs = new Map<string, OfflinePack>();
  return {
    list: async () => [...packs.values()].map((p) => ({ ...p })),
    put: async (pack) => void packs.set(pack.projectId, { ...pack }),
    remove: async (projectId) => void packs.delete(projectId),
    clear: async () => packs.clear(),
  };
}
