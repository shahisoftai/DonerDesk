/**
 * Who may do what to a planned activity: one function, used by the handlers (refusal) and the UI (which buttons
 * to show), so they cannot disagree. Managers (`workplan.manage`) may do everything; the activity's lead and helpers
 * (`workplan.update-own`) may change its status and notes; everyone with `project.view` may read it.
 */
import type { Role } from "../identity/role.js";
import { Permissions, type Permission } from "../../policies/permissions.js";

export type PlanItemAction = "VIEW" | "EDIT" | "MOVE" | "ASSIGN" | "CHANGE_STATUS" | "CANCEL" | "EDIT_NOTES";

export const PLAN_ITEM_ACTIONS: PlanItemAction[] = ["VIEW", "EDIT", "MOVE", "ASSIGN", "CHANGE_STATUS", "CANCEL", "EDIT_NOTES"];

export const PLAN_ITEM_ACTION_RULES: Readonly<Record<PlanItemAction, { anyone: Permission; ownItem?: Permission }>> = {
  VIEW: { anyone: "project.view" },
  EDIT: { anyone: "workplan.manage" },
  MOVE: { anyone: "workplan.manage" },
  ASSIGN: { anyone: "workplan.manage" },
  CANCEL: { anyone: "workplan.manage" },
  CHANGE_STATUS: { anyone: "workplan.manage", ownItem: "workplan.update-own" },
  EDIT_NOTES: { anyone: "workplan.manage", ownItem: "workplan.update-own" },
};

export interface PlanActor {
  userId: string;
  role: Role;
}

export interface PlanItemPeople {
  ownerUserId?: string;
  supportUserIds?: ReadonlyArray<string>;
}

export function isPlanItemMember(userId: string, item: PlanItemPeople): boolean {
  return item.ownerUserId === userId || (item.supportUserIds ?? []).includes(userId);
}

export function canActOnPlanItem(actor: PlanActor, item: PlanItemPeople | undefined, action: PlanItemAction): boolean {
  const rule = PLAN_ITEM_ACTION_RULES[action];
  if (Permissions.can(actor.role, rule.anyone)) return true;
  return rule.ownItem !== undefined && item !== undefined && isPlanItemMember(actor.userId, item) && Permissions.can(actor.role, rule.ownItem);
}
