/**
 * Saves place-first cells (Phase 57): to the server when there is a connection, to the phone's outbox when there is not. A refusal from
 * the server (a closed period, a cell someone else changed) is shown as it is and never queued.
 */
import type { AppError } from "../../../lib/shared/app-error.ts";
import type { Result } from "../../../lib/shared/result.ts";
import { isOfflineFailure } from "../../../lib/shared/connectivity.ts";
import { placeCellsEntry, type PlaceCellsOutboxPayload } from "../../offline/domain/place-cells-outbox.ts";
import type { OutboxEntry } from "../../offline/domain/outbox.ts";
import type { PlaceCellSink } from "../ports/record-sink.ts";
import { NOTHING_KEPT_MESSAGE } from "./value-sink.ts";

export interface PlaceCellSinkDeps {
  send(projectId: string, input: { periodId: string; cells: PlaceCellsOutboxPayload["cells"] }): Promise<Result<{ notices: string[] }, AppError>>;
  enqueue(entry: OutboxEntry): Promise<void>;
  canQueue: boolean;
  newId(): string;
  now(): number;
}

export function createPlaceCellSink(deps: PlaceCellSinkDeps): PlaceCellSink {
  return {
    async saveCells(input) {
      const cells = input.cells.map((c) => ({ indicatorId: c.indicatorId, placeId: c.placeId, value: c.value, expected: c.expected, ...(c.splits ? { splits: c.splits.map((s) => ({ ...s })) } : {}) }));
      const answer = await deps.send(input.projectId, { periodId: input.periodId, cells });
      if (answer.ok) return { ok: true as const, value: { queued: false, notices: answer.value.notices } };
      if (!isOfflineFailure(answer.error)) return { ok: false as const, message: answer.error.message };
      if (!deps.canQueue) return { ok: false as const, message: NOTHING_KEPT_MESSAGE };
      await deps.enqueue(placeCellsEntry({ id: deps.newId(), title: input.title, payload: { projectId: input.projectId, periodId: input.periodId, cells }, now: deps.now() }));
      return { ok: true as const, value: { queued: true, notices: [] } };
    },
  };
}
