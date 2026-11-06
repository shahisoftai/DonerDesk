/**
 * How a saved-on-this-phone record is described (Phase 44). One table, so the Waiting list, the banner and the confirmation use the
 * same words. Two rules come from the offline guidance this follows: having no signal is NOT an error (no state here is "danger"),
 * and sending is shown as progress with numbers, never as an endless spinner.
 */
import type { OutboxEntry } from "../../offline/domain/outbox.ts";

export type SyncStateKey = "WAITING" | "SENDING" | "SENT" | "NEEDS_YOU" | "OFFLINE_NOTE" | "READY" | "NOT_READY";
export type SyncTone = "neutral" | "progress" | "good" | "attention";

export interface SyncState {
  key: SyncStateKey;
  /** Catalogue key `record.sync.<KEY>`. */
  labelKey: `record.sync.${SyncStateKey}`;
  tone: SyncTone;
  /** An icon name, so the state is never colour alone. */
  icon: "clock" | "upload" | "check" | "hand" | "wifi-off" | "phone-check" | "download";
}

export const SYNC_STATES: Readonly<Record<SyncStateKey, SyncState>> = {
  WAITING: { key: "WAITING", labelKey: "record.sync.WAITING", tone: "neutral", icon: "clock" },
  SENDING: { key: "SENDING", labelKey: "record.sync.SENDING", tone: "progress", icon: "upload" },
  SENT: { key: "SENT", labelKey: "record.sync.SENT", tone: "good", icon: "check" },
  NEEDS_YOU: { key: "NEEDS_YOU", labelKey: "record.sync.NEEDS_YOU", tone: "attention", icon: "hand" },
  OFFLINE_NOTE: { key: "OFFLINE_NOTE", labelKey: "record.sync.OFFLINE_NOTE", tone: "neutral", icon: "wifi-off" },
  READY: { key: "READY", labelKey: "record.sync.READY", tone: "good", icon: "phone-check" },
  NOT_READY: { key: "NOT_READY", labelKey: "record.sync.NOT_READY", tone: "attention", icon: "download" },
};

/** The state of one queued record. `sendingId` is the entry being sent right now (the outbox sends one at a time, oldest first). */
export function stateOfEntry(entry: Pick<OutboxEntry, "id" | "state">, sendingId: string | null): SyncState {
  if (entry.state === "needs-attention") return SYNC_STATES.NEEDS_YOU;
  return entry.id === sendingId ? SYNC_STATES.SENDING : SYNC_STATES.WAITING;
}

/** "2 of 4" for a record that is part-way through its photos. Numbers only: the sentence around them is translated. */
export function progressOf(done: number, total: number): { done: number; total: number; percent: number } {
  const t = Math.max(0, Math.floor(total));
  const d = Math.min(Math.max(0, Math.floor(done)), t);
  return { done: d, total: t, percent: t === 0 ? 0 : Math.round((d / t) * 100) };
}

/** Records the person has to act on come first, then the one being sent, then the rest in the order they were made. */
export function waitingOrder<T extends Pick<OutboxEntry, "id" | "state" | "createdAt">>(entries: readonly T[], sendingId: string | null): T[] {
  const rank = (e: T) => (e.state === "needs-attention" ? 0 : e.id === sendingId ? 1 : 2);
  return [...entries].sort((a, b) => rank(a) - rank(b) || a.createdAt - b.createdAt);
}
