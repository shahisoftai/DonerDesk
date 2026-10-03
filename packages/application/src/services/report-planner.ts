import type { Result, ReportPlan, ReportPlanSection, ReportingRequirement } from "@donordesk/domain";
import { createReportPlan, DomainError, normalizeEvidence, reportableSections, stampPlanSectionsWithRequirements, type TemplateSection } from "@donordesk/domain";
import type { IReportPlanner, ReportingProfileSnapshot } from "../ports/reporting.js";
import type { IIdGenerator } from "../ports/core.js";

/**
 * Deterministic, inference-based planner. Generates a ReportPlan from the
 * template sections and the reporting profile snapshot without any LLM call.
 * The LLM-based planner is a later swap point that satisfies the same port.
 *
 * Quality remediation WS1: when a resolved requirement snapshot is supplied,
 * sections are stamped via the pure domain mapper with matched
 * `requirementKeys`, `mandatoryQuestions`, and `requirementGuidance` so the
 * narrators draft against the donor's own requirements. Without a snapshot
 * the output is byte-identical to the pre-remediation planner.
 */
export class InferredReportPlanner implements IReportPlanner {
  constructor(private readonly ids: IIdGenerator) {}

  async plan(input: {
    reportingPeriodId: string;
    projectId: string;
    tenantId: { toString(): string };
    templateSections: TemplateSection[];
    templateVersion: number;
    profileVersion: number;
    reportingProfileSnapshot: ReportingProfileSnapshot;
    requirements?: ReportingRequirement[];
  }): Promise<Result<ReportPlan, DomainError>> {
    let sections: ReportPlanSection[] = reportableSections(input.templateSections).map((s) =>
      toPlanSection(s, input.reportingProfileSnapshot.sectionOverrides[s.id]),
    );

    if (sections.length === 0) {
      return {
        ok: false,
        error: DomainError.reportGateBlocked(
          "No report sections are defined. Attach a donor template (or an explicit report structure) before generating a report.",
        ),
      };
    }

    if (input.requirements && input.requirements.length > 0) {
      sections = stampPlanSectionsWithRequirements(sections, input.requirements);
    }

    const plan = createReportPlan({
      id: this.ids.generate(),
      tenantId: input.tenantId.toString(),
      projectId: input.projectId,
      reportingPeriodId: input.reportingPeriodId,
      sections,
      style: {
        tone: input.reportingProfileSnapshot.tone,
        language: input.reportingProfileSnapshot.language,
        formattingRules: input.reportingProfileSnapshot.formattingRules,
      },
      generatedBy: "INFERRED",
    });
    return { ok: true, value: plan };
  }
}

/**
 * Maps one reviewed template section to the plan section the narrators draft.
 * Everything the donor asked for (instructions, questions, evidence, tables,
 * limits) is carried through; the organisation's guidance travels separately.
 */
export function toPlanSection(s: TemplateSection, override?: { min?: number; max?: number }): ReportPlanSection {
  const min = override?.min ?? s.minWords;
  const max = override?.max ?? s.maxWords;
  const questions = new Set((s.mandatoryQuestions ?? []).map((q) => q.trim().toLowerCase()));
  const fallback = s.instructions?.trim() || questions.has(s.description.trim().toLowerCase()) ? undefined : s.description;
  const donorInstructions = (s.instructions ?? fallback ?? "").trim();
  return {
    templateSectionId: s.id,
    title: s.title,
    ...(s.canonicalTitle && s.canonicalTitle !== s.title ? { canonicalTitle: s.canonicalTitle } : {}),
    inputType: s.inputType,
    required: s.required,
    wordLimit: min !== undefined || max !== undefined ? { min, max } : undefined,
    mandatoryQuestions: [...(s.mandatoryQuestions ?? [])],
    evidenceNeeds: normalizeEvidence(s.evidenceNeeded),
    relatedLogframeElement: s.relatedLogframeElement,
    ...(donorInstructions ? { donorInstructions } : {}),
    ...(s.requiredTables?.length ? { requiredTables: s.requiredTables.map((t) => ({ ...t, columns: [...t.columns] })) } : {}),
    ...(s.authorInstructions ? { authorInstructions: s.authorInstructions } : {}),
    ...(s.pageLimit !== undefined ? { pageLimit: s.pageLimit } : {}),
    ...(s.numbering ? { numbering: s.numbering } : {}),
    level: s.level ?? 1,
    ...(s.parentId ? { parentTemplateSectionId: s.parentId } : {}),
  };
}
