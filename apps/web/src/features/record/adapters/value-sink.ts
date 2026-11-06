/**
 * Saves a number: to the server when there is a connection, to the phone's outbox when there is not (Phase 44). This is the logic the
 * Quick entry form carried inside itself, moved out so every place that records a number saves it the same way. The server call and
 * the outbox are passed in; a refusal from the server is shown as it is and never queued, because sending it again cannot help.
 */
import type { AppError } from "../../../lib/shared/app-error.ts";
import type { Result } from "../../../lib/shared/result.ts";
import { isOfflineFailure } from "../../../lib/shared/connectivity.ts";
import type { QuickEntryResponse } from "../../../lib/server/schemas.ts";
import { indicatorValuesEntry } from "../../offline/domain/indicator-values-outbox.ts";
import type { OutboxEntry } from "../../offline/domain/outbox.ts";
import { offlineRow } from "../../reporting/domain/quick-entry-view.ts";
import type { ValueInput, ValueSink } from "../ports/record-sink.ts";

export interface ValueSinkDeps {
  /** The quick-entry call, already guarded so that no connection is an ordinary 'unavailable' answer. */
  send(payload: Record<string, unknown>): Promise<Result<QuickEntryResponse, AppError>>;
  enqueue(entry: OutboxEntry): Promise<void>;
  /** Without a durable outbox nothing can be kept, and an offline save says so instead of pretending. */
  canQueue: boolean;
  newId(): string;
  now(): number;
}

export const NOTHING_KEPT_MESSAGE = "You are offline and this device cannot keep the number. Try again when you have signal.";

export function createValueSink(deps: ValueSinkDeps): ValueSink {
  return {
    async saveValue(input: ValueInput) {
      const payload: Record<string, unknown> = {
        indicatorId: input.indicatorId,
        date: input.date,
        ...(input.namePeriod ? { reportingPeriodId: input.periodId } : {}),
        periodAchievement: input.value.trim(),
        ...(input.note?.trim() ? { comments: input.note.trim() } : {}),
        ...(input.source?.trim() ? { dataSource: input.source.trim() } : {}),
        ...(input.disaggregation && input.disaggregation.length > 0 ? { disaggregation: input.disaggregation.map((d) => ({ ...d })) } : {}),
      };
      const answer = await deps.send(payload);
      if (answer.ok) {
        return { ok: true as const, value: { queued: false, code: input.code, periodLabel: input.periodLabel, reportingPeriodId: answer.value.reportingPeriodId, notices: answer.value.notices } };
      }
      if (!isOfflineFailure(answer.error)) return { ok: false as const, message: answer.error.message };
      if (!deps.canQueue) return { ok: false as const, message: NOTHING_KEPT_MESSAGE };
      await deps.enqueue(
        indicatorValuesEntry({
          id: deps.newId(),
          title: `${input.code}: ${input.value.trim()}`,
          payload: { periodId: input.periodId, rows: [offlineRow({ indicatorId: input.indicatorId, value: input.value, ...(input.note ? { note: input.note } : {}), ...(input.source ? { source: input.source } : {}), ...(input.disaggregation ? { disaggregation: input.disaggregation } : {}) })] },
          now: deps.now(),
        }),
      );
      return { ok: true as const, value: { queued: true, code: input.code, periodLabel: input.periodLabel, reportingPeriodId: input.periodId, notices: [] } };
    },
  };
}
