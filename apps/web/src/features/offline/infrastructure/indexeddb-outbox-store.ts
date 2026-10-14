import type { OutboxEntry, OutboxStore } from "../domain/outbox.ts";

const STORE = "entries";

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

function open(factory: IDBFactory, name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(name, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Could not open the outbox"));
  });
}

/**
 * The durable outbox: IndexedDB keeps files (photos) as they are, which localStorage cannot. One database per signed-in
 * user, so on a shared phone one person's saved records are never sent under another person's login.
 */
export function createIndexedDbOutboxStore(factory: IDBFactory, scope: string): OutboxStore {
  const name = `donordesk-outbox-${scope}`;
  let db: Promise<IDBDatabase> | null = null;
  const connection = () => (db ??= open(factory, name));
  const tx = async (mode: IDBTransactionMode) => (await connection()).transaction(STORE, mode).objectStore(STORE);
  return {
    async list() {
      return (await request((await tx("readonly")).getAll())) as OutboxEntry[];
    },
    async put(entry) {
      await request((await tx("readwrite")).put(entry));
    },
    async remove(id) {
      await request((await tx("readwrite")).delete(id));
    },
  };
}

/** True where the browser can keep the outbox durably (a private window or an old browser may not). */
export function canUseDurableOutbox(): boolean {
  return typeof indexedDB !== "undefined";
}
