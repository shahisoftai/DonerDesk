import type { Result } from "../../../lib/shared/result.ts";
import type { AppError } from "../../../lib/shared/app-error.ts";
import type { OutboxEntry, OutboxSender, SendOutcome } from "./outbox.ts";

export const PLAN_STATUS_KIND = "plan-status";

/** One status change made on a planned activity while offline ("Under way", "Done"). */
export interface PlanStatusOutboxPayload {
  itemId: string;
  action: "START" | "COMPLETE" | "REOPEN" | "CANCEL" | "RESTORE";
  reason?: string;
  /** The day a "Done" was made on this device (YYYY-MM-DD), so a change sent later is still dated to when the work finished. */
  completedOn?: string;
}

export function planStatusEntry(input: { id: string; title: string; payload: PlanStatusOutboxPayload; now: number }): OutboxEntry<PlanStatusOutboxPayload> {
  return { id: input.id, kind: PLAN_STATUS_KIND, title: input.title, payload: input.payload, createdAt: input.now, attempts: 0, state: "waiting" };
}

export interface PlanStatusSendDeps {
  changeStatus(itemId: string, input: { action: PlanStatusOutboxPayload["action"]; reason?: string; completedOn?: string }): Promise<Result<true, AppError>>;
}

/**
 * Sends one queued status change. No connection keeps it waiting. A change the server now refuses (someone else moved the
 * activity on in the meantime) is parked with the reason for a person to look at, never retried by itself.
 */
export function createPlanStatusSender(deps: PlanStatusSendDeps): OutboxSender {
  return async (entry): Promise<SendOutcome> => {
    const { itemId, action, reason, completedOn } = entry.payload as PlanStatusOutboxPayload;
    const result = await deps.changeStatus(itemId, { action, ...(reason ? { reason } : {}), ...(completedOn ? { completedOn } : {}) });
    if (result.ok) return { kind: "sent" };
    return result.error.kind === "unavailable" ? { kind: "offline", message: result.error.message } : { kind: "rejected", message: result.error.message };
  };
}
