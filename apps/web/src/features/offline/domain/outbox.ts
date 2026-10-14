/**
 * The outbox: things a person finished while offline, kept on their device and sent when the connection returns.
 * This module is the rules only - what an entry is, what "sending" may answer, and how a flush behaves - with the
 * storage and the actual network call passed in, so it runs the same in a browser, a test or a different store.
 */

export type OutboxState = "waiting" | "needs-attention";

/** Anything the outbox carries. `payload` is opaque here; the sender for the entry's `kind` knows its shape. */
export interface OutboxEntry<P = unknown> {
  /** Also the idempotency key of the create, so a send that is repeated can never create twice. */
  id: string;
  kind: string;
  /** A short human title for the banner ("Hygiene session"). */
  title: string;
  payload: P;
  createdAt: number;
  attempts: number;
  state: OutboxState;
  lastError?: string;
}

export interface OutboxStore {
  list(): Promise<OutboxEntry[]>;
  put(entry: OutboxEntry): Promise<void>;
  remove(id: string): Promise<void>;
}

/** What one attempt to send an entry came to. */
export type SendOutcome =
  | { kind: "sent" }
  /** No connection (or the server is down): keep the entry and stop, the rest would fail the same way. */
  | { kind: "offline"; message: string }
  /** The server refused it: retrying unchanged cannot help, so a person must look. */
  | { kind: "rejected"; message: string };

/**
 * Sends one entry. `save` persists progress made on the way (the activity is created but two of its photos are not
 * uploaded yet), so a retry resumes instead of repeating.
 */
export type OutboxSender = (entry: OutboxEntry, save: (patch: Partial<OutboxEntry>) => Promise<void>) => Promise<SendOutcome>;

export interface FlushSummary {
  sent: number;
  /** Entries still waiting to be sent. */
  waiting: number;
  needsAttention: number;
  /** True when the flush stopped because there is no connection. */
  offline: boolean;
}

const oldestFirst = (a: OutboxEntry, b: OutboxEntry) => a.createdAt - b.createdAt;

export function summarise(entries: ReadonlyArray<OutboxEntry>): Pick<FlushSummary, "waiting" | "needsAttention"> {
  return {
    waiting: entries.filter((e) => e.state === "waiting").length,
    needsAttention: entries.filter((e) => e.state === "needs-attention").length,
  };
}

/**
 * Sends the waiting entries, oldest first. Stops at the first "offline" answer; an entry the server refuses is parked as
 * "needs-attention" with the reason and the rest carry on. Entries that need attention are never retried by themselves.
 */
export async function flushOutbox(store: OutboxStore, send: OutboxSender): Promise<FlushSummary> {
  let sent = 0;
  let offline = false;
  const entries = (await store.list()).filter((e) => e.state === "waiting").sort(oldestFirst);
  for (const original of entries) {
    let current = original;
    const save = async (patch: Partial<OutboxEntry>) => {
      current = { ...current, ...patch };
      await store.put(current);
    };
    let outcome: SendOutcome;
    try {
      outcome = await send(current, save);
    } catch (e) {
      outcome = { kind: "offline", message: e instanceof Error ? e.message : "The send was interrupted." };
    }
    if (outcome.kind === "sent") {
      await store.remove(current.id);
      sent += 1;
    } else if (outcome.kind === "offline") {
      await store.put({ ...current, attempts: current.attempts + 1, lastError: outcome.message });
      offline = true;
      break;
    } else {
      await store.put({ ...current, attempts: current.attempts + 1, state: "needs-attention", lastError: outcome.message });
    }
  }
  return { sent, ...summarise(await store.list()), offline };
}

/** Puts a parked entry back in the queue (after a person fixed what the server complained about, or simply to try again). */
export async function retryEntry(store: OutboxStore, id: string): Promise<void> {
  const entry = (await store.list()).find((e) => e.id === id);
  if (entry) await store.put({ ...entry, state: "waiting" });
}

/** A flush that never overlaps itself: a second call while one runs waits for that one and shares its result. */
export function createSerialFlusher(store: OutboxStore, send: OutboxSender): () => Promise<FlushSummary> {
  let running: Promise<FlushSummary> | null = null;
  return () => {
    running ??= flushOutbox(store, send).finally(() => {
      running = null;
    });
    return running;
  };
}

/** A store that lives in memory: the test double, and the fallback where the browser has no durable storage. */
export function createMemoryOutboxStore(): OutboxStore {
  const entries = new Map<string, OutboxEntry>();
  return {
    list: async () => [...entries.values()].map((e) => ({ ...e })),
    put: async (entry) => void entries.set(entry.id, { ...entry }),
    remove: async (id) => void entries.delete(id),
  };
}
