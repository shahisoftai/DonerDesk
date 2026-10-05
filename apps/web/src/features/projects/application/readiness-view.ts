/** Pure presentation helpers for the readiness card (unit-testable with node --test). */

export type ReadinessStageName = "DRAFTING" | "IN_REVIEW" | "SUBMISSION";

const STAGE_LABEL: Record<ReadinessStageName, string> = {
  DRAFTING: "Drafting",
  IN_REVIEW: "In review",
  SUBMISSION: "Ready to submit",
};

/** "Drafting · 82 %": the number is never read as "ready to submit" unless it is. */
export function readinessHeadline(overall: number, stage: string | undefined, hasDraft: boolean): string {
  if (!hasDraft && (stage === undefined || stage === "DRAFTING")) return "Generate a draft to start";
  const label = STAGE_LABEL[(stage as ReadinessStageName) ?? "SUBMISSION"] ?? "Readiness";
  return `${label} · ${overall}%`;
}

export type BlockerActionKind = "OPEN_REPORT" | "OPEN_INPUTS" | "OPEN_EVIDENCE" | "OPEN_CHECKLIST" | "OPEN_LOGFRAME" | "OPEN_APPROVAL";

/** Where each advice action goes. Unknown kinds fall back to the report so a new server rule never yields a dead button. */
export function blockerActionHref(kind: string, projectId: string, periodId: string): string {
  switch (kind as BlockerActionKind) {
    case "OPEN_INPUTS": return `/projects/${projectId}/reports/${periodId}/inputs`;
    case "OPEN_EVIDENCE": return `/projects/${projectId}/evidence`;
    case "OPEN_CHECKLIST": return `/projects/${projectId}/compliance`;
    case "OPEN_LOGFRAME": return `/projects/${projectId}/logframe`;
    case "OPEN_REPORT":
    case "OPEN_APPROVAL":
    default: return `/projects/${projectId}/reports/${periodId}`;
  }
}
