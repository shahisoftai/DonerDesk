/**
 * Which rows of a long list are open (Phase 59). Pure: no React, no storage. A list starts closed so the page stays short; the first
 * row that still needs something opens so the person is taken to it, and a row the person just added opens. A bulk arrival
 * (a document re-read, "Confirm all") opens nothing, so a document that fills a hundred rows never opens a hundred cards.
 */
export const MAX_AUTO_OPEN = 1;

export interface ExpandInput { id: string; attention: boolean }
export interface ExpandState { open: ReadonlySet<string>; seen: ReadonlySet<string> }

export function initialExpand(items: readonly ExpandInput[]): ExpandState {
  const first = items.filter((i) => i.attention).slice(0, MAX_AUTO_OPEN).map((i) => i.id);
  return { open: new Set(first), seen: new Set(items.map((i) => i.id)) };
}

/**
 * Brings the state in step with the items now shown: forgets rows that are gone, and opens a newly added row when exactly one
 * arrived. Returns the same object when nothing changed, so an effect that calls it never loops.
 */
export function reconcileExpand(state: ExpandState, items: readonly ExpandInput[]): ExpandState {
  const ids = new Set(items.map((i) => i.id));
  const added = items.filter((i) => !state.seen.has(i.id)).map((i) => i.id);
  const gone = [...state.seen].filter((id) => !ids.has(id));
  if (added.length === 0 && gone.length === 0) return state;
  const open = new Set([...state.open].filter((id) => ids.has(id)));
  if (added.length > 0 && added.length <= MAX_AUTO_OPEN) for (const id of added) open.add(id);
  return { open, seen: ids };
}

export function toggleExpand(state: ExpandState, id: string): ExpandState {
  const open = new Set(state.open);
  if (open.has(id)) open.delete(id); else open.add(id);
  return { ...state, open };
}

export const expandAll = (state: ExpandState, items: readonly ExpandInput[]): ExpandState => ({ ...state, open: new Set(items.map((i) => i.id)) });
export const collapseAll = (state: ExpandState): ExpandState => ({ ...state, open: new Set() });
