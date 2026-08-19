/**
 * Assurance lifecycle for report revisions. Assurance is bound to a revision's
 * exact content hash and must never survive content changes: any mutation
 * creates a new revision in UNASSESSED, and verification can only promote the
 * revision that verification actually examined.
 */
export type AssuranceState = "UNASSESSED" | "ASSESSING" | "CURRENT" | "STALE" | "FAILED";

export const ASSURANCE_STATES: AssuranceState[] = ["UNASSESSED", "ASSESSING", "CURRENT", "STALE", "FAILED"];

export type ChangeOrigin = "GENERATION" | "MANUAL_EDIT" | "REWRITE" | "AUTO_FIX" | "MERGE";

export const CHANGE_ORIGINS: ChangeOrigin[] = ["GENERATION", "MANUAL_EDIT", "REWRITE", "AUTO_FIX", "MERGE"];

const TRANSITIONS: Record<AssuranceState, AssuranceState[]> = {
  UNASSESSED: ["ASSESSING", "FAILED"],
  ASSESSING: ["CURRENT", "FAILED", "STALE"],
  CURRENT: ["STALE", "ASSESSING"],
  STALE: ["ASSESSING", "FAILED", "CURRENT"],
  FAILED: ["ASSESSING"],
};

export function canTransitionAssurance(from: AssuranceState, to: AssuranceState): boolean {
  if (from === to) return true;
  return TRANSITIONS[from].includes(to);
}

/**
 * Any content change invalidates prior assurance. Every mutation path must
 * start here.
 */
export function initialAssuranceState(): AssuranceState {
  return "UNASSESSED";
}

export function assuranceRequiresReview(state: AssuranceState): boolean {
  return state === "UNASSESSED" || state === "STALE" || state === "FAILED" || state === "ASSESSING";
}

/**
 * Whether an approval may bind to a revision in this state. Approval requires
 * CURRENT assurance; STALE or UNASSESSED revisions must never be approved.
 */
export function canApproveAssurance(state: AssuranceState): boolean {
  return state === "CURRENT";
}
