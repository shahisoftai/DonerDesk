/**
 * Claim resolution semantics are the single source of truth for how a
 * verification outcome becomes an actionable claim-level decision. The
 * "ACCEPTED_WITH_LIMITATION" path preserves the failed verification status:
 * nothing ever silently converts a failed check into a verified state.
 */
export type Resolution =
  | "VERIFIED"
  | "AI_REDRAFTED"
  | "SOURCE_ADDED"
  | "ACCEPTED_WITH_LIMITATION"
  | "EXCLUDED";

export const RESOLUTIONS: Resolution[] = [
  "VERIFIED",
  "AI_REDRAFTED",
  "SOURCE_ADDED",
  "ACCEPTED_WITH_LIMITATION",
  "EXCLUDED",
];

export interface ResolutionDecision {
  resolution: Resolution;
  /** Aggregate note required for ACCEPTED_WITH_LIMITATION. */
  notes: string;
  /** Capability/permission required to apply the resolution. */
  requiredCapability: "report.resolve-claim" | "report.override-confidentiality" | "NONE";
}

/**
 * Returns the decision shape for a resolution, enforcing the invariant that
 * ACCEPTED_WITH_LIMITATION requires an aggregate note.
 */
export function resolveClaimDecision(input: {
  resolution: Resolution;
  notes?: string;
  isConfidentialSource: boolean;
}): ResolutionDecision {
  if (input.resolution === "ACCEPTED_WITH_LIMITATION") {
    if (!input.notes || input.notes.trim().length === 0) {
      throw new Error("ACCEPTED_WITH_LIMITATION requires an aggregate note");
    }
    return { resolution: "ACCEPTED_WITH_LIMITATION", notes: input.notes.trim(), requiredCapability: "report.resolve-claim" };
  }
  if (input.resolution === "EXCLUDED") {
    if (input.isConfidentialSource) {
      return { resolution: "EXCLUDED", notes: input.notes ?? "", requiredCapability: "report.override-confidentiality" };
    }
    return { resolution: "EXCLUDED", notes: input.notes ?? "", requiredCapability: "NONE" };
  }
  return { resolution: input.resolution, notes: input.notes ?? "", requiredCapability: "NONE" };
}

/**
 * Resolutions that are applied automatically by the system (never silently —
 * each still writes an audit record).
 */
export function isAutoResolution(resolution: Resolution): boolean {
  return resolution === "VERIFIED" || resolution === "AI_REDRAFTED" || resolution === "SOURCE_ADDED";
}
