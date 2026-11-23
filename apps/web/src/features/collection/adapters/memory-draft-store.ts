import type { DraftStore, StoredDraft } from "../ports/draft-store";

/** The in-memory store: the test double, and the fallback where the browser has no durable storage. */
export function createMemoryDraftStore(now: () => Date = () => new Date()): DraftStore {
  const drafts = new Map<string, StoredDraft>();
  const key = (formId: string, placeKey: string) => `${formId}|${placeKey}`;
  return {
    async load(formId, placeKey) { return drafts.get(key(formId, placeKey)) ?? null; },
    async save(formId, placeKey, draft, expected) {
      const stored = drafts.get(key(formId, placeKey));
      if (stored && expected !== stored.updatedAt) return { ok: false, reason: "CONFLICT", message: "This draft was saved somewhere else since you opened it." };
      const updatedAt = now().toISOString();
      drafts.set(key(formId, placeKey), { ...draft, updatedAt });
      return { ok: true, updatedAt };
    },
    async remove(formId, placeKey) { drafts.delete(key(formId, placeKey)); },
  };
}
