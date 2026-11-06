import type { OfflinePack, PackStore } from "../domain/offline-pack.ts";

const STORE = "packs";
const DB = "donordesk-offline-packs";

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

/** Offline packs on this device. Keyed by project; each pack carries the user who downloaded it, and sign-out clears them all. */
export function createIndexedDbPackStore(factory: IDBFactory): PackStore {
  let db: Promise<IDBDatabase> | null = null;
  const connection = () =>
    (db ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = factory.open(DB, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "projectId" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("Could not open the offline packs"));
    }));
  const tx = async (mode: IDBTransactionMode) => (await connection()).transaction(STORE, mode).objectStore(STORE);
  return {
    async list() { return (await request((await tx("readonly")).getAll())) as OfflinePack[]; },
    async put(pack) { await request((await tx("readwrite")).put(pack)); },
    async remove(projectId) { await request((await tx("readwrite")).delete(projectId)); },
    async clear() { await request((await tx("readwrite")).clear()); },
  };
}

/** Removes every pack and the remembered identity from this device. Safe to call anywhere, any time. */
export async function wipeOfflinePacks(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try { await createIndexedDbPackStore(indexedDB).clear(); } catch { /* nothing stored, or storage unavailable */ }
  try { localStorage.removeItem("donordesk-field-user"); } catch { /* storage unavailable */ }
}
