import { isOpenStatement } from "./statements.ts";

/**
 * One list of everything left to do before a report can be submitted and
 * approved. Replaces the four overlapping surfaces of the classic workspace
 * (sidebar readiness, Report Check areas, Smart Review, pre-approval list):
 * statements, re-checks and section approval come from the draft itself,
 * checklist and indicator/evidence warnings from the period, and any
 * remaining Smart Review items (evidence, confidentiality) are appended
 * without duplicating claims.
 */

export type CheckSeverity = "BLOCKING" | "WARNING";

export type CheckTarget =
  | { kind: "claim"; sectionId: string; claimId: string }
  | { kind: "section"; sectionId: string; panel?: "comments" }
  | { kind: "recheck"; sectionIds: string[] }
  | { kind: "href"; href: string };

export type ReportCheck = {
  id: string;
  severity: CheckSeverity;
  title: string;
  detail: string;
  actionLabel: string;
  target: CheckTarget;
};

export type CheckSection = {
  id: string;
  sectionTitle: string;
  status: string;
  /** Assurance of the current revision; `undefined` = unknown (not blocking). */
  assuranceState?: string | null;
};

export type ChecksInput = {
  projectId: string;
  periodId: string;
  sections: ReadonlyArray<CheckSection>;
  claims: ReadonlyArray<{ id: string; sectionId: string; verificationResult: string; resolvedById?: string | null; materiality?: string | null }>;
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
  /** Open comments per section id (U15). */
  commentCounts?: Readonly<Record<string, number>>;
  /** Indicator values / evidence changed after the draft was written (B6). */
  inputsChanged?: { indicators: number; evidence: number; sectionIds: string[] } | null;
  /** Synthesis sections older than a substantial change elsewhere (U31). */
  staleSummaryIds?: ReadonlyArray<string>;
  /** Sections whose verified tables had numbers changed (U24). */
  driftedTableSectionIds?: ReadonlyArray<string>;
};

const CLOSED_CHECKLIST = new Set(["RESOLVED", "ACCEPTED_RISK", "NOT_APPLICABLE"]);

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Statements that need a decision (material, failed, undecided), in document order. */
export function openClaimsInOrder<T extends { sectionId: string; verificationResult: string; resolvedById?: string | null; materiality?: string | null }>(
  sections: ReadonlyArray<{ id: string }>,
  claims: ReadonlyArray<T>,
): T[] {
  const order = new Map(sections.map((s, i) => [s.id, i]));
  return claims
    .filter((c) => isOpenStatement(c) && order.has(c.sectionId))
    .sort((a, b) => (order.get(a.sectionId) ?? 0) - (order.get(b.sectionId) ?? 0));
}

/**
 * Sections whose text changed (or whose evidence changed) since they were
 * checked, and that have nothing else to decide: a re-check is what stands
 * between them and approval. Unknown assurance never blocks.
 */
export function sectionsNeedingRecheck(sections: ReadonlyArray<CheckSection>, openSectionIds: ReadonlySet<string>): CheckSection[] {
  return sections.filter(
    (s) =>
      s.status !== "APPROVED" &&
      s.status !== "NOT_STARTED" &&
      typeof s.assuranceState === "string" &&
      s.assuranceState !== "CURRENT" &&
      !openSectionIds.has(s.id),
  );
}

export function buildReportChecks(input: ChecksInput): ReportCheck[] {
  const checks: ReportCheck[] = [];
  const base = `/projects/${input.projectId}/reports/${input.periodId}`;
  const titleOf = new Map(input.sections.map((s) => [s.id, s.sectionTitle]));

  const openClaims = openClaimsInOrder(input.sections, input.claims);
  const openSectionIds = new Set(openClaims.map((c) => c.sectionId));
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

  const recheck = sectionsNeedingRecheck(input.sections, openSectionIds);
  if (recheck.length > 0) {
    checks.push({
      id: "recheck",
      severity: "BLOCKING",
      title: `${plural(recheck.length, "section")} need${recheck.length === 1 ? "s" : ""} a re-check`,
      detail: `The text or its evidence changed since it was checked: ${recheck.slice(0, 3).map((s) => s.sectionTitle).join(" · ")}.`,
      actionLabel: "Re-check now",
      target: { kind: "recheck", sectionIds: recheck.map((s) => s.id) },
    });
  }

  const unapproved = input.sections.filter((s) => s.status !== "APPROVED" && s.status !== "NOT_STARTED");
  if (unapproved.length > 0) {
    const blockedIds = new Set([...openSectionIds, ...recheck.map((s) => s.id)]);
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

  if (input.inputsChanged && (input.inputsChanged.indicators > 0 || input.inputsChanged.evidence > 0)) {
    const { indicators, evidence, sectionIds } = input.inputsChanged;
    const parts = [indicators > 0 ? plural(indicators, "indicator value") : null, evidence > 0 ? plural(evidence, "evidence file") : null].filter(Boolean);
    const affected = sectionIds.length > 0 ? sectionIds : input.sections.filter((s) => s.status !== "NOT_STARTED").map((s) => s.id);
    checks.push({
      id: "inputs-changed",
      severity: "WARNING",
      title: `${parts.join(" and ")} changed since this draft`,
      detail: "Re-check the affected sections so every statement is checked against the latest data. The text is not rewritten.",
      actionLabel: "Re-check affected sections",
      target: { kind: "recheck", sectionIds: affected },
    });
  }

  for (const id of input.staleSummaryIds ?? []) {
    if (!titleOf.has(id)) continue;
    checks.push({
      id: `summary-stale-${id}`,
      severity: "WARNING",
      title: `“${titleOf.get(id)}” may be out of date`,
      detail: "Another section changed a lot after this summary was written. Regenerate the summary so it matches.",
      actionLabel: "Go to section",
      target: { kind: "section", sectionId: id },
    });
  }

  for (const id of input.driftedTableSectionIds ?? []) {
    if (!titleOf.has(id)) continue;
    checks.push({
      id: `table-drift-${id}`,
      severity: "WARNING",
      title: `Numbers changed in a verified table (“${titleOf.get(id)}”)`,
      detail: "The table was built from verified data. Check the changed figures against the evidence before you submit.",
      actionLabel: "Go to section",
      target: { kind: "section", sectionId: id },
    });
  }

  const commented = input.sections.filter((s) => (input.commentCounts?.[s.id] ?? 0) > 0);
  if (commented.length > 0) {
    const total = commented.reduce((sum, s) => sum + (input.commentCounts?.[s.id] ?? 0), 0);
    checks.push({
      id: "comments",
      severity: "WARNING",
      title: `${plural(total, "open comment")}`,
      detail: `Resolve or answer comments on ${commented.slice(0, 3).map((s) => s.sectionTitle).join(" · ")}.`,
      actionLabel: "Open comments",
      target: { kind: "section", sectionId: commented[0]!.id, panel: "comments" },
    });
  }

  if (input.unverifiedIndicatorCount > 0) {
    checks.push({
      id: "indicators",
      severity: "WARNING",
      title: `${plural(input.unverifiedIndicatorCount, "indicator value")} not verified`,
      detail: "Unverified figures are marked in the report and may be questioned by the donor.",
      actionLabel: "Verify indicator data",
      target: { kind: "href", href: `${base}/inputs?tab=indicators` },
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
