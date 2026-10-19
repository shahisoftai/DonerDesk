"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createActivityAction } from "@/lib/actions/activities";
import { uploadEvidenceAction } from "@/lib/actions/evidence";
import { guardNetwork } from "@/lib/shared/connectivity";
import { createActivitySender } from "../domain/activity-outbox";
import { ACTIVITY_KIND } from "../domain/activity-outbox";
import { PLAN_STATUS_KIND, createPlanStatusSender } from "../domain/plan-status-outbox";
import { PROGRESS_LOG_KIND, createProgressSender } from "../domain/progress-outbox";
import { changePlanStatusAction, saveProgressAction } from "@/lib/actions/workplan";
import { createMemoryOutboxStore, createSerialFlusher, retryEntry, summarise, type OutboxEntry, type OutboxSender, type OutboxStore } from "../domain/outbox";
import { canUseDurableOutbox, createIndexedDbOutboxStore } from "../infrastructure/indexeddb-outbox-store";

export interface OutboxApi {
  /** False where nothing can be kept on the device; callers then behave exactly as before (no offline saving). */
  supported: boolean;
  entries: OutboxEntry[];
  online: boolean;
  sending: boolean;
  enqueue(entry: OutboxEntry): Promise<void>;
  sendNow(): Promise<void>;
  retry(id: string): Promise<void>;
  discard(id: string): Promise<void>;
}

const NOOP: OutboxApi = {
  supported: false,
  entries: [],
  online: true,
  sending: false,
  enqueue: async () => undefined,
  sendNow: async () => undefined,
  retry: async () => undefined,
  discard: async () => undefined,
};

const OutboxContext = createContext<OutboxApi>(NOOP);

export function useOutbox(): OutboxApi {
  return useContext(OutboxContext);
}

const RETRY_EVERY_MS = 60_000;

/**
 * Keeps what was finished offline on this device and sends it when the connection returns: on opening the app, when the
 * browser reports it is back online, and once a minute while something waits. `scope` is the signed-in user.
 */
export function OutboxProvider({ scope, children }: { scope: string; children: ReactNode }) {
  const supported = canUseDurableOutbox();
  const store = useMemo<OutboxStore>(
    () => (supported ? createIndexedDbOutboxStore(indexedDB, scope) : createMemoryOutboxStore()),
    [supported, scope],
  );
  const flush = useMemo(() => {
    const senders: Record<string, OutboxSender> = {
      [ACTIVITY_KIND]: createActivitySender({
        createActivity: (input, options) => guardNetwork(() => createActivityAction(input, options)),
        uploadEvidence: (form) => guardNetwork(() => uploadEvidenceAction(form)),
      }),
      [PROGRESS_LOG_KIND]: createProgressSender({ save: (itemId, input) => guardNetwork(() => saveProgressAction(itemId, input)) }),
      [PLAN_STATUS_KIND]: createPlanStatusSender({ changeStatus: (itemId, input) => guardNetwork(() => changePlanStatusAction(itemId, input)) }),
    };
    const send: OutboxSender = (entry, save) =>
      senders[entry.kind]?.(entry, save) ?? Promise.resolve({ kind: "rejected" as const, message: "This kind of saved record is no longer supported." });
    return createSerialFlusher(store, send);
  }, [store]);

  const [entries, setEntries] = useState<OutboxEntry[]>([]);
  const [online, setOnline] = useState(true);
  const [sending, setSending] = useState(false);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    const list = await store.list().catch(() => []);
    if (alive.current) setEntries(list);
  }, [store]);

  const sendNow = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    setSending(true);
    try {
      await flush();
    } finally {
      if (alive.current) setSending(false);
      await refresh();
    }
  }, [flush, refresh]);

  useEffect(() => {
    alive.current = true;
    setOnline(navigator.onLine);
    void refresh().then(() => sendNow());
    const goOnline = () => {
      setOnline(true);
      void sendNow();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      alive.current = false;
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [refresh, sendNow]);

  const waiting = summarise(entries).waiting;
  useEffect(() => {
    if (waiting === 0) return;
    const timer = setInterval(() => void sendNow(), RETRY_EVERY_MS);
    return () => clearInterval(timer);
  }, [waiting, sendNow]);

  const api = useMemo<OutboxApi>(
    () => ({
      supported,
      entries,
      online,
      sending,
      enqueue: async (entry) => {
        await store.put(entry);
        await refresh();
      },
      sendNow,
      retry: async (id) => {
        await retryEntry(store, id);
        await refresh();
        await sendNow();
      },
      discard: async (id) => {
        await store.remove(id);
        await refresh();
      },
    }),
    [supported, entries, online, sending, store, refresh, sendNow],
  );

  return <OutboxContext.Provider value={api}>{children}</OutboxContext.Provider>;
}
