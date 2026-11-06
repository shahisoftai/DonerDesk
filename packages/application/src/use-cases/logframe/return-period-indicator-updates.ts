import type { Result } from "@donordesk/domain";
import { DomainError, isPeriodLocked, periodLockedMessage, summarizePeriodData } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IIndicatorRepository, IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { IReportingPeriodRepository } from "../../ports/reporting.js";
import type { IActivityUpdateRepository } from "../../ports/activities.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { IPersonNotifier } from "../../ports/reminders.js";
import { periodIndicatorScope, inIndicatorScope } from "../../services/period-activities.js";
import { reviewIndicatorUpdate } from "./review-indicator-update.js";

export interface ReturnPeriodOutcome {
  returned: number;
  failed: Array<{ updateId: string; indicatorCode: string; message: string }>;
  status: ReturnType<typeof summarizePeriodData>["status"];
}

/**
 * "Send back" for a whole reporting period (Phase 33.4): the reviewer returns every value that is waiting for review,
 * with one reason that is stored on each value as its review note (never part of a report). Each value goes through
 * the same transition as a single request-for-correction, audited per value; verified values are left alone. The people
 * who entered the values are told once, with the reason. A locked report refuses. Needs `indicator.verify`.
 */
export class ReturnPeriodIndicatorUpdatesHandler {
  constructor(
    private readonly updates: IIndicatorUpdateRepository,
    private readonly indicators: IIndicatorRepository,
    private readonly periods: IReportingPeriodRepository,
    private readonly activities: IActivityUpdateRepository,
    private readonly audit: IAuditLogger,
    private readonly notify?: IPersonNotifier,
  ) {}

  async handle(ctx: AuthenticatedContext, reportingPeriodId: string, reason: string): Promise<Result<ReturnPeriodOutcome, DomainError>> {
    return this.run(ctx, reportingPeriodId, reason, { statuses: ["SUBMITTED"], note: "Sent back with 'send back all'", title: "Indicator values were sent back", verb: "sent back" });
  }

  /** Reopens verified values (all of them, or the named ones) so they can be corrected: they return to "needs correction" with the reason. An approved or submitted report keeps its figures locked. */
  async reopen(ctx: AuthenticatedContext, reportingPeriodId: string, reason: string, updateIds?: string[]): Promise<Result<ReturnPeriodOutcome, DomainError>> {
    return this.run(ctx, reportingPeriodId, reason, { statuses: ["VERIFIED"], note: "Verified value reopened", title: "Verified indicator values were reopened", verb: "reopened", updateIds });
  }

  private async run(
    ctx: AuthenticatedContext,
    reportingPeriodId: string,
    reason: string,
    mode: { statuses: string[]; note: string; title: string; verb: string; updateIds?: string[] },
  ): Promise<Result<ReturnPeriodOutcome, DomainError>> {
    const why = reason.trim();
    if (!why) return { ok: false, error: DomainError.validation("Say what needs to change; the person who entered the values will read it", { field: "reason" }) };
    const periodResult = await this.periods.findById(reportingPeriodId, ctx.tenant.tenantId);
    if (!periodResult.ok) return periodResult;
    const period = periodResult.value;
    if (!period) return { ok: false, error: DomainError.notFound("ReportingPeriod", reportingPeriodId) };
    if (isPeriodLocked(period.status.value)) return { ok: false, error: DomainError.conflict(periodLockedMessage(period.status.value)) };

    const all = await this.updates.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId);
    if (!all.ok) return all;
    const scope = await periodIndicatorScope(this.activities, period, ctx.tenant.tenantId);
    if (!scope.ok) return scope;
    const indicatorsResult = await this.indicators.findByProject(period.projectId, ctx.tenant.tenantId);
    if (!indicatorsResult.ok) return indicatorsResult;
    const codeById = new Map(indicatorsResult.value.map((i) => [i.id, i.code]));

    const wanted = mode.updateIds ? new Set(mode.updateIds) : null;
    const targets = all.value.filter((u) => mode.statuses.includes(u.verificationStatus) && (!wanted || wanted.has(u.id)) && inIndicatorScope(scope.value, u.indicatorId));
    let returned = 0;
    const failed: ReturnPeriodOutcome["failed"] = [];
    const authors = new Set<string>();
    for (const target of targets) {
      const r = await reviewIndicatorUpdate({ repo: this.updates, audit: this.audit }, ctx, target.id, {
        eventType: "logframe.indicator.correction_requested",
        systemNote: mode.note,
        apply: (update) => update.requestCorrection(why),
      });
      if (r.ok) { returned += 1; authors.add(target.createdById); } else failed.push({ updateId: target.id, indicatorCode: codeById.get(target.indicatorId) ?? target.indicatorId, message: r.error.message });
    }
    if (returned > 0 && this.notify) {
      try {
        for (const recipientId of [...authors].filter((id) => id && id !== ctx.tenant.userId)) {
          await this.notify.send({
            tenantId: ctx.tenant.tenantId, recipientId, type: "ASSIGNMENT", urgent: true,
            title: mode.title,
            message: `${returned} indicator ${returned === 1 ? "value was" : "values were"} ${mode.verb} for changes: ${why}`,
            relatedEntityType: "reporting_period", relatedEntityId: reportingPeriodId,
          });
        }
      } catch {
        /* additive */
      }
    }
    const after = await this.updates.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId);
    const statuses = (after.ok ? after.value : all.value).filter((u) => inIndicatorScope(scope.value, u.indicatorId)).map((u) => u.verificationStatus);
    return { ok: true, value: { returned, failed, status: summarizePeriodData(statuses).status } };
  }
}
