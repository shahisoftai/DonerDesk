import type { Result } from "@donordesk/domain";
import { DomainError, isPeriodLocked, periodLockedMessage } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IIndicatorUpdateRepository, IIndicatorRepository } from "../../ports/logframe.js";
import type { IReportingPeriodRepository } from "../../ports/reporting.js";
import type { IActivityUpdateRepository } from "../../ports/activities.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { VerifyPeriodIndicatorUpdatesInput } from "@donordesk/contracts";
import { periodIndicatorScope, inIndicatorScope } from "../../services/period-activities.js";
import { EVIDENCE_REQUIRED_MESSAGE, type VerificationEvidencePolicy } from "../../services/verification-evidence-policy.js";
import { reviewIndicatorUpdate } from "./review-indicator-update.js";

export interface VerifyPeriodOutcome {
  verified: number;
  failed: Array<{ updateId: string; indicatorCode: string; message: string }>;
}

/**
 * "Verify all" for a reporting period. Applies the same transition as the
 * single verify (`reviewIndicatorUpdate`: submit + verify, audited per update)
 * to every not-yet-verified value in the report's indicator scope. The result
 * is per update by design (not atomic): one bad row never hides or blocks the rest.
 */
export class VerifyPeriodIndicatorUpdatesHandler {
  constructor(
    private readonly updates: IIndicatorUpdateRepository,
    private readonly indicators: IIndicatorRepository,
    private readonly periods: IReportingPeriodRepository,
    private readonly activities: IActivityUpdateRepository,
    private readonly audit: IAuditLogger,
    /** With this, a project that requires evidence for verified values is held to it, row by row. */
    private readonly evidencePolicy?: VerificationEvidencePolicy,
  ) {}

  async handle(ctx: AuthenticatedContext, input: VerifyPeriodIndicatorUpdatesInput): Promise<Result<VerifyPeriodOutcome, DomainError>> {
    const periodResult = await this.periods.findById(input.reportingPeriodId, ctx.tenant.tenantId);
    if (!periodResult.ok) return periodResult;
    const period = periodResult.value;
    if (!period) return { ok: false, error: DomainError.notFound("ReportingPeriod", input.reportingPeriodId) };
    if (isPeriodLocked(period.status.value)) {
      return { ok: false, error: DomainError.conflict(periodLockedMessage(period.status.value)) };
    }

    const all = await this.updates.findByReportingPeriod(input.reportingPeriodId, ctx.tenant.tenantId);
    if (!all.ok) return all;
    const scope = await periodIndicatorScope(this.activities, period, ctx.tenant.tenantId);
    if (!scope.ok) return scope;
    const wanted = input.updateIds ? new Set(input.updateIds) : null;
    const targets = all.value.filter(
      (u) => u.verificationStatus !== "VERIFIED" && inIndicatorScope(scope.value, u.indicatorId) && (!wanted || wanted.has(u.id)),
    );

    const indicatorsResult = await this.indicators.findByProject(period.projectId, ctx.tenant.tenantId);
    if (!indicatorsResult.ok) return indicatorsResult;
    const codeById = new Map(indicatorsResult.value.map((i) => [i.id, i.code]));

    const evidenceRequired = this.evidencePolicy ? await this.evidencePolicy.requiredForProject(period.projectId, ctx.tenant.tenantId) : false;
    let verified = 0;
    const failed: VerifyPeriodOutcome["failed"] = [];
    for (const target of targets) {
      const r = await reviewIndicatorUpdate({ repo: this.updates, audit: this.audit }, ctx, target.id, {
        eventType: "logframe.indicator.verified",
        systemNote: "Verified with 'verify all'",
        apply: (update, reviewerId) => {
          if (evidenceRequired && update.attachedEvidenceIds.length === 0) throw DomainError.validation(EVIDENCE_REQUIRED_MESSAGE);
          update.submit();
          update.verify(reviewerId);
        },
      });
      if (r.ok) verified += 1;
      else failed.push({ updateId: target.id, indicatorCode: codeById.get(target.indicatorId) ?? target.indicatorId, message: r.error.message });
    }
    return { ok: true, value: { verified, failed } };
  }
}
