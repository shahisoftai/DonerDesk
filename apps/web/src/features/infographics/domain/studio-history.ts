/**
 * Undo and redo for the Studio (Phase 32.2): a plain value history. Typing in one field is one
 * step, not one per keystroke: edits with the same `key` that follow each other closely merge.
 * Pure: the caller passes the time, so it is tested without a clock.
 */
export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  lastKey?: string;
  lastAt?: number;
}

const LIMIT = 100;
const MERGE_WITHIN_MS = 900;

export const createHistory = <T,>(initial: T): History<T> => ({ past: [], present: initial, future: [] });

export function pushState<T>(history: History<T>, next: T, now: number, key?: string): History<T> {
  if (Object.is(next, history.present)) return history;
  const merge = key !== undefined && history.lastKey === key && history.lastAt !== undefined && now - history.lastAt < MERGE_WITHIN_MS;
  const past = merge ? history.past : [...history.past, history.present].slice(-LIMIT);
  return { past, present: next, future: [], ...(key !== undefined ? { lastKey: key } : {}), lastAt: now };
}

export function undo<T>(history: History<T>): History<T> {
  const previous = history.past[history.past.length - 1];
  if (history.past.length === 0 || previous === undefined) return history;
  return { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] };
}

export function redo<T>(history: History<T>): History<T> {
  const [next, ...rest] = history.future;
  if (next === undefined) return history;
  return { past: [...history.past, history.present], present: next, future: rest };
}

export const canUndo = <T,>(history: History<T>): boolean => history.past.length > 0;
export const canRedo = <T,>(history: History<T>): boolean => history.future.length > 0;

/** The saved state is the one a design was last saved in; `isDirty` compares by reference to it. */
export const isDirty = <T,>(history: History<T>, saved: T): boolean => !Object.is(history.present, saved);
