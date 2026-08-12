export type Role = "ADMIN" | "PROJECT_MANAGER" | "ME_OFFICER" | "GRANTS_OFFICER" | "FIELD_OFFICER" | "COMPLIANCE_OFFICER" | "VIEWER";

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  PROJECT_MANAGER: "Project Manager",
  ME_OFFICER: "M&E Officer",
  GRANTS_OFFICER: "Grants Officer",
  FIELD_OFFICER: "Field Officer",
  COMPLIANCE_OFFICER: "Compliance Officer",
  VIEWER: "Viewer",
};

export const REPORT_TYPE_LABEL: Record<string, string> = {
  MONTHLY: "Monthly report",
  QUARTERLY: "Quarterly report",
  ANNUAL: "Annual report",
  FINAL: "Final report",
  ACTIVITY: "Activity report",
  SITUATION: "Situation report",
  CUSTOM: "Custom report",
};

export const REPORT_STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  EVIDENCE_COLLECTION: "Evidence collection",
  DRAFT_GENERATED: "Draft generated",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  SUBMITTED: "Submitted",
  CLOSED: "Closed",
};

export const SEVERITY_LABEL: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export const EVIDENCE_TYPE_LABEL: Record<string, string> = {
  ATTENDANCE_SHEET: "Attendance sheet",
  PHOTO: "Photo",
  DISTRIBUTION_LIST: "Distribution list",
  TRAINING_RECORD: "Training record",
  FIELD_VISIT_REPORT: "Field visit report",
  MONITORING_REPORT: "Monitoring report",
  KOBO_ODK_EXPORT: "Kobo/ODK export",
  PROCUREMENT_DOCUMENT: "Procurement document",
  APPROVAL_DOCUMENT: "Approval document",
  BENEFICIARY_LIST: "Beneficiary list",
  MEETING_MINUTES: "Meeting minutes",
  CASE_STUDY: "Case study",
  FINANCIAL_DOCUMENT: "Financial document",
  SUPPLIER_DOCUMENT: "Supplier document",
  DONOR_COMMUNICATION: "Donor communication",
  OTHER: "Other",
};
