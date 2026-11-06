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

/** Pack v2 (Phase 44): a number the person may type. Calculated indicators are never carried. */
export interface PackIndicator {
  id: string;
  code: string;
  name: string;
  type: string;
  disaggregationRequired: boolean;
  unit?: string;
  frequency?: string;
}

/** A reporting period, so a day can be matched to one with no connection. */
export interface PackPeriod {
  id: string;
  reportType: string;
  startDate: string;
  endDate: string;
  status: string;
}

/** One of the person's own open planned items for the next 14 days. */
export interface PackPlanItem {
  id: string;
  title: string;
  plannedStart: string;
  plannedEnd: string;
  status: string;
  location?: string;
}

export interface OfflinePack {
  /** 1 = forms and places only (Phase 33.6). 2 adds the parts below. A v1 pack still fills forms. */
  version: 1 | 2;
  /** Who downloaded it: a pack is only ever shown to, and sent by, this person. */
  userId: string;
  userName: string;
  projectId: string;
  projectName: string;
  /** Milliseconds since the epoch, when the server made it. */
  generatedAt: number;
  forms: PackForm[];
  places: PackPlace[];
  /** v2 parts. Absent on a v1 pack, or when the server was older: then numbers and the plan need a connection. */
  indicators?: PackIndicator[];
  periods?: PackPeriod[];
  plan?: PackPlanItem[];
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
export function describePackFreshness(pack: Pick<OfflinePack, "generatedAt">, now: number): { stale: boolean; days: number; sentence: string } {
  const days = packAgeDays(pack, now);
  if (days === 0) return { stale: false, days, sentence: "Downloaded today." };
  if (days < PACK_STALE_AFTER_DAYS) return { stale: false, days, sentence: `Downloaded ${days} day${days === 1 ? "" : "s"} ago.` };
  return { stale: true, days, sentence: `Downloaded ${days} days ago. Download it again when you are online, in case the questions have changed.` };
}

/** Builds a pack from the server's answer. Dates arrive as text and are kept as numbers. */
export function packFromServer(input: {
  userId: string; userName: string; projectId: string; projectName: string; generatedAt: string; forms: PackForm[]; places: PackPlace[];
  indicators?: PackIndicator[] | undefined; periods?: PackPeriod[] | undefined; plan?: PackPlanItem[] | undefined;
}): OfflinePack {
  const at = Date.parse(input.generatedAt);
  const v2 = input.indicators !== undefined || input.periods !== undefined || input.plan !== undefined;
  return {
    version: v2 ? 2 : 1, userId: input.userId, userName: input.userName, projectId: input.projectId, projectName: input.projectName,
    generatedAt: Number.isFinite(at) ? at : 0, forms: input.forms, places: input.places,
    ...(input.indicators !== undefined ? { indicators: input.indicators } : {}),
    ...(input.periods !== undefined ? { periods: input.periods } : {}),
    ...(input.plan !== undefined ? { plan: input.plan } : {}),
  };
}

/** Whether a pack carries what recording a number needs offline. A v1 pack (or one from an older server) does not. */
export function packCanRecordNumbers(pack: Pick<OfflinePack, "indicators" | "periods">): boolean {
  return pack.indicators !== undefined && pack.periods !== undefined;
}

/** What is on the phone for one project, as numbers the "Ready for offline" screen words (never a sentence made here). */
export function packCounts(pack: Pick<OfflinePack, "forms" | "places" | "indicators" | "plan">): { forms: number; places: number; indicators: number; plan: number } {
  return { forms: pack.forms.length, places: pack.places.length, indicators: pack.indicators?.length ?? 0, plan: pack.plan?.length ?? 0 };
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
