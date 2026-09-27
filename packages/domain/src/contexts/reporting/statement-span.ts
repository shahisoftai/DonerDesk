/**
 * Where a checked statement sits in its section's markdown, and how a report
 * reads once left-out statements are removed. Pure; shared by the api
 * (evidence corrections, exports) so every path agrees on the span.
 */

export interface StatementLocation {
  text: string;
  charStart?: number;
  charEnd?: number;
}

/**
 * The verifier's span when it still holds the statement, otherwise the first
 * exact occurrence of its text; `null` when the wording has changed.
 */
export function locateClaimSpan(content: string, claim: StatementLocation): { start: number; end: number } | null {
  if (claim.charStart !== undefined && claim.charEnd !== undefined && content.slice(claim.charStart, claim.charEnd) === claim.text) {
    return { start: claim.charStart, end: claim.charEnd };
  }
  const index = content.indexOf(claim.text);
  return index >= 0 ? { start: index, end: index + claim.text.length } : null;
}

/**
 * Removes statements the reviewer chose to leave out (EXCLUDED) from section
 * markdown, tidying the whitespace left behind. Statements whose wording no
 * longer matches are left untouched (the editor flags them for re-check).
 */
export function omitExcludedStatements(content: string, claims: ReadonlyArray<StatementLocation & { verificationResult: string }>): string {
  const spans = claims
    .filter((c) => c.verificationResult === "EXCLUDED")
    .map((c) => locateClaimSpan(content, c))
    .filter((s): s is { start: number; end: number } => s !== null)
    .sort((a, b) => b.start - a.start);
  let out = content;
  let lastStart = Number.POSITIVE_INFINITY;
  for (const span of spans) {
    if (span.end > lastStart) continue; // overlapping span already removed
    out = out.slice(0, span.start) + out.slice(span.end);
    lastStart = span.start;
  }
  return out
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([.,;:])/g, "$1")
    .replace(/^[ \t]+|[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
