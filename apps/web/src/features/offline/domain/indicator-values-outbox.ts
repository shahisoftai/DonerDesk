import type { Result } from "../../../lib/shared/result.ts";
import type { AppError } from "../../../lib/shared/app-error.ts";
import type { OutboxEntry, OutboxSender, SendOutcome } from "./outbox.ts";

export const INDICATOR_VALUES_KIND = "indicator-values";

/** One bulk save of entry-sheet rows made while offline: the rows exactly as the form's save would send them. */
export interface IndicatorValuesOutboxPayload {
  periodId: string;
  rows: Array<Record<string, unknown>>;
}

export function indicatorValuesEntry(input: { id: string; title: string; payload: IndicatorValuesOutboxPayload; now: number }): OutboxEntry<IndicatorValuesOutboxPayload> {
  return { id: input.id, kind: INDICATOR_VALUES_KIND, title: input.title, payload: input.payload, createdAt: input.now, attempts: 0, state: "waiting" };
}

export interface IndicatorValuesSendDeps {
  bulkSave(periodId: string, rows: Array<Record<string, unknown>>): Promise<Result<unknown, AppError>>;
}

/**
 * Sends one queued save. No connection keeps it waiting. A save the server refuses (someone else changed a row in the meantime, a
 * value that cannot be right, a closed entry window) is parked with the reason for a person to look at, never retried by itself: the
 * version each row was saved against travels with it, so an older save can never overwrite a newer one.
 */
export function createIndicatorValuesSender(deps: IndicatorValuesSendDeps): OutboxSender {
  return async (entry): Promise<SendOutcome> => {
    const { periodId, rows } = entry.payload as IndicatorValuesOutboxPayload;
    const result = await deps.bulkSave(periodId, rows);
    if (result.ok) return { kind: "sent" };
    return result.error.kind === "unavailable" ? { kind: "offline", message: result.error.message } : { kind: "rejected", message: result.error.message };
  };
}
