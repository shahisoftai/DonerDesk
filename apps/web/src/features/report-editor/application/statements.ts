/**
 * How a checked statement reads in the editor. One definition shared by the
 * checks list, outline counts, highlights and the Statements tab, and aligned
 * with the server gate (`approve-report-section.ts`): only MATERIAL failed
 * statements without a decision block approval.
 */

export type StatementState = "open" | "minor" | "kept" | "left-out" | "verified";

export type StatementLike = {
  verificationResult: string;
  resolvedById?: string | null;
  materiality?: string | null;
};

export function statementState(c: StatementLike): StatementState {
  if (c.verificationResult === "EXCLUDED") return "left-out";
  if (c.resolvedById || c.verificationResult === "ACCEPTED_WITH_LIMITATION") return "kept";
  if (c.verificationResult === "PASSED") return "verified";
  return c.materiality === "NOT_MATERIAL" ? "minor" : "open";
}

/** Needs a decision before the section can be approved. */
export function isOpenStatement(c: StatementLike): boolean {
  return statementState(c) === "open";
}

/** A decision the user can undo (keep-with-note / leave-out). */
export function isResolvedStatement(c: StatementLike): boolean {
  const state = statementState(c);
  return state === "kept" || state === "left-out";
}
