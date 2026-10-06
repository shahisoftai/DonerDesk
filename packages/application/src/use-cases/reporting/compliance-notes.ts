import type { Result, ReportingPeriod } from "@donordesk/domain";
import { DomainError, complianceSectionsOf, comparableReportTypes, periodComparability, selectComparablePeriods } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportingPeriodRepository } from "../../ports/reporting.js";
import type { IReportingProfileRepository } from "../../ports/setup.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { ReportGenerationContextBuilder } from "../../services/report-generation-context.js";

export interface ComplianceNoteRow {
  key: string;
  title: string;
  /** This period's statement ("" when none yet). */
  note: string;
  /** The same section's statement in the previous comparable report, for "same as last month". */
  previousNote?: string;
  /** The project's standing statement for this section (a policy that holds every period). */
  standingStatement?: string;
}

export interface ComplianceNotesView {
  sections: ComplianceNoteRow[];
  /** Sections still without a statement: each is a to-do, not a silent "no record" in the report. */
  missingCount: number;
}

/** The compliance sections of the period's donor template with their statements. */
export class GetComplianceNotesHandler {
  constructor(
    private readonly context: Pick<ReportGenerationContextBuilder, "loadBase">,
    private readonly periods: IReportingPeriodRepository,
    private readonly profiles?: IReportingProfileRepository,
  ) {}

  async handle(ctx: AuthenticatedContext, periodId: string): Promise<Result<ComplianceNotesView, DomainError>> {
    const base = await this.context.loadBase(ctx, periodId, "pinned");
    if (!base.ok) return base;
    const { period, templateSections } = base.value;
    const wanted = complianceSectionsOf(templateSections);
    if (wanted.length === 0) return { ok: true, value: { sections: [], missingCount: 0 } };

    const previous = await this.previousPeriod(ctx, period);
    if (!previous.ok) return previous;
    const profile = this.profiles ? await this.profiles.findByProject(period.projectId, ctx.tenant.tenantId) : undefined;
    if (profile && !profile.ok) return profile;
    const standing = profile?.value?.standingStatements ?? {};
    const notes = period.storyContext.sectionNotes ?? {};
    const before = previous.value?.storyContext.sectionNotes ?? {};
    const sections = wanted.map(({ key, title }): ComplianceNoteRow => ({
      key,
      title,
      note: notes[key] ?? "",
      ...(before[key] ? { previousNote: before[key] } : {}),
      ...(standing[key] ? { standingStatement: standing[key] } : {}),
    }));
    return { ok: true, value: { sections, missingCount: sections.filter((s) => !s.note.trim()).length } };
  }

  private async previousPeriod(ctx: AuthenticatedContext, period: ReportingPeriod): Promise<Result<ReportingPeriod | undefined, DomainError>> {
    const comparability = periodComparability(period.reportType, period.scope);
    if (!comparability) return { ok: true, value: undefined };
    const found = await this.periods.findPreviousPeriods(period.projectId, period.id, ctx.tenant.tenantId, 8, { reportTypes: comparableReportTypes(comparability) });
    if (!found.ok) return found;
    return { ok: true, value: selectComparablePeriods(found.value, comparability, 1)[0] };
  }
}

/** Saves one compliance statement and nothing else; refuses a key that is not one of the period's compliance sections. */
export class SaveSectionNoteHandler {
  constructor(
    private readonly context: Pick<ReportGenerationContextBuilder, "loadBase">,
    private readonly periods: IReportingPeriodRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, periodId: string, input: { key: string; note: string }): Promise<Result<{ missingCount: number }, DomainError>> {
    const base = await this.context.loadBase(ctx, periodId, "pinned");
    if (!base.ok) return base;
    const { period, templateSections } = base.value;
    const wanted = complianceSectionsOf(templateSections);
    if (!wanted.some((s) => s.key === input.key)) {
      return { ok: false, error: DomainError.validation("This section does not take a statement of its own") };
    }
    period.setSectionNote(input.key, input.note);
    const saved = await this.periods.update(period);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "reporting_period.section_note_saved",
      entityType: "reporting_period",
      entityId: periodId,
      projectId: period.projectId,
      newValue: JSON.stringify({ key: input.key, length: input.note.trim().length }),
    });
    const notes = period.storyContext.sectionNotes ?? {};
    return { ok: true, value: { missingCount: wanted.filter((s) => !notes[s.key]).length } };
  }
}
