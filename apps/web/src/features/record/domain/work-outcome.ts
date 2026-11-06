/**
 * "What happened?" (Phase 44): one question replaces three entry points (Mark done, Progress log, the completed-activity form). The
 * person picks one of four answers; this decides which EXISTING actions carry it out, in order. It writes nothing and invents no new
 * rule: a status step is offered only when the plan's own table (`canApplyPlanAction`) allows it. Pure.
 */
import { canApplyPlanAction, type PlanAction, type PlanStatus } from "@donordesk/domain/contexts/workplan/plan-status-transitions.js";

export type WorkChoice =
  /** The planned item is finished. */
  | "FINISHED"
  /** Some work was done; it is not finished. */
  | "PROGRESS"
  /** It did not happen. */
  | "NOT_HELD"
  /** Something done that was never planned (started from Record, not from a plan item). */
  | "UNPLANNED";

export type WorkStep =
  /** `completePlannedActivityAction`: records the completed activity and marks the plan item done in one call. */
  | { action: "COMPLETE_PLANNED" }
  /** `createActivityAction`, linked to the plan item when there is one. */
  | { action: "CREATE_ACTIVITY"; linkToPlan: boolean }
  /** `saveProgressAction`. */
  | { action: "SAVE_PROGRESS" }
  /** `changePlanStatusAction` with one of the plan's own actions. */
  | { action: "CHANGE_STATUS"; planAction: PlanAction; reason?: string };

export type WorkProblem =
  | "NEEDS_PLAN_ITEM"
  | "NEEDS_REASON"
  | "PLAN_ITEM_NOT_OPEN";

export interface WorkOutcomeInput {
  choice: WorkChoice;
  /** The planned item's status when the person started from one. */
  planStatus?: PlanStatus | undefined;
  /** Anything beyond day, people and a note: the story, groups of people, links, an end date. */
  hasDetail: boolean;
  /** Without a connection the one-call "complete" cannot be queued, so the same result is made of steps that can. */
  online: boolean;
  /** Why it did not happen. Required for NOT_HELD. */
  reason?: string | undefined;
}

export type WorkOutcome =
  | { ok: true; steps: WorkStep[] }
  | { ok: false; problem: WorkProblem };

export function chooseWorkOutcome(input: WorkOutcomeInput): WorkOutcome {
  const hasPlan = input.planStatus !== undefined;
  const status = input.planStatus;

  if (input.choice === "UNPLANNED") return { ok: true, steps: [{ action: "CREATE_ACTIVITY", linkToPlan: false }] };
  if (!hasPlan) return { ok: false, problem: "NEEDS_PLAN_ITEM" };

  const can = (action: PlanAction) => canApplyPlanAction(status!, action);

  if (input.choice === "FINISHED") {
    if (!can("COMPLETE")) return { ok: false, problem: "PLAN_ITEM_NOT_OPEN" };
    // The one-call completion carries a day, people and a note. Anything more, or no connection, becomes an activity plus a status step.
    if (input.online && !input.hasDetail) return { ok: true, steps: [{ action: "COMPLETE_PLANNED" }] };
    return { ok: true, steps: [{ action: "CREATE_ACTIVITY", linkToPlan: true }, { action: "CHANGE_STATUS", planAction: "COMPLETE" }] };
  }

  if (input.choice === "PROGRESS") {
    if (!(status === "PLANNED" || status === "IN_PROGRESS")) return { ok: false, problem: "PLAN_ITEM_NOT_OPEN" };
    const steps: WorkStep[] = [{ action: "SAVE_PROGRESS" }];
    // Saying how far it got is saying it is under way.
    if (can("START")) steps.push({ action: "CHANGE_STATUS", planAction: "START" });
    return { ok: true, steps };
  }

  // NOT_HELD
  if (!can("CANCEL")) return { ok: false, problem: "PLAN_ITEM_NOT_OPEN" };
  const reason = input.reason?.trim() ?? "";
  if (reason === "") return { ok: false, problem: "NEEDS_REASON" };
  return { ok: true, steps: [{ action: "CHANGE_STATUS", planAction: "CANCEL", reason }] };
}

/** True when every step can be queued by an outbox sender that exists today (so the answer works with no connection). */
export function worksOffline(steps: readonly WorkStep[]): boolean {
  return steps.every((s) => s.action !== "COMPLETE_PLANNED");
}
