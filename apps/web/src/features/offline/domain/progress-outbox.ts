import type { Result } from "../../../lib/shared/result.ts";
import type { AppError } from "../../../lib/shared/app-error.ts";
import type { OutboxEntry, OutboxSender, SendOutcome } from "./outbox.ts";

export const PROGRESS_LOG_KIND = "progress-log";

/** One progress entry (a day, week, month or the activity end) written while offline, exactly as the form would have sent it. */
export interface ProgressOutboxPayload {
  itemId: string;
  input: Record<string, unknown>;
}

export function progressEntry(input: { id: string; title: string; payload: ProgressOutboxPayload; now: number }): OutboxEntry<ProgressOutboxPayload> {
  return { id: input.id, kind: PROGRESS_LOG_KIND, title: input.title, payload: input.payload, createdAt: input.now, attempts: 0, state: "waiting" };
}

export interface ProgressSendDeps {
  save(itemId: string, input: Record<string, unknown>): Promise<Result<{ id: string; absorbed: number }, AppError>>;
}

/**
 * Sends one queued progress entry. No connection keeps it waiting. An entry the server now refuses (that day was logged from
 * another device, or the day now sits inside a monthly report) is parked with the reason for a person to look at, and is never
 * retried or merged by itself: two entries for one day would be counted twice.
 */
export function createProgressSender(deps: ProgressSendDeps): OutboxSender {
  return async (entry): Promise<SendOutcome> => {
    const { itemId, input } = entry.payload as ProgressOutboxPayload;
    const result = await deps.save(itemId, input);
    if (result.ok) return { kind: "sent" };
    return result.error.kind === "unavailable" ? { kind: "offline", message: result.error.message } : { kind: "rejected", message: result.error.message };
  };
}
