import { DomainError } from "../../core/domain-error.js";
import type { ChecklistItemType, Severity } from "./checklist-item.js";

/**
 * Baseline compliance checklist templates keyed by report type. These are the
 * default items every reporting period of a given type starts with; the
 * detector may append further items from live evidence/indicator/annex data.
 * Config-driven so adding a new report type is a data-only change (OCP).
 */

export interface ChecklistTemplateItem {
  type: ChecklistItemType;
  title: string;
  description: string;
  severity: Severity;
}

export interface ChecklistTemplate {
  reportType: string;
  items: ChecklistTemplateItem[];
}

const BASELINE_ITEMS: ChecklistTemplateItem[] = [
  {
    type: "MISSING_DISAGGREGATION",
    title: "Beneficiary data disaggregated",
    description: "Confirm beneficiary counts are disaggregated by sex, age, and disability before submission.",
    severity: "MEDIUM",
  },
  {
    type: "UNREVIEWED_AI_OUTPUT",
    title: "AI-generated content reviewed",
    description: "All AI-generated report content must be reviewed and confirmed by a human before approval.",
    severity: "MEDIUM",
  },
  {
    type: "SENSITIVE_DATA_WARNING",
    title: "Sensitive data handling confirmed",
    description: "Confirm any sensitive or confidential data referenced in the report is redacted appropriately.",
    severity: "HIGH",
  },
];

const QUARTERLY_ITEMS: ChecklistTemplateItem[] = [
  ...BASELINE_ITEMS,
  {
    type: "LATE_ACTIVITY_UPDATE",
    title: "Quarterly activity summary submitted",
    description: "At least one consolidated activity update should be submitted for the quarter.",
    severity: "HIGH",
  },
];

const ANNUAL_ITEMS: ChecklistTemplateItem[] = [
  ...BASELINE_ITEMS,
  {
    type: "LATE_ACTIVITY_UPDATE",
    title: "Annual activity summary submitted",
    description: "Consolidated activity updates covering the full year should be submitted.",
    severity: "HIGH",
  },
  {
    type: "MISSING_PROCUREMENT_DOCUMENT",
    title: "Annual procurement summary available",
    description: "Donors often require a summary of procurements over the reporting year. Confirm availability.",
    severity: "MEDIUM",
  },
];

const FINAL_ITEMS: ChecklistTemplateItem[] = [
  ...BASELINE_ITEMS,
  {
    type: "MISSING_APPROVAL",
    title: "Final report sign-off obtained",
    description: "The final report requires documented sign-off from the responsible project manager.",
    severity: "CRITICAL",
  },
  {
    type: "MISSING_PROCUREMENT_DOCUMENT",
    title: "Final procurement and expenditure records available",
    description: "Donors require final expenditure records and procurement documentation for close-out.",
    severity: "HIGH",
  },
];

const MONTHLY_ITEMS: ChecklistTemplateItem[] = [...BASELINE_ITEMS];

const ACTIVITY_ITEMS: ChecklistTemplateItem[] = [
  {
    type: "LATE_ACTIVITY_UPDATE",
    title: "Activity update submitted",
    description: "A detailed activity update is expected for this reporting type.",
    severity: "HIGH",
  },
];

export const REPORT_TYPE_CHECKLIST_TEMPLATES: Record<string, ChecklistTemplate> = {
  MONTHLY: { reportType: "MONTHLY", items: MONTHLY_ITEMS },
  QUARTERLY: { reportType: "QUARTERLY", items: QUARTERLY_ITEMS },
  SEMI_ANNUAL: { reportType: "SEMI_ANNUAL", items: QUARTERLY_ITEMS },
  ANNUAL: { reportType: "ANNUAL", items: ANNUAL_ITEMS },
  FINAL: { reportType: "FINAL", items: FINAL_ITEMS },
  ACTIVITY: { reportType: "ACTIVITY", items: ACTIVITY_ITEMS },
  SITUATION: { reportType: "SITUATION", items: BASELINE_ITEMS },
  CUSTOM: { reportType: "CUSTOM", items: BASELINE_ITEMS },
};

export function checklistTemplateForReportType(reportType: string): ChecklistTemplate {
  const template = REPORT_TYPE_CHECKLIST_TEMPLATES[reportType];
  if (!template) {
    throw DomainError.notFound("ChecklistTemplate", reportType);
  }
  return { reportType: template.reportType, items: template.items.map((i) => ({ ...i })) };
}
