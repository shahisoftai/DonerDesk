import type { Role } from "@/lib/shared/capabilities";
export { ROLES } from "@/lib/shared/capabilities";
export type { Role };

export const ORG_TYPE_LABEL: Record<string, string> = {
  LOCAL_NGO: "Local NGO",
  NATIONAL_NGO: "National NGO",
  INGO: "International NGO",
  UN_IMPLEMENTING_PARTNER: "UN implementing partner",
  CONSULTING_FIRM: "Consulting firm",
  GOVERNMENT_UNIT: "Government programme unit",
  OTHER: "Other",
};

export const ORG_TYPE_OPTIONS: readonly string[] = [
  "LOCAL_NGO",
  "NATIONAL_NGO",
  "INGO",
  "UN_IMPLEMENTING_PARTNER",
  "CONSULTING_FIRM",
  "GOVERNMENT_UNIT",
  "OTHER",
];

export const SECTOR_LABEL: Record<string, string> = {
  NUTRITION: "Nutrition",
  FOOD_SECURITY: "Food security",
  WASH: "Water, sanitation & hygiene",
  HEALTH: "Health",
  PROTECTION: "Protection",
  EDUCATION: "Education",
  LIVELIHOODS: "Livelihoods",
  SHELTER: "Shelter",
  MULTI_SECTOR: "Multi-sector",
  OTHER: "Other",
};

export const SECTOR_OPTIONS: readonly string[] = [
  "NUTRITION",
  "FOOD_SECURITY",
  "WASH",
  "HEALTH",
  "PROTECTION",
  "EDUCATION",
  "LIVELIHOODS",
  "SHELTER",
  "MULTI_SECTOR",
  "OTHER",
];

export const ORGANIZATION_TYPE_OPTIONS: readonly string[] = [
  "LOCAL_NGO",
  "NATIONAL_NGO",
  "INGO",
  "UN_IMPLEMENTING_PARTNER",
  "CONSULTING_FIRM",
  "GOVERNMENT_UNIT",
  "OTHER",
];

export const LANGUAGE_OPTIONS: readonly string[] = ["en", "ar", "ur", "fr", "ps"];

export const ORGANIZATION_TYPE_LABEL: Record<string, string> = {
  LOCAL_NGO: "Local NGO",
  NATIONAL_NGO: "National NGO",
  INGO: "International NGO",
  UN_IMPLEMENTING_PARTNER: "UN implementing partner",
  CONSULTING_FIRM: "Consulting firm",
  GOVERNMENT_UNIT: "Government unit",
  OTHER: "Other",
};

export const DATA_RESIDENCY_LABEL: Record<string, string> = {
  DEFAULT: "Platform default",
  EU: "European Union",
  US: "United States",
  AFRICA: "Africa",
  ASIA: "Asia",
};

export const DATA_RESIDENCY_OPTIONS: readonly string[] = ["DEFAULT", "EU", "US", "AFRICA", "ASIA"];

export const REPORT_FREQUENCY_LABEL: Record<string, string> = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  SEMI_ANNUAL: "Semi-annual",
  ANNUAL: "Annual",
  FINAL: "Final",
  CUSTOM: "Custom",
};

export const REPORT_FREQUENCY_OPTIONS: readonly string[] = [
  "MONTHLY",
  "QUARTERLY",
  "SEMI_ANNUAL",
  "ANNUAL",
  "FINAL",
  "CUSTOM",
];

export const LOGFRAME_LEVEL_LABEL: Record<string, string> = {
  GOAL: "Goal",
  OUTCOME: "Outcome",
  OUTPUT: "Output",
  ACTIVITY: "Activity",
};

export const LOGFRAME_LEVEL_OPTIONS: readonly string[] = ["GOAL", "OUTCOME", "OUTPUT", "ACTIVITY"];

export const INDICATOR_TYPE_LABEL: Record<string, string> = {
  NUMBER: "Number",
  PERCENTAGE: "Percentage",
  YES_NO: "Yes / No",
  TEXT: "Text",
  RATIO: "Ratio",
  CURRENCY: "Currency",
  CUSTOM: "Custom",
};

export const INDICATOR_TYPE_OPTIONS: readonly string[] = [
  "NUMBER",
  "PERCENTAGE",
  "YES_NO",
  "TEXT",
  "RATIO",
  "CURRENCY",
  "CUSTOM",
];

export const SECTION_INPUT_TYPE_LABEL: Record<string, string> = {
  NARRATIVE: "Narrative",
  TABLE: "Table",
  ANNEX: "Annex",
  INDICATOR_TABLE: "Indicator table",
  COMPLIANCE: "Compliance",
};

export const SECTION_INPUT_TYPE_OPTIONS: readonly string[] = [
  "NARRATIVE",
  "TABLE",
  "ANNEX",
  "INDICATOR_TABLE",
  "COMPLIANCE",
];

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  PROJECT_MANAGER: "Project Manager",
  ME_OFFICER: "M&E Officer",
  GRANTS_OFFICER: "Grants Officer",
  FIELD_OFFICER: "Field Officer",
  COMPLIANCE_OFFICER: "Compliance Officer",
  VIEWER: "Viewer",
};

export const ROLE_OPTIONS: readonly string[] = Object.keys(ROLE_LABEL);

