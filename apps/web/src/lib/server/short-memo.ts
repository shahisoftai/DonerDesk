import "server-only";

type Entry<T> = { expires: number; value: T };
const store = new Map<string, Entry<unknown>>();
const MAX_ENTRIES = 500;

/** Remembers a successful read for a short time per key (the key carries the session). A failed or `keep`-refused value is never stored. */
export async function shortMemo<T>(key: string, ttlMs: number, load: () => Promise<T>, keep: (value: T) => boolean): Promise<T> {
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await load();
  if (keep(value)) {
    if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value as string);
    store.set(key, { expires: Date.now() + ttlMs, value });
  }
  return value;
}
