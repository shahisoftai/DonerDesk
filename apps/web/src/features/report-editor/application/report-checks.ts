/**
 * One list of everything left to do before a report can be submitted and
 * approved. Replaces the four overlapping surfaces of the classic workspace
 * (sidebar readiness, Report Check areas, Smart Review, pre-approval list):
 * statements and section approval come from the draft itself, checklist and
 * indicator/evidence warnings from the period, and any remaining Smart Review
 * items (evidence, confidentiality) are appended without duplicating claims.
 */

export type CheckSeverity = "BLOCKING" | "WARNING";

export type CheckTarget =
  | { kind: "claim"; sectionId: string; claimId: string }
  | { kind: "section"; sectionId: string }
  | { kind: "href"; href: string };

export type ReportCheck = {
  id: string;
  severity: CheckSeverity;
  title: string;
  detail: string;
  actionLabel: string;
  target: CheckTarget;
};

export type ChecksInput = {
  projectId: string;
  periodId: string;
  sections: ReadonlyArray<{ id: string; sectionTitle: string; status: string }>;
  claims: ReadonlyArray<{ id: string; sectionId: string; verificationResult: string; resolvedById?: string | null }>;
  checklist: ReadonlyArray<{ id: string; title: string; severity: string; status: string }>;
  unverifiedIndicatorCount: number;
  sensitiveEvidenceCount: number;
  smartReviewItems?: ReadonlyArray<{
    id: string;
    severity: "BLOCKING" | "WARNING";
    title: string;
    explanation: string;
    claimId?: string;
    sectionId?: string;
    evidenceId?: string;
    action: { type: string; label: string };
  }>;
};

const CLOSED_CHECKLIST = new Set(["RESOLVED", "ACCEPTED_RISK", "NOT_APPLICABLE"]);

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Unresolved statements the verifier could not support, in document order. */
export function openClaimsInOrder<T extends { sectionId: string; verificationResult: string; resolvedById?: string | null }>(
  sections: ReadonlyArray<{ id: string }>,
  claims: ReadonlyArray<T>,
): T[] {
  const order = new Map(sections.map((s, i) => [s.id, i]));
  return claims
    .filter((c) => c.verificationResult === "FAILED" && !c.resolvedById && order.has(c.sectionId))
    .sort((a, b) => (order.get(a.sectionId) ?? 0) - (order.get(b.sectionId) ?? 0));
}

export function buildReportChecks(input: ChecksInput): ReportCheck[] {
  const checks: ReportCheck[] = [];
  const base = `/projects/${input.projectId}/reports/${input.periodId}`;

  const openClaims = openClaimsInOrder(input.sections, input.claims);
  if (openClaims.length > 0) {
    const first = openClaims[0]!;
    checks.push({
      id: "statements",
      severity: "BLOCKING",
      title: `${plural(openClaims.length, "statement")} need${openClaims.length === 1 ? "s" : ""} a decision`,
      detail: "The AI wrote something the evidence does not support. Correct it, keep it with a note, or leave it out.",
      actionLabel: "Review next",
      target: { kind: "claim", sectionId: first.sectionId, claimId: first.id },
    });
  }

  const unapproved = input.sections.filter((s) => s.status !== "APPROVED" && s.status !== "NOT_STARTED");
  if (unapproved.length > 0) {
    const blockedIds = new Set(openClaims.map((c) => c.sectionId));
    const next = unapproved.find((s) => !blockedIds.has(s.id)) ?? unapproved[0]!;
    checks.push({
      id: "sections",
      severity: "BLOCKING",
      title: `${plural(unapproved.length, "section")} waiting for approval`,
      detail: "Read each section and approve it. Approved sections are locked for this version.",
      actionLabel: "Go to next section",
      target: { kind: "section", sectionId: next.id },
    });
  }

  const openChecklist = input.checklist.filter((c) => !CLOSED_CHECKLIST.has(c.status));
  const critical = openChecklist.filter((c) => c.severity === "CRITICAL" || c.severity === "HIGH");
  const minor = openChecklist.filter((c) => c.severity !== "CRITICAL" && c.severity !== "HIGH");
  const complianceHref = `/projects/${input.projectId}/compliance?period=${input.periodId}`;
  if (critical.length > 0) {
    checks.push({
      id: "checklist-critical",
      severity: "BLOCKING",
      title: `Donor checklist: ${plural(critical.length, "important item")} open`,
      detail: critical.slice(0, 3).map((c) => c.title).join(" · "),
      actionLabel: "Open checklist",
      target: { kind: "href", href: complianceHref },
    });
  }
  if (minor.length > 0) {
    checks.push({
      id: "checklist-minor",
      severity: "WARNING",
      title: `Donor checklist: ${plural(minor.length, "item")} open`,
      detail: minor.slice(0, 3).map((c) => c.title).join(" · "),
      actionLabel: "Open checklist",
      target: { kind: "href", href: complianceHref },
    });
  }

  if (input.unverifiedIndicatorCount > 0) {
    checks.push({
      id: "indicators",
      severity: "WARNING",
      title: `${plural(input.unverifiedIndicatorCount, "indicator value")} not verified`,
      detail: "Unverified figures are marked in the report and may be questioned by the donor.",
      actionLabel: "Verify indicator data",
      target: { kind: "href", href: `${base}/indicators` },
    });
  }

  if (input.sensitiveEvidenceCount > 0) {
    checks.push({
      id: "sensitive-evidence",
      severity: "WARNING",
      title: `${plural(input.sensitiveEvidenceCount, "sensitive file")} linked to this report`,
      detail: "Confirm these files may be shared before you export.",
      actionLabel: "Review files",
      target: { kind: "href", href: `/projects/${input.projectId}/evidence` },
    });
  }

  // Remaining Smart Review items: anything statement-level is already covered
  // above; section-completion items duplicate the approval check.
  const sectionIds = new Set(input.sections.map((s) => s.id));
  for (const item of input.smartReviewItems ?? []) {
    if (item.claimId) continue;
    if (item.action.type === "complete-section" || item.action.type === "review-section") continue;
    const target: CheckTarget = item.evidenceId
      ? { kind: "href", href: `/projects/${input.projectId}/evidence/${item.evidenceId}` }
      : item.sectionId && sectionIds.has(item.sectionId)
        ? { kind: "section", sectionId: item.sectionId }
        : { kind: "href", href: `/projects/${input.projectId}/evidence` };
    checks.push({
      id: `smart-${item.id}`,
      severity: item.severity,
      title: item.title,
      detail: item.explanation,
      actionLabel: item.action.label,
      target,
    });
  }

  // Blocking first; stable within a severity.
  return checks
    .map((c, i) => ({ c, i }))
    .sort((a, b) => (a.c.severity === b.c.severity ? a.i - b.i : a.c.severity === "BLOCKING" ? -1 : 1))
    .map(({ c }) => c);
}
