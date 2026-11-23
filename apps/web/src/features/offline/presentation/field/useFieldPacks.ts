"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { downloadOfflinePackAction, listFieldProjectsAction } from "@/lib/actions/offline";
import { createMemoryPackStore, packsFor, type OfflinePack } from "../../domain/offline-pack";
import { canUseDurableOutbox } from "../../infrastructure/indexeddb-outbox-store";
import { createIndexedDbPackStore } from "../../infrastructure/indexeddb-pack-store";

export const IDENTITY_KEY = "donordesk-field-user";
const A_DAY = 86_400_000;

export type GetWorkResult = "READY" | "NOTHING" | "FAILED";

/**
 * The work downloaded to this phone, for the signed-in person: read from the phone's storage, fetched all at once with one tap
 * (every project they are on, no project picker), and refreshed quietly once a day when there is signal. Nothing here is shown to
 * anyone else: the packs belong to the person who downloaded them.
 */
export function useFieldPacks(userId: string, onUser: (id: string) => void, online: boolean) {
  const store = useMemo(() => (canUseDurableOutbox() ? createIndexedDbPackStore(indexedDB) : createMemoryPackStore()), []);
  const [packs, setPacks] = useState<OfflinePack[] | null>(null);
  const [busy, setBusy] = useState(false);
  const refreshedOnce = useRef(false);

  const load = useCallback(async (forUser: string) => setPacks(packsFor(await store.list().catch(() => []), forUser)), [store]);
  useEffect(() => { void load(userId); }, [load, userId]);

  const getWork = useCallback(async (): Promise<GetWorkResult> => {
    setBusy(true);
    try {
      const listed = await listFieldProjectsAction();
      if (!listed.ok) return "FAILED";
      let who = userId;
      if (listed.value.userId && listed.value.userId !== userId) { who = listed.value.userId; onUser(who); }
      if (listed.value.projects.length === 0) return "NOTHING";
      let got = 0;
      for (const project of listed.value.projects) {
        const made = await downloadOfflinePackAction(project.id, project.name);
        if (!made.ok) continue;
        await store.put(made.value);
        got += 1;
        who = made.value.userId;
        try { localStorage.setItem(IDENTITY_KEY, who); } catch { /* the work still opens this visit */ }
      }
      if (who !== userId) onUser(who);
      await load(who);
      return got > 0 ? "READY" : "FAILED";
    } catch { return "FAILED"; } finally { setBusy(false); }
  }, [load, onUser, store, userId]);

  // Quietly bring the work up to date once, when the phone has signal and what it holds is more than a day old.
  useEffect(() => {
    if (!online || !packs || packs.length === 0 || refreshedOnce.current) return;
    if (packs.some((p) => Date.now() - p.generatedAt > A_DAY)) { refreshedOnce.current = true; void getWork(); }
  }, [online, packs, getWork]);

  return { packs, busy, getWork };
}
