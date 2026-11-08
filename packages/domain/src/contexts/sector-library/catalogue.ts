/**
 * Browsing the library (Phase 46): which entries a sector offers, in what groups, and how a search finds them. Pure functions
 * over a list of entries, so the built-in library, an organisation's additions and a test's small list are read the same way.
 */
import type { LibraryIndicator, LibraryIndicatorKind, LibraryLevel, LibrarySectorId, LibrarySourceId, LibraryReviewStatus } from "./model.js";

export interface LibraryQuery {
  sectors?: readonly LibrarySectorId[];
  text?: string;
  sources?: readonly LibrarySourceId[];
  levels?: readonly LibraryLevel[];
  kinds?: readonly LibraryIndicatorKind[];
  reviewed?: "ALL" | "REVIEWED_ONLY";
  recommendedOnly?: boolean;
  /** Entries already in the project, left out of the list. */
  exclude?: ReadonlySet<string>;
  withStandard?: boolean;
}

const norm = (v: string): string => v.toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim();

function haystack(e: LibraryIndicator): string {
  return norm([e.id, e.name, e.definition, e.group, e.unit, ...e.tags, e.sourceRef.standard ?? ""].join(" "));
}

/** Entries that match every filter, with a stable order: sector order, then group, then id. A search needs every word to be found. */
export function searchLibrary(all: readonly LibraryIndicator[], q: LibraryQuery, reviewOf: (e: LibraryIndicator) => LibraryReviewStatus = (e) => e.review.status): LibraryIndicator[] {
  const words = norm(q.text ?? "").split(" ").filter(Boolean);
  return all
    .filter((e) => e.review.status !== "DEPRECATED" || !e.deprecatedBy)
    .filter((e) => !q.sectors || q.sectors.length === 0 || q.sectors.includes(e.sectorId) || (e.alsoIn ?? []).some((s) => q.sectors!.includes(s)))
    .filter((e) => !q.sources || q.sources.length === 0 || q.sources.includes(e.sourceRef.sourceId))
    .filter((e) => !q.levels || q.levels.length === 0 || q.levels.includes(e.level))
    .filter((e) => !q.kinds || q.kinds.length === 0 || q.kinds.includes(e.kind))
    .filter((e) => (q.reviewed === "REVIEWED_ONLY" ? reviewOf(e) === "REVIEWED" : true))
    .filter((e) => (q.recommendedOnly ? e.recommended : true))
    .filter((e) => (q.withStandard ? Boolean(e.referenceStandard) : true))
    .filter((e) => !q.exclude?.has(e.id))
    .filter((e) => { const h = haystack(e); return words.every((w) => h.includes(w)); })
    .sort((a, b) => a.group.localeCompare(b.group) || a.id.localeCompare(b.id));
}

export interface LibraryGroup { group: string; entries: LibraryIndicator[] }

/** The picker's shape: entries under the standard or theme they belong to, in the order the group first appears. */
export function groupEntries(entries: readonly LibraryIndicator[]): LibraryGroup[] {
  const groups = new Map<string, LibraryIndicator[]>();
  for (const e of entries) groups.set(e.group, [...(groups.get(e.group) ?? []), e]);
  return [...groups].map(([group, list]) => ({ group, entries: list }));
}

export function countBySector(all: readonly LibraryIndicator[]): Map<LibrarySectorId, number> {
  const counts = new Map<LibrarySectorId, number>();
  for (const e of all) {
    counts.set(e.sectorId, (counts.get(e.sectorId) ?? 0) + 1);
    for (const o of e.alsoIn ?? []) counts.set(o, (counts.get(o) ?? 0) + 1);
  }
  return counts;
}

/** The suggested set: entries marked recommended in the chosen sectors, one of each, not already in the project. */
export function recommendedSet(all: readonly LibraryIndicator[], sectors: readonly LibrarySectorId[], exclude: ReadonlySet<string> = new Set()): LibraryIndicator[] {
  return searchLibrary(all, { sectors, recommendedOnly: true, exclude });
}
