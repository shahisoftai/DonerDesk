import { discardCollectionDraftAction, getCollectionDraftAction, saveCollectionDraftAction } from "@/lib/actions/assessments";
import type { DraftStore } from "../ports/draft-store";

/** The server's draft for the signed-in person: it follows them to another device. The place key is the facility id, "" for none. */
export function createServerDraftStore(): DraftStore {
  const place = (placeKey: string): string | undefined => placeKey || undefined;
  return {
    async load(formId, placeKey) {
      const r = await getCollectionDraftAction(formId, place(placeKey));
      return r.ok && r.value ? { answers: r.value.answers, how: r.value.how ?? {}, startedAt: r.value.startedAt, updatedAt: r.value.updatedAt } : null;
    },
    async save(formId, placeKey, draft, expected) {
      const r = await saveCollectionDraftAction(formId, { ...(place(placeKey) ? { placeId: place(placeKey) } : {}), answers: draft.answers, how: draft.how, startedAt: draft.startedAt, ...(expected ? { expectedUpdatedAt: expected } : {}) });
      if (r.ok) return { ok: true, updatedAt: r.value.updatedAt };
      const kind = r.error.kind;
      return { ok: false, reason: kind === "conflict" ? "CONFLICT" : kind === "unavailable" ? "OFFLINE" : "ERROR", message: r.error.message };
    },
    async remove(formId, placeKey) { await discardCollectionDraftAction(formId, place(placeKey)); },
  };
}
