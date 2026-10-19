import { DomainError, err, isPlainDate, ok, type PlainDate, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IClock } from "../../ports/core.js";
import type { IPlannedActivityRepository, IProgressRepository } from "../../ports/workplan.js";
import { PlanAccess } from "../../services/plan-access.js";
import type { PlanRecorder } from "../../services/plan-recorder.js";
import type { SaveProgressHandler } from "./progress-handlers.js";

export interface MarkPlanDoneInput {
  /** The day the work finished (YYYY-MM-DD); defaults to today on the client. */
  finishedOn: PlainDate;
  /** People reached, typed; blank stays blank. */
  people: string;
  notes: string;
}

/**
 * One step: marks a planned activity done on the day it finished, and records the people reached in its activity-end log.
 * Replaces the two-step "complete, then remember to log" flow. The status change and the figure are saved in order; a refused
 * status change saves nothing.
 */
export class MarkPlanDoneHandler {
  constructor(
    private readonly access: PlanAccess, private readonly repo: IPlannedActivityRepository, private readonly recorder: PlanRecorder,
    private readonly progress: SaveProgressHandler, private readonly progressRows: IProgressRepository, private readonly clock: IClock,
  ) {}

  async handle(ctx: AuthenticatedContext, itemId: string, input: MarkPlanDoneInput): Promise<Result<void, DomainError>> {
    if (!isPlainDate(input.finishedOn)) return err(DomainError.validation("Choose the day it finished", { field: "finishedOn" }));
    const item = await this.access.load(ctx, itemId, "CHANGE_STATUS");
    if (!item.ok) return item;
    const at = new Date(`${input.finishedOn}T12:00:00.000Z`);
    const changed = item.value.applyStatus("COMPLETE", { at });
    if (!changed.ok) return changed;
    const saved = await this.repo.update(item.value);
    if (!saved.ok) return saved;
    const recorded = await this.recorder.record(ctx, item.value, changed.value, "workplan.status_changed");
    if (!recorded.ok) return recorded;
    const people = input.people.trim();
    const notes = input.notes.trim();
    if (people !== "" || notes !== "") {
      const rows = await this.progressRows.findByItem(itemId, ctx.tenant.tenantId);
      if (!rows.ok) return rows;
      const existing = rows.value.find((e) => e.kind === "END");
      const logged = await this.progress.handle(ctx, itemId, {
        kind: "END", key: "", values: { total: people, breakdowns: {}, sessions: "", unique: "" }, narrative: notes ? { notes } : {},
        ...(existing ? { replaceId: existing.id } : {}),
      });
      if (!logged.ok) return logged;
    }
    return ok(undefined);
  }
}
