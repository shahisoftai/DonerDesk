import type {
  GenerateReportDraftInput,
  IReportDraftRepository,
  IReportingPeriodRepository,
  IReportRevisionRepository,
  IReportSectionRepository,
} from "@donordesk/application";
import type { ReportPlanSection, TenantId } from "@donordesk/domain";
import type { AiReporterPriorNarrative } from "./ai-reporter-worker.js";

/**
 * Supplies approved historical narrative from previous reporting periods so the
 * writer can articulate what changed and why, and remain consistent with prior
 * approved reports. This is the "historical report intelligence" layer.
 */
export interface IPriorPeriodService {
  fetch(
    input: GenerateReportDraftInput,
    section: ReportPlanSection,
  ): Promise<AiReporterPriorNarrative[]>;
}

/**
 * Fetches the most recently approved draft for each previous period of the same
 * project, and for the current section title, returns its current approved
 * revision content. Always degrades to an empty list rather than failing the
 * generation pipeline when no prior data exists or repositories are absent.
 */
export class DeterministicPriorPeriodService implements IPriorPeriodService {
  constructor(
    private readonly periods: IReportingPeriodRepository,
    private readonly drafts: IReportDraftRepository,
    private readonly sections: IReportSectionRepository,
    private readonly revisions: IReportRevisionRepository,
    private readonly limit = 3,
  ) {}

  async fetch(
    input: GenerateReportDraftInput,
    section: ReportPlanSection,
  ): Promise<AiReporterPriorNarrative[]> {
    try {
      const projectId = input.reportPlan.projectId;
      const reportingPeriodId = input.reportPlan.reportingPeriodId;
      const tenantId = input.reportPlan.tenantId as unknown as TenantId;
      if (!projectId || !reportingPeriodId || !tenantId) return [];

      const previous = await this.periods.findPreviousPeriods(projectId, reportingPeriodId, tenantId, this.limit);
      if (!previous.ok) return [];

      const narratives: AiReporterPriorNarrative[] = [];
      for (const period of previous.value) {
        const drafts = await this.drafts.findByReportingPeriod(period.id, tenantId);
        if (!drafts.ok) continue;
        // Prefer the most recent approved/submitted draft for this period.
        const approved = drafts.value.find((d) => d.status === "APPROVED" || d.status === "SUBMITTED");
        const draft = approved ?? drafts.value[0];
        if (!draft) continue;

        const sections = await this.sections.findByReportDraft(draft.id, tenantId);
        if (!sections.ok) continue;
        const match = sections.value.find((s) => normalizeTitle(s.sectionTitle) === normalizeTitle(section.title));
        if (!match) continue;

        const revision = await this.revisions.findCurrentForSection(match.id, tenantId);
        if (!revision.ok || !revision.value) continue;
        const content = revision.value.content.trim();
        if (!content) continue;

        narratives.push({
          periodLabel: period.reportType ?? "previous period",
          content,
          sourceSectionTitle: match.sectionTitle,
        });
        if (narratives.length >= this.limit) break;
      }
      return narratives;
    } catch {
      return [];
    }
  }
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/\s+/g, " ").trim();
}
