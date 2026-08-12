export interface FixTarget {
  label: string;
  href: string;
}

export type ComplianceType =
  | "MISSING_EVIDENCE"
  | "INCOMPLETE_EVIDENCE_METADATA"
  | "UNVERIFIED_INDICATOR"
  | "UNSUPPORTED_REPORT_CLAIM"
  | "MISSING_ANNEX"
  | "MISSING_PROCUREMENT_DOCUMENT"
  | "MISSING_APPROVAL"
  | "MISSING_DISAGGREGATION"
  | "LATE_ACTIVITY_UPDATE"
  | "SENSITIVE_DATA_WARNING"
  | "UNREVIEWED_AI_OUTPUT";

/**
 * Maps a checklist item to the most direct place to resolve it, based on its
 * discriminated type and any linked entity. Returns null when there is no
 * sensible destination (the item should be resolved manually).
 */
export function complianceFixLink(input: {
  projectId: string;
  periodId: string;
  type: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}): FixTarget | null {
  const project = input.projectId;
  const period = input.periodId;

  if (input.relatedEntityId && input.relatedEntityType === "evidence") {
    return { label: "Open evidence", href: `/projects/${project}/evidence/${input.relatedEntityId}` };
  }
  if (input.relatedEntityId && input.relatedEntityType === "activity") {
    return { label: "Open activity", href: `/projects/${project}/activities/${input.relatedEntityId}` };
  }

  switch (input.type) {
    case "MISSING_EVIDENCE":
    case "INCOMPLETE_EVIDENCE_METADATA":
    case "MISSING_PROCUREMENT_DOCUMENT":
    case "SENSITIVE_DATA_WARNING":
      return { label: "View evidence", href: `/projects/${project}/evidence` };
    case "UNVERIFIED_INDICATOR":
      return { label: "Review indicators", href: `/projects/${project}/logframe` };
    case "MISSING_DISAGGREGATION":
    case "LATE_ACTIVITY_UPDATE":
      return { label: "Review activities", href: `/projects/${project}/activities` };
    case "UNSUPPORTED_REPORT_CLAIM":
    case "MISSING_ANNEX":
    case "UNREVIEWED_AI_OUTPUT":
      return { label: "Open report workspace", href: `/projects/${project}/reports/${period}` };
    case "MISSING_APPROVAL":
      return { label: "Review approvals", href: `/projects/${project}/reports/${period}` };
    default:
      return null;
  }
}
