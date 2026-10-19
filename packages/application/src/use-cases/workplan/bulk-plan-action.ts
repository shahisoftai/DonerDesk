import { DomainError, addDays, err, ok, reasonRequired, toPlainDate, type PlainDate, type PlanItemAction, type PlannedActivity, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IClock } from "../../ports/core.js";
import type { IAssignPlan, IChangePlanStatus, IReschedulePlan } from "../../ports/plan-commands.js";
import type { IPlanContextReader, IPlannedActivityRepository } from "../../ports/workplan.js";
import { PlanAccess } from "../../services/plan-access.js";

export type BulkStatus = "START" | "COMPLETE" | "REOPEN" | "CANCEL" | "RESTORE";
export type BulkPlanAction =
  | { kind: "SHIFT"; days: number }
  | { kind: "SET_LEAD"; leadUserId: string | null }
  | { kind: "SET_STATUS"; status: BulkStatus };

export interface BulkPlanRow { id: string; title: string; before: string; after: string }
/** One step that puts an activity back as it was; an activity whose change cannot be reversed has none. */
export interface BulkUndoStep { id: string; action: BulkPlanAction }

type Snapshot = ReturnType<PlannedActivity["snapshot"]>;

/** What a strategy may use besides the activity: the other commands, the facts about reports, and today. */
interface BulkEnv {
  assign: IAssignPlan;
  reschedule: IReschedulePlan;
  status: IChangePlanStatus;
  context: IPlanContextReader;
  today: PlainDate;
}

/**
 * One kind of bulk change. The handler knows none of the kinds: it asks the strategy for the permission it needs, a preview, a
 * check before anything is saved, the change itself, and how to undo it. A new kind is a new entry in `BULK_STRATEGIES`.
 */
interface BulkStrategy<A extends BulkPlanAction> {
  needs: PlanItemAction;
  preview(snap: Snapshot, action: A): { before: string; after: string };
  /** Refuses the whole batch (so nothing is saved) when a reason is missing. */
  precheck(items: ReadonlyArray<PlannedActivity>, action: A, reason: string | undefined, env: BulkEnv, ctx: AuthenticatedContext): Promise<Result<void, DomainError>>;
  apply(ctx: AuthenticatedContext, id: string, snap: Snapshot, action: A, reason: string | undefined, env: BulkEnv): Promise<Result<unknown, DomainError>>;
  /** The action that restores `snap`, or undefined when the change cannot be reversed. */
  inverse(snap: Snapshot, action: A): BulkPlanAction | undefined;
}

type StrategyTable = { [K in BulkPlanAction["kind"]]: BulkStrategy<Extract<BulkPlanAction, { kind: K }>> };

const STATUS_INVERSE: Partial<Record<BulkStatus, BulkStatus>> = { COMPLETE: "REOPEN", REOPEN: "COMPLETE", CANCEL: "RESTORE", RESTORE: "CANCEL" };

export const BULK_STRATEGIES: StrategyTable = {
  SHIFT: {
    needs: "MOVE",
    preview: (s, a) => ({ before: `${s.plannedStart} to ${s.plannedEnd}`, after: `${addDays(s.plannedStart, a.days)} to ${addDays(s.plannedEnd, a.days)}` }),
    async precheck(items, _a, reason, env, ctx) {
      for (const item of items) {
        const s = item.snapshot();
        const used = await env.context.reportUsesDates(item.projectId, ctx.tenant.tenantId, { start: s.plannedStart, end: s.plannedEnd });
        if (!used.ok) return used;
        if (!reason && reasonRequired({ originalEnd: s.originalEnd }, env.today, { reportUsesIt: used.value })) {
          return err(DomainError.validation("Say why these activities are moving", { field: "reason" }));
        }
      }
      return ok(undefined);
    },
    apply: (ctx, id, s, a, reason, env) => env.reschedule.handle(ctx, id, {
      plannedStart: addDays(s.plannedStart, a.days), plannedEnd: addDays(s.plannedEnd, a.days), scope: "THIS", ...(reason ? { reason } : {}),
    }),
    inverse: (_s, a) => ({ kind: "SHIFT", days: -a.days }),
  },
  SET_LEAD: {
    needs: "ASSIGN",
    preview: (s, a) => ({ before: s.ownerUserId ?? "No lead", after: a.leadUserId ?? "No lead" }),
    precheck: async () => ok(undefined),
    apply: (ctx, id, s, a, reason, env) => env.assign.handle(ctx, id, { ownerUserId: a.leadUserId, supportUserIds: [...s.supportUserIds], scope: "THIS", ...(reason ? { reason } : {}) }),
    inverse: (s) => ({ kind: "SET_LEAD", leadUserId: s.ownerUserId ?? null }),
  },
  SET_STATUS: {
    needs: "CHANGE_STATUS",
    preview: (s, a) => ({ before: s.status, after: a.status }),
    precheck: async (_items, a, reason) => (a.status === "CANCEL" && !reason ? err(DomainError.validation("Say why these are being cancelled", { field: "reason" })) : ok(undefined)),
    apply: (ctx, id, _s, a, reason, env) => env.status.handle(ctx, id, { action: a.status, ...(reason ? { reason } : {}) }),
    inverse: (_s, a) => {
      const back = STATUS_INVERSE[a.status];
      return back ? { kind: "SET_STATUS", status: back } : undefined;
    },
  },
};

