import type { Result, ReportPlan } from "@donordesk/domain";
import { createReportPlan, DomainError } from "@donordesk/domain";
import type { IReportPlanner, ReportingProfileSnapshot } from "../ports/reporting.js";
import type { IIdGenerator } from "../ports/core.js";

/**
 * Deterministic, inference-based planner. Generates a ReportPlan from the
 * template sections and the reporting profile snapshot without any LLM call.
 * The LLM-based planner is a later swap point that satisfies the same port.
 */
export class InferredReportPlanner implements IReportPlanner {
  constructor(private readonly ids: IIdGenerator) {}

  async plan(input: {
    reportingPeriodId: string;
    projectId: string;
    tenantId: { toString(): string };
    templateSections: Array<{
      id: string;
      title: string;
      description: string;
      inputType: string;
      required: boolean;
      evidenceNeeded: string;
      relatedLogframeElement?: string;
      minWords?: number;
      maxWords?: number;
    }>;
    templateVersion: number;
    profileVersion: number;
    reportingProfileSnapshot: ReportingProfileSnapshot;
  }): Promise<Result<ReportPlan, DomainError>> {
    const sections = input.templateSections.map((s) => {
      const override = input.reportingProfileSnapshot.sectionOverrides[s.id];
      const min = override?.min ?? s.minWords;
      const max = override?.max ?? s.maxWords;
      return {
        templateSectionId: s.id,
        title: s.title,
        inputType: s.inputType as ReportPlan["sections"][number]["inputType"],
        required: s.required,
        wordLimit: min !== undefined || max !== undefined ? { min, max } : undefined,
        mandatoryQuestions: [],
        evidenceNeeds: s.evidenceNeeded ? [s.evidenceNeeded] : [],
        relatedLogframeElement: s.relatedLogframeElement,
      };
    });

    if (sections.length === 0) {
      return {
        ok: false,
        error: DomainError.reportGateBlocked(
          "No report sections are defined. Attach a donor template (or an explicit report structure) before generating a report.",
        ),
      };
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
