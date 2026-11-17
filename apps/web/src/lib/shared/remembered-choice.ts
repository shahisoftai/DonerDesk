/**
 * A choice remembered on this device (Phase 59): the last filter, tab or option a person used on a list. Pure, over a small store
 * interface so a test (or a private window with no storage) can stand in for `localStorage`. A value that is no longer allowed is
 * ignored, storage that throws remembers nothing, and the key carries the person so one person's choice never reaches another.
 */
export interface ChoiceStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export const choiceKey = (userId: string, scope: string): string => `dd-choice:${userId}:${scope}`;

export function readChoice(store: ChoiceStore | null, key: string, allowed: (value: string) => boolean): string | null {
  try {
    const raw = store?.getItem(key);
    return raw && allowed(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeChoice(store: ChoiceStore | null, key: string, value: string | null): void {
  try {
    if (value === null || value === "") store?.removeItem?.(key);
    else store?.setItem(key, value);
  } catch {
    /* nothing to remember with */
  }
}
