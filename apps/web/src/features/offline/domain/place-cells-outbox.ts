import type { Result } from "../../../lib/shared/result.ts";
import type { AppError } from "../../../lib/shared/app-error.ts";
import type { OutboxEntry, OutboxSender, SendOutcome } from "./outbox.ts";

export const PLACE_CELLS_KIND = "place-cells";

/**
 * Figures typed at one place while offline (Phase 57): the cells exactly as the place-first form would send them. Each cell carries the
 * figure the person saw (`expected`), so a cell someone else changed meanwhile is refused instead of overwritten.
 */
export interface PlaceCellsOutboxPayload {
  projectId: string;
  periodId: string;
  cells: Array<{ indicatorId: string; placeId: string; value: string; splits?: Array<{ dimension: string; category: string; value: string }>; expected?: string }>;
}

export function placeCellsEntry(input: { id: string; title: string; payload: PlaceCellsOutboxPayload; now: number }): OutboxEntry<PlaceCellsOutboxPayload> {
  return { id: input.id, kind: PLACE_CELLS_KIND, title: input.title, payload: input.payload, createdAt: input.now, attempts: 0, state: "waiting" };
}

export interface PlaceCellsSendDeps {
  save(projectId: string, input: { periodId: string; cells: PlaceCellsOutboxPayload["cells"] }): Promise<Result<unknown, AppError>>;
}

/** No connection keeps it waiting; a refusal (a locked period, a cell changed by someone else) is parked with the reason, never retried by itself. */
export function createPlaceCellsSender(deps: PlaceCellsSendDeps): OutboxSender {
  return async (entry): Promise<SendOutcome> => {
    const { projectId, periodId, cells } = entry.payload as PlaceCellsOutboxPayload;
    const result = await deps.save(projectId, { periodId, cells });
    if (result.ok) return { kind: "sent" };
    return result.error.kind === "unavailable" ? { kind: "offline", message: result.error.message } : { kind: "rejected", message: result.error.message };
  };
}
