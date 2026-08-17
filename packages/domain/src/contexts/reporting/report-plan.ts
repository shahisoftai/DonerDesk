import type { SectionInputType } from "../templates/template-section.js";
import type { ProfileTone } from "../projects/reporting-profile.js";

/**
 * A report plan defines the sections that must be drafted, their word limits,
 * mandatory questions, and evidence needs. Plans are generated automatically
 * and only surfaced for editing when a user opens them.
 */
export interface ReportPlanSection {
  templateSectionId: string;
  title: string;
  inputType: SectionInputType;
  required: boolean;
  wordLimit?: { min?: number; max?: number };
  mandatoryQuestions: string[];
  evidenceNeeds: string[];
  relatedLogframeElement?: string;
}

export interface ReportPlanStyle {
  tone: ProfileTone;
  language: string;
  formattingRules: string[];
}

export interface ReportPlan {
  id: string;
  tenantId: string;
  projectId: string;
  reportingPeriodId: string;
  version: number;
  sections: ReportPlanSection[];
  style: ReportPlanStyle;
  generatedBy: "INFERRED" | "LLM" | "MANUAL";
}

export function createReportPlan(input: {
  id: string;
  tenantId: string;
  projectId: string;
  reportingPeriodId: string;
  sections: ReportPlanSection[];
  style: ReportPlanStyle;
  generatedBy?: ReportPlan["generatedBy"];
}): ReportPlan {
  if (!input.sections || input.sections.length === 0) {
    throw new Error("A report plan requires at least one section");
  }
  for (const section of input.sections) {
    if (!section.templateSectionId || !section.title) {
      throw new Error("Every plan section requires a templateSectionId and title");
    }
    const { min, max } = section.wordLimit ?? {};
    if (min !== undefined && (!Number.isInteger(min) || min < 0)) {
      throw new Error("Plan section wordLimit.min must be a non-negative integer");
    }
    if (max !== undefined && (!Number.isInteger(max) || max <= 0)) {
      throw new Error("Plan section wordLimit.max must be a positive integer");
    }
    if (min !== undefined && max !== undefined && min > max) {
      throw new Error("Plan section wordLimit.max must be at least min");
    }
  }
  return {
    id: input.id,
    tenantId: input.tenantId,
    projectId: input.projectId,
    reportingPeriodId: input.reportingPeriodId,
    version: 1,
    sections: input.sections,
    style: input.style,
    generatedBy: input.generatedBy ?? "INFERRED",
  };
}