const strategyFor = (action: BulkPlanAction): BulkStrategy<BulkPlanAction> => BULK_STRATEGIES[action.kind] as unknown as BulkStrategy<BulkPlanAction>;

export interface BulkInput { ids: string[]; action: BulkPlanAction; reason?: string; apply: boolean }
export interface BulkResult { preview: BulkPlanRow[]; applied: number; undo: BulkUndoStep[] }

/**
 * Changes many planned activities at once. Everything is checked first (permission for each, a reason where one is needed), so a
 * refusal changes nothing. Without `apply` it only previews. After applying it returns the steps that would undo the change.
 */
export class BulkPlanActionHandler {
  constructor(
    private readonly access: PlanAccess, private readonly repo: IPlannedActivityRepository, private readonly context: IPlanContextReader,
    private readonly assign: IAssignPlan, private readonly reschedule: IReschedulePlan, private readonly status: IChangePlanStatus, private readonly clock: IClock,
  ) {}

  async handle(ctx: AuthenticatedContext, input: BulkInput): Promise<Result<BulkResult, DomainError>> {
    const ids = [...new Set(input.ids)];
    if (ids.length === 0) return err(DomainError.validation("Choose at least one activity"));
    const strategy = strategyFor(input.action);
    const items: PlannedActivity[] = [];
    for (const id of ids) {
      const loaded = await this.access.load(ctx, id, strategy.needs);
      if (!loaded.ok) return loaded;
      items.push(loaded.value);
    }
    const preview = items.map((i) => ({ id: i.id, title: i.title, ...strategy.preview(i.snapshot(), input.action) }));
    if (!input.apply) return ok({ preview, applied: 0, undo: [] });

    const reason = input.reason?.trim() || undefined;
    const env = this.env();
    const checked = await strategy.precheck(items, input.action, reason, env, ctx);
    if (!checked.ok) return checked;

    const undo: BulkUndoStep[] = [];
    let applied = 0;
    for (const id of ids) {
      // Read again: an earlier move in this batch may already have moved this one through a dependency.
      const latest = await this.repo.findById(id, ctx.tenant.tenantId);
      if (!latest.ok) return latest;
      if (!latest.value) return err(DomainError.notFound("PlannedActivity", id));
      const before = latest.value.snapshot();
      const done = await strategy.apply(ctx, id, before, input.action, reason, env);
      if (!done.ok) return done;
      const back = strategy.inverse(before, input.action);
      if (back) undo.push({ id, action: back });
      applied++;
    }
    return ok({ preview, applied, undo });
  }

  private env(): BulkEnv {
    return { assign: this.assign, reschedule: this.reschedule, status: this.status, context: this.context, today: toPlainDate(this.clock.now())! };
  }
}

/**
 * Puts activities back as they were, step by step, using the steps a bulk change returned. Each step is applied with the same
 * rules as any change (permission, reason): the reason is "Undone" so a step on an activity a report covers is not refused for lack
 * of one. Stops at the first refusal and says how many were put back.
 */
export class UndoBulkPlanActionHandler {
  constructor(private readonly bulk: BulkPlanActionHandler) {}

  async handle(ctx: AuthenticatedContext, steps: ReadonlyArray<BulkUndoStep>): Promise<Result<{ undone: number }, DomainError>> {
    if (steps.length === 0) return err(DomainError.validation("There is nothing to undo"));
    let undone = 0;
    for (const step of steps) {
      const res = await this.bulk.handle(ctx, { ids: [step.id], action: step.action, reason: "Undone", apply: true });
      if (!res.ok) return err(DomainError.validation(`${res.error.message} (${undone} of ${steps.length} put back)`));
      undone++;
    }
    return ok({ undone });
  }
}
