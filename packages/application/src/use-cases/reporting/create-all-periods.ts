import type { Result } from "@donordesk/domain";
import { DomainError, DEFAULT_DEADLINE_OFFSET_DAYS, planCadencePeriods, suggestDeadline, type CadencePlan, type ReportType } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IProjectRepository } from "../../ports/projects.js";
import type { IReportingProfileRepository } from "../../ports/setup.js";
import type { IReportingPeriodRepository } from "../../ports/reporting.js";

/** What creates one period; the handler repeats it so every period rule (setup, overlap, bounds, template) still applies. */
export interface PeriodCreator {
  handle(ctx: AuthenticatedContext, input: { projectId: string; reportType: ReportType; startDate: string; endDate: string; deadline: string }): Promise<Result<{ id: string }, DomainError>>;
}

/** The project reporting frequencies that map to a cadence period type. The rest (semi-annual, annual, custom) are roll-ups or free-form. */
const CADENCE_TYPE: Partial<Record<string, ReportType>> = { MONTHLY: "MONTHLY", QUARTERLY: "QUARTERLY" };

export interface PeriodsPlanView {
  reportType: ReportType | null;
  plan: CadencePlan;
  /** Why nothing is planned, when that is the case. */
  note?: string;
}

export interface CreateAllResult {
  created: Array<{ id: string; startDate: string; endDate: string }>;
  failed: Array<{ startDate: string; endDate: string; error: string }>;
}

const iso = (dateOnly: string) => new Date(`${dateOnly}T00:00:00.000Z`).toISOString();

/** Shows and creates every cadence period a project still needs, from its own dates. */
export class CreateAllPeriodsHandler {
  constructor(
    private readonly projects: IProjectRepository,
    private readonly profiles: IReportingProfileRepository,
    private readonly periods: IReportingPeriodRepository,
    private readonly createPeriod: PeriodCreator,
  ) {}

  async preview(ctx: AuthenticatedContext, projectId: string): Promise<Result<PeriodsPlanView, DomainError>> {
    const project = await this.projects.findById(projectId, ctx.tenant.tenantId);
    if (!project.ok) return project;
    if (!project.value) return { ok: false, error: DomainError.notFound("Project", projectId) };
    const reportType = CADENCE_TYPE[project.value.reportingFrequency] ?? null;
    if (!reportType) {
      return { ok: true, value: { reportType: null, plan: { periods: [], closing: null }, note: "This project's reporting frequency has no fixed monthly or quarterly cadence, so periods are created one at a time." } };
    }
    // Cancelled periods keep their dates: "create all" does not bring back a month somebody cancelled.
    const existing = await this.periods.findByProject(projectId, ctx.tenant.tenantId, { includeCancelled: true });
    if (!existing.ok) return existing;
    const plan = planCadencePeriods(reportType, project.value.duration.start, project.value.duration.end, existing.value.map((p) => p.duration.end));
    return { ok: true, value: { reportType, plan } };
  }

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<CreateAllResult, DomainError>> {
    const view = await this.preview(ctx, projectId);
    if (!view.ok) return view;
    const { reportType, plan } = view.value;
    const result: CreateAllResult = { created: [], failed: [] };
    if (!reportType) return { ok: true, value: result };

    const profile = await this.profiles.findByProject(projectId, ctx.tenant.tenantId);
    if (!profile.ok) return profile;
    const offset = profile.value?.deadlineOffsetDays ?? DEFAULT_DEADLINE_OFFSET_DAYS;

    for (const p of plan.periods) {
      const created = await this.createPeriod.handle(ctx, {
        projectId,
        reportType,
        startDate: iso(p.startDate),
        endDate: iso(p.endDate),
        deadline: iso(suggestDeadline(p.endDate, offset)),
      });
      if (created.ok) result.created.push({ id: created.value.id, startDate: p.startDate, endDate: p.endDate });
      else result.failed.push({ startDate: p.startDate, endDate: p.endDate, error: created.error.message });
    }
    return { ok: true, value: result };
  }
}
