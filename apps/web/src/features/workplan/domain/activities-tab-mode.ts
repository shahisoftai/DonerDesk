import { surfaceFor } from "./role-surfaces.ts";

/**
 * What the Activities tab shows: the Planned / Completed switch and which side opens. A project with no plan and nobody
 * who can start one gets no switch and today's page unchanged; hiding work planning (Admin setting) does the same.
 */
export interface ActivitiesTabInput {
  role: string | null | undefined;
  planningVisible: boolean;
  plannedCount: number;
  canPlan: boolean;
  view: string | undefined;
}

export interface ActivitiesTabMode {
  showSwitch: boolean;
  planned: boolean;
}

export function activitiesTabMode(input: ActivitiesTabInput): ActivitiesTabMode {
  const showSwitch = input.planningVisible && (input.plannedCount > 0 || input.canPlan);
  if (!showSwitch) return { showSwitch: false, planned: false };
  if (input.view === "planned") return { showSwitch, planned: true };
  if (input.view === "completed") return { showSwitch, planned: false };
  return { showSwitch, planned: surfaceFor(input.role).activitiesTab === "PLANNED" && input.plannedCount > 0 };
}
