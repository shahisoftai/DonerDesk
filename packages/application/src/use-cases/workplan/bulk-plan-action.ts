import { DomainError, addDays, err, ok, reasonRequired, toPlainDate, type PlannedActivity, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IClock } from "../../ports/core.js";
import type { IPlanContextReader, IPlannedActivityRepository } from "../../ports/workplan.js";
import { PlanAccess } from "../../services/plan-access.js";
import type { AssignPlannedActivityHandler, ChangePlanStatusHandler, ReschedulePlannedActivityHandler } from "./plan-handlers.js";

export type BulkPlanAction =
  | { kind: "SHIFT"; days: number }
  | { kind: "SET_LEAD"; leadUserId: string | null }
  | { kind: "SET_STATUS"; status: "START" | "COMPLETE" | "REOPEN" | "CANCEL" | "RESTORE" };

export interface BulkPlanRow { id: string; title: string; before: string; after: string }

const ACTION_NEEDS: Record<BulkPlanAction["kind"], "MOVE" | "ASSIGN" | "CHANGE_STATUS"> = { SHIFT: "MOVE", SET_LEAD: "ASSIGN", SET_STATUS: "CHANGE_STATUS" };

function previewOf(item: PlannedActivity, action: BulkPlanAction): BulkPlanRow {
  const s = item.snapshot();
  if (action.kind === "SHIFT") {
    const from = `${s.plannedStart} to ${s.plannedEnd}`;
    return { id: item.id, title: item.title, before: from, after: `${addDays(s.plannedStart, action.days)} to ${addDays(s.plannedEnd, action.days)}` };
  }
  if (action.kind === "SET_LEAD") return { id: item.id, title: item.title, before: s.ownerUserId ?? "No lead", after: action.leadUserId ?? "No lead" };
  return { id: item.id, title: item.title, before: s.status, after: action.status };
}

/**
 * Changes many planned activities at once: move them by N days, set their lead, or change their status. Everything is checked
 * first (permission for each, a reason where one is needed), so a refusal changes nothing. Without `apply` it only previews.
 * A shift moves each activity's own dates, and anything that waits for it moves too, as it does for a single move.
 */
export class BulkPlanActionHandler {
  constructor(
    private readonly access: PlanAccess, private readonly repo: IPlannedActivityRepository, private readonly context: IPlanContextReader,
    private readonly assign: AssignPlannedActivityHandler, private readonly reschedule: ReschedulePlannedActivityHandler,
    private readonly status: ChangePlanStatusHandler, private readonly clock: IClock,
  ) {}

  async handle(ctx: AuthenticatedContext, input: { ids: string[]; action: BulkPlanAction; reason?: string; apply: boolean }): Promise<Result<{ preview: BulkPlanRow[]; applied: number }, DomainError>> {
    const ids = [...new Set(input.ids)];
    if (ids.length === 0) return err(DomainError.validation("Choose at least one activity"));
    const items: PlannedActivity[] = [];
    for (const id of ids) {
      const loaded = await this.access.load(ctx, id, ACTION_NEEDS[input.action.kind]);
      if (!loaded.ok) return loaded;
      items.push(loaded.value);
    }
    const preview = items.map((i) => previewOf(i, input.action));
    if (!input.apply) return ok({ preview, applied: 0 });

    const reason = input.reason?.trim() || undefined;
    if (input.action.kind === "SET_STATUS" && input.action.status === "CANCEL" && !reason) return err(DomainError.validation("Say why these are being cancelled", { field: "reason" }));
    if (input.action.kind === "SHIFT") {
      const today = toPlainDate(this.clock.now())!;
      for (const item of items) {
        const s = item.snapshot();
        const used = await this.context.reportUsesDates(item.projectId, ctx.tenant.tenantId, { start: s.plannedStart, end: s.plannedEnd });
        if (!used.ok) return used;
        if (!reason && reasonRequired({ originalEnd: s.originalEnd }, today, { reportUsesIt: used.value })) {
          return err(DomainError.validation("Say why these activities are moving", { field: "reason" }));
        }
      }
    }

    let applied = 0;
    for (const id of ids) {
      const result = await this.applyOne(ctx, id, input.action, reason);
      if (!result.ok) return result;
      applied++;
    }
    return ok({ preview, applied });
  }

  private async applyOne(ctx: AuthenticatedContext, id: string, action: BulkPlanAction, reason: string | undefined): Promise<Result<unknown, DomainError>> {
    // Read again: an earlier move in this batch may already have moved this one through a dependency.
    const latest = await this.repo.findById(id, ctx.tenant.tenantId);
    if (!latest.ok) return latest;
    if (!latest.value) return err(DomainError.notFound("PlannedActivity", id));
    const s = latest.value.snapshot();
    if (action.kind === "SHIFT") {
      return this.reschedule.handle(ctx, id, {
        plannedStart: addDays(s.plannedStart, action.days), plannedEnd: addDays(s.plannedEnd, action.days), scope: "THIS", ...(reason ? { reason } : {}),
      });
    }
    if (action.kind === "SET_LEAD") {
      return this.assign.handle(ctx, id, { ownerUserId: action.leadUserId, supportUserIds: [...s.supportUserIds], scope: "THIS", ...(reason ? { reason } : {}) });
    }
    return this.status.handle(ctx, id, { action: action.status, ...(reason ? { reason } : {}) });
  }
}
