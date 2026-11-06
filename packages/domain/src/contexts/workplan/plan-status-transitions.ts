/**
 * What may happen to a planned activity's status, as a table (same shape as `ACTIVITY_TRANSITIONS`): the aggregate
 * checks it for every change and the UI asks `canApplyPlanAction`, so a button and a refusal cannot disagree.
 */
export type PlanStatus = "PLANNED" | "IN_PROGRESS" | "DONE" | "CANCELLED";
export type PlanAction = "START" | "COMPLETE" | "REOPEN" | "CANCEL" | "RESTORE";

export const PLAN_STATUSES: PlanStatus[] = ["PLANNED", "IN_PROGRESS", "DONE", "CANCELLED"];
export const PLAN_ACTIONS: PlanAction[] = ["START", "COMPLETE", "REOPEN", "CANCEL", "RESTORE"];

export interface PlanTransition {
  from: ReadonlyArray<PlanStatus>;
  to: PlanStatus;
  /** The person must say why (stored as the status reason and on the revision). */
  needsReason: boolean;
  refusal: string;
}

export const PLAN_STATUS_TRANSITIONS: Readonly<Record<PlanAction, PlanTransition>> = {
  START: { from: ["PLANNED"], to: "IN_PROGRESS", needsReason: false, refusal: "Only an activity that has not started can be marked under way" },
  COMPLETE: { from: ["PLANNED", "IN_PROGRESS"], to: "DONE", needsReason: false, refusal: "Only an open activity can be marked done" },
  REOPEN: { from: ["DONE"], to: "IN_PROGRESS", needsReason: false, refusal: "Only a done activity can be reopened" },
  CANCEL: { from: ["PLANNED", "IN_PROGRESS"], to: "CANCELLED", needsReason: true, refusal: "Only an open activity can be cancelled" },
  RESTORE: { from: ["CANCELLED"], to: "PLANNED", needsReason: false, refusal: "Only a cancelled activity can be restored" },
};

export function canApplyPlanAction(status: PlanStatus, action: PlanAction): boolean {
  return PLAN_STATUS_TRANSITIONS[action].from.includes(status);
}

/**
 * The action that moves `from` to `to`, for the three-step control (Not started · Under way · Done). Undefined when
 * no single action does it (e.g. DONE → PLANNED).
 */
export function planActionFor(from: PlanStatus, to: PlanStatus): PlanAction | undefined {
  return PLAN_ACTIONS.find((a) => PLAN_STATUS_TRANSITIONS[a].to === to && canApplyPlanAction(from, a));
}

/** An activity that is still to be delivered (done and cancelled ones are not). */
export function isOpenPlanStatus(status: PlanStatus): boolean {
  return status === "PLANNED" || status === "IN_PROGRESS";
}
