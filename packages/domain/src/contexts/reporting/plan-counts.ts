/**
 * Counts of the planned activities by status: the one rule behind both the "Activities" number tiles and the "activities by status"
 * chart, so a tile and a chart can never disagree. Milestones are not activities; a cancelled activity is counted apart and never
 * in the total.
 */
import type { DatasetPlanRow } from "./dataset-query.js";

export interface PlanCounts { total: number; planned: number; inProgress: number; done: number; cancelled: number; late: number }

export function planCounts(rows: ReadonlyArray<DatasetPlanRow>): PlanCounts {
  const acts = rows.filter((r) => r.kind === "ACTIVITY");
  const live = acts.filter((r) => r.status !== "CANCELLED");
  return {
    total: live.length,
    planned: live.filter((r) => r.status === "PLANNED").length,
    inProgress: live.filter((r) => r.status === "IN_PROGRESS").length,
    done: live.filter((r) => r.status === "DONE").length,
    cancelled: acts.length - live.length,
    late: live.filter((r) => r.signal === "LATE").length,
  };
}
