import type { Capability, Role } from "@/lib/shared/capabilities";

/**
 * Who sees what (plan §8.0), as one exhaustive table over `Role`: where a person lands, how the Activities tab opens,
 * and which plan buttons they are shown. A button a role cannot use is not rendered. A test pins that every role has a
 * row and that no surface offers an action its capabilities lack.
 */
export type PlanButton =
  | "ADD_COMPLETED"
  | "UPDATE_OWN_STATUS"
  | "ADD_PLANNED"
  | "START_FROM_LOGFRAME"
  | "MOVE_DATES"
  | "ASSIGN_LEAD"
  | "CANCEL";

export type PlanViewKey = "LIST" | "TIMELINE";
/** What the person lands on in Home, above the usual cards. Later batches add rows (delivery health, indicator values due). */
export type HomeLanding = "MY_WEEK" | "DEFAULT";

export interface RoleSurface {
  home: HomeLanding;
  planView: PlanViewKey;
  /** Open the list on the person's own activities. */
  mineFilter: boolean;
  buttons: ReadonlyArray<PlanButton>;
}

const MANAGE: ReadonlyArray<PlanButton> = ["ADD_PLANNED", "START_FROM_LOGFRAME", "MOVE_DATES", "ASSIGN_LEAD", "CANCEL", "UPDATE_OWN_STATUS"];

export const ROLE_SURFACES: Readonly<Record<Role, RoleSurface>> = {
  FIELD_OFFICER: { home: "MY_WEEK", planView: "LIST", mineFilter: true, buttons: ["ADD_COMPLETED", "UPDATE_OWN_STATUS"] },
  PROJECT_MANAGER: { home: "DEFAULT", planView: "TIMELINE", mineFilter: false, buttons: MANAGE },
  ME_OFFICER: { home: "DEFAULT", planView: "TIMELINE", mineFilter: false, buttons: MANAGE },
  GRANTS_OFFICER: { home: "DEFAULT", planView: "LIST", mineFilter: false, buttons: ["UPDATE_OWN_STATUS"] },
  COMPLIANCE_OFFICER: { home: "DEFAULT", planView: "LIST", mineFilter: false, buttons: ["UPDATE_OWN_STATUS"] },
  ADMIN: { home: "DEFAULT", planView: "TIMELINE", mineFilter: false, buttons: MANAGE },
  VIEWER: { home: "DEFAULT", planView: "LIST", mineFilter: false, buttons: [] },
};

/** The capability each button needs: the cross-check in the test, and the guard for rendering. */
export const BUTTON_CAPABILITY: Readonly<Record<PlanButton, Capability>> = {
  ADD_COMPLETED: "activity.create",
  UPDATE_OWN_STATUS: "workplan.update-own",
  ADD_PLANNED: "workplan.manage",
  START_FROM_LOGFRAME: "workplan.manage",
  MOVE_DATES: "workplan.manage",
  ASSIGN_LEAD: "workplan.manage",
  CANCEL: "workplan.manage",
};

export function surfaceFor(role: string | null | undefined): RoleSurface {
  return ROLE_SURFACES[(role ?? "VIEWER") as Role] ?? ROLE_SURFACES.VIEWER;
}

export function showsButton(role: string | null | undefined, capabilities: ReadonlySet<Capability>, button: PlanButton): boolean {
  return surfaceFor(role).buttons.includes(button) && capabilities.has(BUTTON_CAPABILITY[button]);
}

/** A manager of the plan (Admin, project manager, M&E officer) — the roles the timeline's actuals toggle opens for (§16). */
export function managesPlan(role: string | null | undefined): boolean {
  return surfaceFor(role).buttons.includes("ADD_PLANNED");
}
