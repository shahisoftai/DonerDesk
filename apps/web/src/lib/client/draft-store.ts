/**
 * A browser-local draft of a form: saved while the person types, offered back after a reload or a lost connection,
 * dropped once the form is submitted. The storage is injected so tests (and private windows with no storage) work;
 * every storage failure means "no draft", never an error.
 */

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface StoredDraft<T> {
  value: T;
  savedAt: number;
}

export interface DraftStore<T> {
  load(): StoredDraft<T> | null;
  save(value: T): void;
  clear(): void;
}

export interface DraftStoreOptions<T> {
  key: string;
  /** Rebuilds a value from untrusted stored JSON; null when it is unusable. */
  parse(raw: unknown): T | null;
  /** False for a form nobody has typed in, so an empty form never leaves a draft behind. */
  hasContent(value: T): boolean;
  ttlMs?: number;
  now?: () => number;
}

export const DEFAULT_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export function createDraftStore<T>(storage: KeyValueStorage | null, options: DraftStoreOptions<T>): DraftStore<T> {
  const ttl = options.ttlMs ?? DEFAULT_DRAFT_TTL_MS;
  const now = options.now ?? Date.now;
  const safely = <R>(fn: () => R, fallback: R): R => {
    try {
      return fn();
    } catch {
      return fallback;
    }
  };
  return {
    load() {
      if (!storage) return null;
      return safely(() => {
        const text = storage.getItem(options.key);
        if (!text) return null;
        const raw = JSON.parse(text) as { savedAt?: unknown; value?: unknown } | null;
        const savedAt = typeof raw?.savedAt === "number" ? raw.savedAt : 0;
        const value = options.parse(raw?.value);
        if (value === null || now() - savedAt > ttl || !options.hasContent(value)) {
          storage.removeItem(options.key);
          return null;
        }
        return { value, savedAt };
      }, null);
    },
    save(value) {
      if (!storage) return;
      if (!options.hasContent(value)) {
        safely(() => storage.removeItem(options.key), undefined);
        return;
      }
      safely(() => storage.setItem(options.key, JSON.stringify({ value, savedAt: now() })), undefined);
    },
    clear() {
      if (!storage) return;
      safely(() => storage.removeItem(options.key), undefined);
    },
  };
}