export const REPORT_TYPE_LABEL: Record<string, string> = {
  MONTHLY: "Monthly report",
  QUARTERLY: "Quarterly report",
  ANNUAL: "Annual report",
  FINAL: "Final report",
  ACTIVITY: "Activity report",
  SITUATION: "Situation report",
  CUSTOM: "Custom report",
};

export const REPORT_TYPE_OPTIONS: readonly string[] = ["MONTHLY", "QUARTERLY", "ANNUAL", "FINAL", "ACTIVITY", "SITUATION", "CUSTOM"];

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

export const EVIDENCE_VERIFICATION_LABEL: Record<string, string> = {
  UPLOADED: "Uploaded",
  AI_TAGGED: "AI tagged",
  PENDING_REVIEW: "Pending review",
  VERIFIED: "Verified",
  NEEDS_CORRECTION: "Needs correction",
  REJECTED: "Rejected",
  ARCHIVED: "Archived",
  UNVERIFIED: "Unverified",
};

export const CONFIDENTIALITY_LABEL: Record<string, string> = {
  PUBLIC: "Public",
  INTERNAL: "Internal",
  SENSITIVE: "Sensitive",
  HIGHLY_SENSITIVE: "Highly sensitive",
};

export const ACTIVITY_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  NEEDS_REVISION: "Needs revision",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
};

export const INDICATOR_VERIFICATION_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  VERIFIED: "Verified",
  NEEDS_CORRECTION: "Needs correction",
  REJECTED: "Rejected",
};

export const TAG_FIELD_LABEL: Record<string, string> = {
  evidenceType: "Evidence type",
  activityId: "Activity",
  indicatorId: "Indicator",
  reportingPeriodId: "Reporting period",
  location: "Location",
};

export const TAG_CONFIDENCE_LABEL: Record<string, string> = {
  HIGH: "High confidence",
  MEDIUM: "Medium confidence",
  LOW: "Low confidence",
};

export const EVIDENCE_TYPE_OPTIONS: readonly string[] = Object.keys(EVIDENCE_TYPE_LABEL);

export const EVIDENCE_VERIFICATION_OPTIONS: readonly string[] = [
  "UPLOADED",
  "AI_TAGGED",
  "PENDING_REVIEW",
  "VERIFIED",
  "NEEDS_CORRECTION",
  "REJECTED",
  "ARCHIVED",
];

export const CONFIDENTIALITY_OPTIONS: readonly string[] = ["PUBLIC", "INTERNAL", "SENSITIVE", "HIGHLY_SENSITIVE"];

export const SECTION_STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "Not started",
  DRAFTED: "Drafted",
  NEEDS_EVIDENCE: "Needs evidence",
  NEEDS_REVIEW: "Needs review",
  APPROVED: "Approved",
};

export const REPORT_DRAFT_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  EXPORTED: "Exported",
  SUBMITTED: "Submitted",
};

export const CHECKLIST_ITEM_TYPE_LABEL: Record<string, string> = {
  MISSING_EVIDENCE: "Missing evidence",
  INCOMPLETE_EVIDENCE_METADATA: "Incomplete evidence metadata",
  UNVERIFIED_INDICATOR: "Unverified indicator",
  UNSUPPORTED_REPORT_CLAIM: "Unsupported report claim",
  MISSING_ANNEX: "Missing annex",
  MISSING_PROCUREMENT_DOCUMENT: "Missing procurement document",
  MISSING_APPROVAL: "Missing approval",
  MISSING_DISAGGREGATION: "Missing disaggregation",
  LATE_ACTIVITY_UPDATE: "Late activity update",
  SENSITIVE_DATA_WARNING: "Sensitive data warning",
  UNREVIEWED_AI_OUTPUT: "Unreviewed AI output",
};

export const CHECKLIST_STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  ACCEPTED_RISK: "Risk accepted",
  NOT_APPLICABLE: "Not applicable",
};

export const EXPORT_TYPE_LABEL: Record<string, string> = {
  WORD: "Word document",
  PDF: "PDF report",
  EXCEL_INDICATORS: "Indicator spreadsheet",
  EVIDENCE_CHECKLIST: "Evidence checklist",
  EVIDENCE_PACK_ZIP: "Evidence package (ZIP)",
};

export const EXPORT_TYPE_OPTIONS: readonly string[] = ["WORD", "PDF", "EXCEL_INDICATORS", "EVIDENCE_CHECKLIST", "EVIDENCE_PACK_ZIP"];

export const CAPABILITY_LABEL: Record<string, string> = {
  "project.create": "Create projects",
  "project.edit": "Edit projects",
  "org.manage": "Manage organization settings",
  "team.invite": "Invite team members",
  "team.manage": "Manage team roles",
  "template.create": "Create donor templates",
  "template.edit": "Edit donor templates",
  "logframe.edit": "Edit logframes and indicators",
  "indicator.update": "Record indicator data",
  "indicator.verify": "Verify indicator data",
  "activity.create": "Submit activity updates",
  "activity.review": "Review activity updates",
  "evidence.upload": "Upload evidence",
  "evidence.verify": "Verify evidence",
  "reporting.create": "Create reporting periods",
  "reporting.edit": "Edit report sections",
  "report.generate": "Generate report drafts",
  "report.approve": "Approve reports",
  "checklist.resolve": "Resolve compliance items",
  "checklist.manage": "Manage compliance",
  "export.create": "Create exports",
  "audit.view": "View audit log",
  "settings.view": "View settings",
};
