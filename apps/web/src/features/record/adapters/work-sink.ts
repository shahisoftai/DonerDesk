/**
 * Writes the plan steps of "What happened?" (Phase 44): complete a planned item in one call, or change its status now or later. The
 * server calls and the outbox are passed in. A refusal is shown as it is and never queued; only "no connection" is kept for later,
 * and only for a status step (the one-call completion has no outbox sender, so it says it needs signal).
 */
import type { AppError } from "../../../lib/shared/app-error.ts";
import type { Result } from "../../../lib/shared/result.ts";
import { isOfflineFailure } from "../../../lib/shared/connectivity.ts";
import { planStatusEntry } from "../../offline/domain/plan-status-outbox.ts";
import type { OutboxEntry } from "../../offline/domain/outbox.ts";
import type { WorkSink } from "../ports/record-sink.ts";

export interface WorkSinkDeps {
  complete(itemId: string, input: Record<string, unknown>): Promise<Result<{ activityId: string }, AppError>>;
  changeStatus(itemId: string, input: Record<string, unknown>): Promise<Result<true, AppError>>;
  enqueue(entry: OutboxEntry): Promise<void>;
  canQueue: boolean;
  newId(): string;
  now(): number;
}

export const NEEDS_SIGNAL_MESSAGE = "Marking this done in one step needs a signal. Add the details instead and it is kept on this phone.";
export const NOTHING_KEPT_MESSAGE = "You are offline and this device cannot keep the change. Try again when you have signal.";

export function createWorkSink(deps: WorkSinkDeps): WorkSink {
  return {
    async completePlanned(input) {
      const body = { finishedOn: input.finishedOn, ...(input.people?.trim() ? { people: input.people.trim() } : {}), ...(input.note?.trim() ? { note: input.note.trim() } : {}) };
      const r = await deps.complete(input.itemId, body);
      if (r.ok) return { ok: true as const, value: { activityId: r.value.activityId } };
      return { ok: false as const, message: isOfflineFailure(r.error) ? NEEDS_SIGNAL_MESSAGE : r.error.message };
    },
    async changeStatus(input) {
      const body = { action: input.action, ...(input.reason?.trim() ? { reason: input.reason.trim() } : {}), ...(input.completedOn ? { completedOn: input.completedOn } : {}) };
      const r = await deps.changeStatus(input.itemId, body);
      if (r.ok) return { ok: true as const, value: { queued: false } };
      if (!isOfflineFailure(r.error)) return { ok: false as const, message: r.error.message };
      if (!deps.canQueue) return { ok: false as const, message: NOTHING_KEPT_MESSAGE };
      await deps.enqueue(planStatusEntry({
        id: deps.newId(), title: input.title, now: deps.now(),
        payload: { itemId: input.itemId, action: input.action, ...(input.reason?.trim() ? { reason: input.reason.trim() } : {}), ...(input.completedOn ? { completedOn: input.completedOn } : {}) },
      }));
      return { ok: true as const, value: { queued: true } };
    },
  };
}
