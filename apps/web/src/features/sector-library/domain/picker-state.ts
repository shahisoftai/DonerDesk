/**
 * The picker's behaviour, pure (Phase 46): what is selected, what a filter change asks the server for, how a search turns into a
 * query, and how the entries of several sectors are shown without repeating one. No React and no network, so every rule is a
 * plain test. The screen only draws it.
 */
import type { LibraryEntryView, LibraryFilters } from "./library-dto";

export const EMPTY_FILTERS: LibraryFilters = { text: "", sectors: [], levels: [], kinds: [], reviewedOnly: false, recommendedOnly: false, withStandard: false };

export type Selection = ReadonlySet<string>;

/** An entry already in the project cannot be chosen again. */
export const canSelect = (e: LibraryEntryView): boolean => !e.adopted;

export function toggle(sel: Selection, id: string): Selection {
  const next = new Set(sel);
  if (next.has(id)) next.delete(id); else next.add(id);
  return next;
}

/** Selects or clears a whole group; entries already in the project are never selected. */
export function toggleGroup(sel: Selection, entries: readonly LibraryEntryView[]): Selection {
  const chooseable = entries.filter(canSelect).map((e) => e.id);
  const allIn = chooseable.length > 0 && chooseable.every((id) => sel.has(id));
  const next = new Set(sel);
  for (const id of chooseable) { if (allIn) next.delete(id); else next.add(id); }
  return next;
}

export const selectRecommended = (sel: Selection, entries: readonly LibraryEntryView[]): Selection => {
  const next = new Set(sel);
  for (const e of entries) if (e.recommended && canSelect(e)) next.add(e.id);
  return next;
};

/** Keeps only what is still on offer, so a changed filter never leaves a hidden selection behind. */
export const pruneSelection = (sel: Selection, entries: readonly LibraryEntryView[]): Selection => {
  const shown = new Set(entries.filter(canSelect).map((e) => e.id));
  return new Set([...sel].filter((id) => shown.has(id)));
};

export const queryFor = (f: LibraryFilters, projectId?: string) => ({
  ...(projectId ? { projectId, includeAdopted: true } : {}),
  ...(f.sectors.length ? { sectors: f.sectors } : {}), ...(f.text.trim() ? { text: f.text.trim() } : {}),
  ...(f.levels.length ? { levels: f.levels } : {}), ...(f.kinds.length ? { kinds: f.kinds } : {}),
  ...(f.reviewedOnly ? { reviewedOnly: true } : {}), ...(f.recommendedOnly ? { recommendedOnly: true } : {}), ...(f.withStandard ? { withStandard: true } : {}),
});

/** A change of one filter, leaving the others as they are. */
export const withFilter = <K extends keyof LibraryFilters>(f: LibraryFilters, key: K, value: LibraryFilters[K]): LibraryFilters => ({ ...f, [key]: value });

export const toggleIn = <T>(list: readonly T[], value: T): T[] => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

/** Whether any of the entries shown has not been reviewed, so the note about unreviewed content is shown only when it is true. */
export const hasUnreviewed = (entries: readonly LibraryEntryView[]): boolean => entries.some((e) => e.review.status !== "REVIEWED");

/** The words for a numeric standard's state of checking. */
export const standardIsVerified = (e: LibraryEntryView): boolean => Boolean(e.referenceStandard?.verified);
