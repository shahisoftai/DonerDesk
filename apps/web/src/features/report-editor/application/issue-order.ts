/**
 * The issue navigator's list (Report Editor U5): every statement that needs
 * a decision, then any section that needs a re-check before approval, in
 * document order (sections in outline order; statements by position in the
 * text, unplaced ones last). Pure.
 */

export type IssueRef =
  | { key: string; kind: "statement"; sectionId: string; claimId: string }
  | { key: string; kind: "section"; sectionId: string };

export function buildIssueList(
  sections: ReadonlyArray<{ id: string; needsRecheck: boolean }>,
  openClaims: ReadonlyArray<{ id: string; sectionId: string; position: number | null }>,
): IssueRef[] {
  const issues: IssueRef[] = [];
  for (const section of sections) {
    const claims = openClaims
      .filter((c) => c.sectionId === section.id)
      .sort((a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER));
    for (const c of claims) issues.push({ key: `claim:${c.id}`, kind: "statement", sectionId: section.id, claimId: c.id });
    if (section.needsRecheck && claims.length === 0) issues.push({ key: `section:${section.id}`, kind: "section", sectionId: section.id });
  }
  return issues;
}

/** The key of the issue the URL points at (focused statement, else section). */
export function currentIssueKey(issues: ReadonlyArray<IssueRef>, focus: { claim?: string; section?: string }): string | undefined {
  if (focus.claim && issues.some((i) => i.key === `claim:${focus.claim}`)) return `claim:${focus.claim}`;
  if (focus.section && issues.some((i) => i.key === `section:${focus.section}`)) return `section:${focus.section}`;
  return undefined;
}

/**
 * The next (1) or previous (-1) issue, wrapping around. From no current
 * issue, "next" is the first and "previous" the last.
 */
export function stepIssue(issues: ReadonlyArray<IssueRef>, currentKey: string | undefined, direction: 1 | -1): IssueRef | null {
  if (issues.length === 0) return null;
  const index = currentKey ? issues.findIndex((i) => i.key === currentKey) : -1;
  if (index === -1) return direction === 1 ? issues[0]! : issues[issues.length - 1]!;
  return issues[(index + direction + issues.length) % issues.length]!;
}
