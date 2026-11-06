/**
 * What the Activities tab shows (plan §16d): the plan is the one surface — when there is one, everyone opens on it,
 * for every role — and "Completed" is a filter on it. The records page keeps its address (old bookmarks, the quiet
 * link) and answers with the way back. A project with no plan and nobody who can start one shows today's page
 * unchanged; hiding work planning (Admin setting) does the same, and the data is kept.
 */
export interface ActivitiesTabInput {
  planningVisible: boolean;
  plannedCount: number;
  canPlan: boolean;
  view: string | undefined;
}

export interface ActivitiesTabMode {
  planned: boolean;
  /** The quiet link to the other side, exactly when the old switch offered one. */
  otherSide: "RECORDS" | "PLAN" | null;
}

export function activitiesTabMode(input: ActivitiesTabInput): ActivitiesTabMode {
  if (!input.planningVisible) return { planned: false, otherSide: null };
  const anythingToReach = input.plannedCount > 0 || input.canPlan;
  if (input.view === "completed") return { planned: false, otherSide: anythingToReach ? "PLAN" : null };
  if (anythingToReach) return { planned: true, otherSide: "RECORDS" };
  return { planned: false, otherSide: null };
}
