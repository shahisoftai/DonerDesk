export interface PreApprovalIssue {
  code: string;
  message: string;
  severity: "blocking" | "warning";
}

export interface PreApprovalInput {
  draftStatus?: string;
  sections: Array<{ status: string }>;
  checklist: Array<{ severity: string; status: string }>;
  unverifiedIndicatorCount?: number;
  sensitiveEvidenceCount?: number;
}

/**
 * Evaluates a report draft against configured readiness signals and returns
 * blocking and warning issues for the pre-approval summary. Pure and exhaustive;
 * it never performs or authorizes the approval itself (that is server-confirmed).
 */
export function evaluatePreApproval(input: PreApprovalInput): PreApprovalIssue[] {
  const issues: PreApprovalIssue[] = [];

  const totalSections = input.sections.length;
  const approvedSections = input.sections.filter((s) => s.status === "APPROVED").length;
  const incomplete = totalSections - approvedSections;
  if (incomplete > 0) {
    issues.push({
      code: "INCOMPLETE_SECTIONS",
      message: `${incomplete} of ${totalSections} section(s) are not approved.`,
      severity: "blocking",
    });
  }

  const openCritical = input.checklist.filter(
    (c) =>
      c.status !== "RESOLVED" && c.status !== "ACCEPTED_RISK" && c.status !== "NOT_APPLICABLE" && (c.severity === "CRITICAL" || c.severity === "HIGH"),
  ).length;
  if (openCritical > 0) {
    issues.push({
      code: "OPEN_CRITICAL_CHECKLIST",
      message: `${openCritical} critical/high checklist item(s) remain open.`,
      severity: "blocking",
    });
  }

  const openLow = input.checklist.filter(
    (c) => c.status !== "RESOLVED" && c.status !== "ACCEPTED_RISK" && c.status !== "NOT_APPLICABLE" && (c.severity === "MEDIUM" || c.severity === "LOW"),
  ).length;
  if (openLow > 0) {
    issues.push({
      code: "OPEN_LOW_CHECKLIST",
      message: `${openLow} medium/low checklist item(s) remain open.`,
      severity: "warning",
    });
  }

  if ((input.unverifiedIndicatorCount ?? 0) > 0) {
    issues.push({
      code: "UNVERIFIED_INDICATORS",
      message: `${input.unverifiedIndicatorCount} indicator update(s) are not verified.`,
      severity: "warning",
    });
  }

  if ((input.sensitiveEvidenceCount ?? 0) > 0) {
    issues.push({
      code: "SENSITIVE_EVIDENCE",
      message: `${input.sensitiveEvidenceCount} sensitive file(s) are included and should be reviewed.`,
      severity: "warning",
    });
  }

  return issues;
}
