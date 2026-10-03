import type { RequiredTable, SectionInputType } from "../templates/template-section.js";
import type { ProfileTone } from "../projects/reporting-profile.js";

/**
 * A report plan defines the sections that must be drafted, their word limits,
 * mandatory questions, and evidence needs. Plans are generated automatically
 * and only surfaced for editing when a user opens them.
 */
export interface ReportPlanSection {
  templateSectionId: string;
  title: string;
  /** English title for role detection when `title` is translated (blueprint sections). */
  canonicalTitle?: string;
  inputType: SectionInputType;
  required: boolean;
  wordLimit?: { min?: number; max?: number };
  mandatoryQuestions: string[];
  evidenceNeeds: string[];
  relatedLogframeElement?: string;
  /**
   * Resolved reporting requirement keys this section satisfies (Phase 5). Populated
   * when the plan is produced against a resolved requirement snapshot; consumed by
   * the requirement evaluator for exact-match coverage instead of title guessing.
   */
  requirementKeys?: string[];
  /**
   * Donor requirement guidance for this section (quality remediation WS1).
   * Stamped from the resolved requirement snapshot by the planner; consumed by
   * the narrators as a "Donor Requirement Guidance" prompt block. Optional so
   * plans produced without a requirement snapshot are unchanged.
   */
  requirementGuidance?: string[];
  /** Donor's own writing instructions for this section, from the template. */
  donorInstructions?: string;
  /** Tables the donor requires in this section (shape only). */
  requiredTables?: RequiredTable[];
  /** The organisation's extra guidance for the AI writer. */
  authorInstructions?: string;
  pageLimit?: number;
  /** Donor numbering ("2.1") and heading depth, for workspace layout. */
  numbering?: string;
  level?: number;
  parentTemplateSectionId?: string;
}

const SYNTHESIS_TITLE_RE = /executive summary|summary of (?:results|progress|achievements)|key (?:results|highlights)|conclusion/i;

/**
 * A synthesis section (executive summary, conclusion) summarises the rest of
 * the report, so it must be drafted after the other sections and from their
 * drafted text — otherwise it can contradict or omit what they say.
 */
export function isSynthesisSection(section: { title: string; canonicalTitle?: string; templateSectionId?: string | null }): boolean {
  return SYNTHESIS_TITLE_RE.test(classificationTitle(section)) || /^bp:[a-z_]+:(exec|conclusion)$/.test(section.templateSectionId ?? "");
}

/**
 * The title that section-role rules match against: the English canonical title
 * when the displayed title is a translation, else the title itself.
 */
export function classificationTitle(section: { title: string; canonicalTitle?: string }): string {
  return section.canonicalTitle ?? section.title;
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
    for (const question of section.mandatoryQuestions ?? []) {
      if (typeof question !== "string" || !question.trim()) {
        throw new Error("Plan section mandatoryQuestions must contain non-empty strings");
      }
    }
    for (const guidance of section.requirementGuidance ?? []) {
      if (typeof guidance !== "string" || !guidance.trim()) {
        throw new Error("Plan section requirementGuidance must contain non-empty strings");
      }
    }
    for (const key of section.requirementKeys ?? []) {
      if (typeof key !== "string" || !key.trim()) {
        throw new Error("Plan section requirementKeys must contain non-empty strings");
      }
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
