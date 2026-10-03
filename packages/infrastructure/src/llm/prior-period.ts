import type {
  GenerateReportDraftInput,
  IReportDraftRepository,
  IReportingPeriodRepository,
  IReportRevisionRepository,
  IReportSectionRepository,
} from "@donordesk/application";
import type { ReportPlanSection, ReportSection, ReportingPeriod, TenantId } from "@donordesk/domain";
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
  /**
   * Previous periods' sections, loaded once per report plan. Every section of
   * a draft shares one `ReportPlan` object, so this turns the per-section walk
   * (periods → drafts → sections, ~7 queries) into one walk per draft. Keyed
   * weakly, so it lives exactly as long as the generation run's plan.
   */
  private readonly history = new WeakMap<object, Promise<PriorPeriodSections[]>>();

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
      const tenantId = input.reportPlan.tenantId as unknown as TenantId;
      if (!input.reportPlan.projectId || !input.reportPlan.reportingPeriodId || !tenantId) return [];

      let history = this.history.get(input.reportPlan);
      if (!history) {
        history = this.loadHistory(input).catch(() => []);
        this.history.set(input.reportPlan, history);
      }

      const narratives: AiReporterPriorNarrative[] = [];
      for (const { period, sections } of await history) {
        const match = sections.find((s) => normalizeTitle(s.sectionTitle) === normalizeTitle(section.title));
        if (!match) continue;

        // The current revision is read per section: it is the one query that
        // depends on the section being drafted.
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

  private async loadHistory(input: GenerateReportDraftInput): Promise<PriorPeriodSections[]> {
    const tenantId = input.reportPlan.tenantId as unknown as TenantId;
    const previous = await this.periods.findPreviousPeriods(input.reportPlan.projectId, input.reportPlan.reportingPeriodId, tenantId, this.limit);
    if (!previous.ok) return [];

    const history: PriorPeriodSections[] = [];
    for (const period of previous.value) {
      const drafts = await this.drafts.findByReportingPeriod(period.id, tenantId);
      if (!drafts.ok) continue;
      // Prefer the most recent approved/submitted draft for this period.
      const approved = drafts.value.find((d) => d.status === "APPROVED" || d.status === "SUBMITTED");
      const draft = approved ?? drafts.value[0];
      if (!draft) continue;

      const sections = await this.sections.findByReportDraft(draft.id, tenantId);
      if (!sections.ok) continue;
      history.push({ period, sections: sections.value });
    }
    return history;
  }
}

type PriorPeriodSections = { period: ReportingPeriod; sections: ReportSection[] };

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/\s+/g, " ").trim();
}
