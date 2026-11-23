import type { DraftStore, StoredDraft } from "../ports/draft-store";
import { createMemoryDraftStore } from "./memory-draft-store";

const DB = "donordesk-assessment-drafts";
const STORE = "drafts";

const request = <T,>(req: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed")); });

/**
 * Drafts kept on this phone, per signed-in person, so a long assessment survives no connection and a closed browser. Sign-out clears them
 * (`wipeAssessmentDrafts`), like the offline packs: on a shared phone they would be the previous person's.
 */
export function createIndexedDbDraftStore(factory: IDBFactory, userId: string): DraftStore {
  let db: Promise<IDBDatabase> | null = null;
  const connection = () => (db ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = factory.open(DB, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Could not open the drafts"));
  }));
  const tx = async (mode: IDBTransactionMode) => (await connection()).transaction(STORE, mode).objectStore(STORE);
  const key = (formId: string, placeKey: string) => `${userId}|${formId}|${placeKey}`;
  return {
    async load(formId, placeKey) { return ((await request((await tx("readonly")).get(key(formId, placeKey)))) as StoredDraft | undefined) ?? null; },
    async save(formId, placeKey, draft) {
      // The phone is the only writer of its own drafts, so there is no other copy to conflict with.
      const updatedAt = new Date().toISOString();
      try { await request((await tx("readwrite")).put({ ...draft, updatedAt }, key(formId, placeKey))); return { ok: true, updatedAt }; }
      catch { return { ok: false, reason: "ERROR", message: "This phone could not keep the draft." }; }
    },
    async remove(formId, placeKey) { try { await request((await tx("readwrite")).delete(key(formId, placeKey))); } catch { /* nothing stored */ } },
  };
}

/** The store for this phone, or an in-memory one where IndexedDB is missing (the draft then lasts only while the page is open). */
export function deviceDraftStore(userId: string): DraftStore {
  return typeof indexedDB === "undefined" ? createMemoryDraftStore() : createIndexedDbDraftStore(indexedDB, userId);
}

/** Removes every draft from this device. Safe to call anywhere, any time. */
export async function wipeAssessmentDrafts(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    await new Promise<void>((resolve) => { const r = indexedDB.deleteDatabase(DB); r.onsuccess = () => resolve(); r.onerror = () => resolve(); r.onblocked = () => resolve(); });
  } catch { /* storage unavailable */ }
}
