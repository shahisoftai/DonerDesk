/**
 * Linking a completed activity to a planned activity: the planned activity must be in the same project and, when
 * both name a logframe activity, it must be the same one. An empty logframe link on the completed activity is
 * filled from the planned activity (fill, never overwrite).
 */
export interface PlanLinkTarget {
  id: string;
  projectId: string;
  logframeActivityId?: string;
}

export type PlanLinkResult =
  | { ok: true; value: { plannedActivityId: string; logframeActivityId?: string } }
  | { ok: false; message: string };

export function resolvePlanLink(plan: PlanLinkTarget | undefined, entry: { projectId: string; logframeActivityId?: string }): PlanLinkResult {
  if (!plan || plan.projectId !== entry.projectId) return { ok: false, message: "Choose a planned activity of this project" };
  if (entry.logframeActivityId && plan.logframeActivityId && entry.logframeActivityId !== plan.logframeActivityId) {
    return { ok: false, message: "This planned activity belongs to a different logframe activity" };
  }
  const node = entry.logframeActivityId ?? plan.logframeActivityId;
  return { ok: true, value: { plannedActivityId: plan.id, ...(node ? { logframeActivityId: node } : {}) } };
}
