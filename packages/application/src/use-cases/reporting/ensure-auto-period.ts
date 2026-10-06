import type { Result, DomainError, TenantId } from "@donordesk/domain";
import { suggestPeriodDates, suggestDeadline, DEFAULT_DEADLINE_OFFSET_DAYS, type ReportType } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IProjectRepository } from "../../ports/projects.js";
import type { IReportingProfileRepository } from "../../ports/setup.js";
import type { IReportingPeriodRepository } from "../../ports/reporting.js";
import type { CreateReportingPeriodHandler } from "./create-reporting-period.js";

/** `Project.reportingFrequency` values with a 1:1 `ReportingPeriod.reportType` — SEMI_ANNUAL and CUSTOM have none, so auto-creation is skipped for them. */
const AUTO_CREATE_REPORT_TYPE: Partial<Record<string, ReportType>> = {
  MONTHLY: "MONTHLY",
  QUARTERLY: "QUARTERLY",
  ANNUAL: "ANNUAL",
  FINAL: "FINAL",
};

/**
 * Best-effort, idempotent "auto-create reporting periods": called whenever a
 * project's Reports page is opened (no cron/worker needed). Creates at most
 * one period per call — the next one due — so a project that hasn't been
 * visited in a while backfills one period per visit rather than all at once.
 *
 * A period only becomes "due" once its window has fully elapsed (its end
 * date has passed), so e.g. a monthly period appears once that month is
 * over, not on day one of it. Silently does nothing (never surfaces an
 * error) when: the profile has auto-creation off, the project's reporting
 * frequency has no safe report-type mapping, the project's duration is
 * already fully covered, the next period isn't due yet, or the underlying
 * create call fails for any reason (e.g. the project isn't ready) — this is
 * automation on top of the normal flow, not a user-initiated action.
 */
export class EnsureAutoPeriodHandler {
  constructor(
    private readonly projects: IProjectRepository,
    private readonly profiles: IReportingProfileRepository,
    private readonly periods: IReportingPeriodRepository,
    private readonly createPeriod: CreateReportingPeriodHandler,
  ) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<{ created: boolean; periodId?: string }, DomainError>> {
    const tenantId: TenantId = ctx.tenant.tenantId;

    const projectResult = await this.projects.findById(projectId, tenantId);
    if (!projectResult.ok) return projectResult;
    const project = projectResult.value;
    if (!project) return { ok: true, value: { created: false } };

    const profileResult = await this.profiles.findByProject(projectId, tenantId);
    if (!profileResult.ok) return profileResult;
    const profile = profileResult.value;
    if (!profile?.autoPeriodCreation) return { ok: true, value: { created: false } };

    const reportType = AUTO_CREATE_REPORT_TYPE[project.reportingFrequency];
    if (!reportType) return { ok: true, value: { created: false } };

    // A cancelled period still occupies its dates: cancelling a month must not make the next page load create it again.
    const existingResult = await this.periods.findByProject(projectId, tenantId, { includeCancelled: true });
    if (!existingResult.ok) return existingResult;
    const existingEnds = existingResult.value.map((p) => p.duration.end);

    const suggestion = suggestPeriodDates(reportType, project.duration.start, project.duration.end, existingEnds);
    if (!suggestion) return { ok: true, value: { created: false } };
    if (new Date(suggestion.endDate) > new Date()) return { ok: true, value: { created: false } };
    // The block that reaches the project's end is the closing (final) report's period: it is created through the
    // closing-report steps (`planCadencePeriods` shows it as "closing"). Auto-creating it as a regular period would
    // leave no room for the closing report.
    if (reportType !== "FINAL" && new Date(suggestion.endDate).getTime() === new Date(project.duration.end).getTime()) {
      return { ok: true, value: { created: false } };
    }

    const offset = profile.deadlineOffsetDays ?? DEFAULT_DEADLINE_OFFSET_DAYS;
    const isoDate = (dateOnly: string) => new Date(`${dateOnly}T00:00:00.000Z`).toISOString();

    const created = await this.createPeriod.handle(ctx, {
      projectId,
      reportType,
      startDate: isoDate(suggestion.startDate),
      endDate: isoDate(suggestion.endDate),
      deadline: isoDate(suggestDeadline(suggestion.endDate, offset)),
    });
    if (!created.ok) return { ok: true, value: { created: false } };
    return { ok: true, value: { created: true, periodId: created.value.id } };
  }
}
