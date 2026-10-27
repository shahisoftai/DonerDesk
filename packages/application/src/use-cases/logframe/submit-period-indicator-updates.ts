import type { Result } from "@donordesk/domain";
import { DomainError, SUBMITTABLE_STATUSES, signOffRoles, isPeriodLocked, periodLockedMessage, summarizePeriodData } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IIndicatorRepository, IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { IReportingPeriodRepository } from "../../ports/reporting.js";
import type { IActivityUpdateRepository } from "../../ports/activities.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { IPersonNotifier } from "../../ports/reminders.js";
import type { IProjectRepository } from "../../ports/projects.js";
import type { IProjectMemberRepository } from "../../ports/project-members.js";
import { periodIndicatorScope, inIndicatorScope } from "../../services/period-activities.js";
import { reviewIndicatorUpdate } from "./review-indicator-update.js";
import { checkEntryWindow } from "../../services/entry-window-guard.js";

export interface SubmitPeriodOutcome {
  submitted: number;
  /** Values left as they are because they are not drafts or returned values (already handed in or verified). */
  unchanged: number;
  failed: Array<{ updateId: string; indicatorCode: string; message: string }>;
  status: ReturnType<typeof summarizePeriodData>["status"];
}

/**
 * "Submit for review" for a reporting period (Phase 33.4): the person who entered the values hands them in. Every
 * draft or returned value in the report's indicator scope becomes SUBMITTED (the same transition the verifier's
 * "verify" applies first), audited per value; a submitted value can no longer be edited by its submitter until a
 * reviewer returns it. Per value by design, not atomic: one bad row never hides or blocks the rest. A value with no
 * figure is not handed in, and a locked (approved or submitted) report refuses. Needs `indicator.update`.
 */
export class SubmitPeriodIndicatorUpdatesHandler {
  constructor(
    private readonly updates: IIndicatorUpdateRepository,
    private readonly indicators: IIndicatorRepository,
    private readonly periods: IReportingPeriodRepository,
    private readonly activities: IActivityUpdateRepository,
    private readonly audit: IAuditLogger,
    /** With these, the project's reviewers are told once that values are waiting (never fails the submit). */
    private readonly reviewers?: { notify: IPersonNotifier; projects: IProjectRepository; members: IProjectMemberRepository },
    private readonly now: () => Date = () => new Date(),
  ) {}

  async handle(ctx: AuthenticatedContext, reportingPeriodId: string): Promise<Result<SubmitPeriodOutcome, DomainError>> {
    const periodResult = await this.periods.findById(reportingPeriodId, ctx.tenant.tenantId);
    if (!periodResult.ok) return periodResult;
    const period = periodResult.value;
    if (!period) return { ok: false, error: DomainError.notFound("ReportingPeriod", reportingPeriodId) };
    if (isPeriodLocked(period.status.value)) return { ok: false, error: DomainError.conflict(periodLockedMessage(period.status.value)) };

    const window = checkEntryWindow(ctx, period, this.now());
    if (!window.ok) return window;

    const all = await this.updates.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId);
    if (!all.ok) return all;
    const scope = await periodIndicatorScope(this.activities, period, ctx.tenant.tenantId);
    if (!scope.ok) return scope;
    const indicatorsResult = await this.indicators.findByProject(period.projectId, ctx.tenant.tenantId);
    if (!indicatorsResult.ok) return indicatorsResult;
    const codeById = new Map(indicatorsResult.value.map((i) => [i.id, i.code]));

    const inScope = all.value.filter((u) => inIndicatorScope(scope.value, u.indicatorId));
    const hasFigure = (u: { periodAchievement: string; cumulativeAchievement: string }) => u.periodAchievement.trim() !== "" || u.cumulativeAchievement.trim() !== "";
    const targets = inScope.filter((u) => SUBMITTABLE_STATUSES.includes(u.verificationStatus) && hasFigure(u));
    const unchanged = inScope.length - targets.length;

    let submitted = 0;
    const failed: SubmitPeriodOutcome["failed"] = [];
    for (const target of targets) {
      const r = await reviewIndicatorUpdate({ repo: this.updates, audit: this.audit }, ctx, target.id, {
        eventType: "logframe.indicator.submitted",
        systemNote: "Submitted for review",
        apply: (update) => update.submit(),
      });
      if (r.ok) submitted += 1;
      else failed.push({ updateId: target.id, indicatorCode: codeById.get(target.indicatorId) ?? target.indicatorId, message: r.error.message });
    }
    if (submitted > 0) await this.tellReviewers(ctx, period.projectId, period.id, submitted);
    const after = await this.updates.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId);
    const statuses = (after.ok ? after.value : all.value).filter((u) => inIndicatorScope(scope.value, u.indicatorId)).map((u) => u.verificationStatus);
    return { ok: true, value: { submitted, unchanged, failed, status: summarizePeriodData(statuses).status } };
  }

  /** One note per reviewer (the project's manager and M&E officer), never the person who submitted. Additive: it never fails the submit. */
  private async tellReviewers(ctx: AuthenticatedContext, projectId: string, periodId: string, count: number): Promise<void> {
    if (!this.reviewers) return;
    try {
      const [project, members] = await Promise.all([this.reviewers.projects.findById(projectId, ctx.tenant.tenantId), this.reviewers.members.findByProject(projectId, ctx.tenant.tenantId)]);
      if (!project.ok || !members.ok || !project.value) return;
      const roles = signOffRoles({
        projectManagerId: project.value.projectManagerId, meOfficerId: project.value.meOfficerId, reportingOfficerId: project.value.reportingOfficerId,
        members: members.value.map((m) => ({ userId: m.userId, role: m.role, status: m.status })),
      });
      for (const recipientId of roles.approverIds.filter((id) => id !== ctx.tenant.userId)) {
        await this.reviewers.notify.send({
          tenantId: ctx.tenant.tenantId, recipientId, type: "ASSIGNMENT", urgent: false,
          title: "Indicator values are waiting for your review",
          message: `${count} indicator ${count === 1 ? "value" : "values"} for ${project.value.title} ${count === 1 ? "has" : "have"} been submitted. Open the report's inputs to verify ${count === 1 ? "it" : "them"} or send ${count === 1 ? "it" : "them"} back.`,
          relatedEntityType: "reporting_period", relatedEntityId: periodId,
        });
      }
    } catch {
      /* additive */
    }
  }
}
