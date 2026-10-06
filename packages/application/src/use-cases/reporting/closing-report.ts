import type { Result } from "@donordesk/domain";
import {
  DomainError,
  planClosingReport,
  missingCumulativeFields,
  effectiveIndicatorSemantics,
  suggestDeadline,
  DEFAULT_DEADLINE_OFFSET_DAYS,
  type ClosingPlan,
  type ClosingFacts,
} from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IProjectRepository } from "../../ports/projects.js";
import type { IReportingPeriodRepository, IReportDraftRepository } from "../../ports/reporting.js";
import type { IIndicatorRepository, IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { IActivityUpdateRepository } from "../../ports/activities.js";
import type { IDonorTemplateRepository } from "../../ports/templates.js";
import type { IReportingProfileRepository } from "../../ports/setup.js";
import type { IFinanceInputs } from "../../services/finance-inputs.js";
import type { IDefaultTemplateResolver } from "../../ports/default-template-resolver.js";
import type { CreateReportingPeriodHandler } from "./create-reporting-period.js";

const FINISHED_DRAFT = new Set(["APPROVED", "EXPORTED", "SUBMITTED"]);
const NON_CUMULATIVE = new Set(["RATIO", "PERCENTAGE"]);

/** Gathers the facts about a project and asks the domain what stands between it and a closing report. */
export class PlanClosingReportHandler {
  constructor(
    private readonly projects: IProjectRepository,
    private readonly periods: IReportingPeriodRepository,
    private readonly drafts: IReportDraftRepository,
    private readonly indicators: IIndicatorRepository,
    private readonly indicatorUpdates: IIndicatorUpdateRepository,
    private readonly activities: IActivityUpdateRepository,
    private readonly profiles: IReportingProfileRepository,
    private readonly templates: IDonorTemplateRepository,
    /** Absent when the deployment has no finance support. */
    private readonly finance?: IFinanceInputs,
    /** The same resolver period creation uses, so the step names the template the period will really get. */
    private readonly defaultTemplates?: IDefaultTemplateResolver,
  ) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<ClosingPlan, DomainError>> {
    const tenantId = ctx.tenant.tenantId;
    const project = await this.projects.findById(projectId, tenantId);
    if (!project.ok) return project;
    if (!project.value) return { ok: false, error: DomainError.notFound("Project", projectId) };

    const periods = await this.periods.findByProject(projectId, tenantId);
    if (!periods.ok) return periods;
    const existing: Array<ClosingFacts["existing"][number]> = [];
    for (const p of periods.value) {
      const drafts = await this.drafts.findByReportingPeriod(p.id, tenantId);
      if (!drafts.ok) return drafts;
      existing.push({
        id: p.id,
        reportType: p.reportType,
        start: p.duration.start,
        end: p.duration.end,
        finished: drafts.value.some((d) => FINISHED_DRAFT.has(d.status)),
      });
    }

    const indicators = await this.indicators.findByProject(projectId, tenantId);
    if (!indicators.ok) return indicators;
    let unconfirmedCalculationCount = 0;
    const cumulativeGaps: Array<ClosingFacts["cumulativeGaps"][number]> = [];
    for (const ind of indicators.value) {
      const semantics = effectiveIndicatorSemantics(ind);
      if (semantics.status === "REQUIRES_REVIEW") unconfirmedCalculationCount += 1;
      if (NON_CUMULATIVE.has(semantics.aggregation)) continue;
      const updates = await this.indicatorUpdates.findByIndicator(ind.id, tenantId);
      if (!updates.ok) return updates;
      const hasVerifiedCumulative = updates.value.some((u) => u.verificationStatus === "VERIFIED" && u.cumulativeAchievement.trim() !== "");
      const missing = missingCumulativeFields({ baseline: ind.baseline, target: ind.target, hasVerifiedCumulative });
      if (missing.length > 0) cumulativeGaps.push({ code: ind.code, missing });
    }

    const activities = await this.activities.findByProject(projectId, tenantId);
    if (!activities.ok) return activities;

    const profile = await this.profiles.findByProject(projectId, tenantId);
    if (!profile.ok) return profile;
    let templateState: ClosingFacts["templateState"] = "NONE";
    let templateName: string | undefined;
    if (this.defaultTemplates) {
      const resolved = await this.defaultTemplates.resolve(tenantId, projectId, "FINAL");
      if (!resolved.ok) return resolved;
      if (resolved.value.templateId) {
        templateState = resolved.value.status === "REVIEWED" ? "REVIEWED" : "NOT_REVIEWED";
        templateName = resolved.value.templateName;
      }
    } else if (profile.value?.defaultTemplateId) {
      const template = await this.templates.findById(profile.value.defaultTemplateId, tenantId);
      if (!template.ok) return template;
      if (template.value) templateState = template.value.status === "REVIEWED" ? "REVIEWED" : "NOT_REVIEWED";
    }

    let financeMode: ClosingFacts["financeMode"] = "OFF";
    let finalFinance: ClosingFacts["finalFinance"];
    if (this.finance) {
      const mode = await this.finance.modeFor(projectId, tenantId);
      if (!mode.ok) return mode;
      financeMode = mode.value === "DISABLED" ? "OFF" : "ON";
      const final = periods.value.find((p) => p.reportType === "FINAL");
      if (financeMode === "ON" && final) {
        const status = await this.finance.statusFor(final, tenantId);
        if (!status.ok) return status;
        finalFinance = status.value;
      }
    }

    return {
      ok: true,
      value: planClosingReport({
        projectStatus: project.value.status,
        projectStart: project.value.duration.start,
        projectEnd: project.value.duration.end,
        existing,
        activityCount: activities.value.length,
        unacceptedActivityCount: activities.value.filter((a) => a.status !== "ACCEPTED").length,
        unconfirmedCalculationCount,
        cumulativeGaps,
        financeMode,
        ...(finalFinance ? { finalFinance } : {}),
        templateState,
        ...(templateName ? { templateName } : {}),
        projectManagerAssigned: Boolean(project.value.projectManagerId),
        meOfficerAssigned: Boolean(project.value.meOfficerId),
      }),
    };
  }
}

/**
 * Starts the closing report: the plan's suggested closing period, created through the one handler
 * that owns every period rule (overlap, bounds, setup, template), then its checklist. It never
 * duplicates those rules and refuses when a closing report already exists.
 */
export class StartClosingReportHandler {
  constructor(
    private readonly plan: PlanClosingReportHandler,
    private readonly createPeriod: CreateReportingPeriodHandler,
    private readonly profiles: IReportingProfileRepository,
    private readonly checklist?: { handle(ctx: AuthenticatedContext, reportingPeriodId: string): Promise<Result<unknown, DomainError>> },
  ) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<{ id: string }, DomainError>> {
    const plan = await this.plan.handle(ctx, projectId);
    if (!plan.ok) return plan;
    if (plan.value.existingFinalId) {
      return { ok: false, error: DomainError.conflict("A closing report already exists for this project.", { existingPeriodId: plan.value.existingFinalId }) };
    }
    if (!plan.value.canStart || !plan.value.suggestedPeriod) {
      return { ok: false, error: DomainError.invalidTransition(plan.value.blockedReason ?? "The closing report cannot be started yet.") };
    }
    const profile = await this.profiles.findByProject(projectId, ctx.tenant.tenantId);
    if (!profile.ok) return profile;
    const offset = profile.value?.deadlineOffsetDays ?? DEFAULT_DEADLINE_OFFSET_DAYS;
    const iso = (dateOnly: string) => new Date(`${dateOnly}T00:00:00.000Z`).toISOString();
    const { startDate, endDate } = plan.value.suggestedPeriod;

    const created = await this.createPeriod.handle(ctx, {
      projectId,
      reportType: "FINAL",
      startDate: iso(startDate),
      endDate: iso(endDate),
      deadline: iso(suggestDeadline(endDate, offset)),
    });
    if (!created.ok) return created;
    // The checklist is a convenience: the report exists even if it cannot be generated right now.
    if (this.checklist) await this.checklist.handle(ctx, created.value.id);
    return created;
  }
}
