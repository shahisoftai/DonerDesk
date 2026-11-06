import type { TenantId } from "@donordesk/domain";
import { Permissions, reviewDecision, reviewModeOf, type ReviewDecision, type ReviewMode, type Role } from "@donordesk/domain";
import type { AuthenticatedContext } from "../context.js";
import type { IIndicatorUpdateRepository } from "../ports/logframe.js";
import type { IAuditLogger } from "../ports/core.js";
import type { IReportingProfileRepository } from "../ports/setup.js";
import { reviewIndicatorUpdate } from "../use-cases/logframe/review-indicator-update.js";

export interface AutoReviewResult {
  updateId: string;
  outcome: ReviewDecision["outcome"];
  notice: string | null;
}

/**
 * "Simple review" for a project: right after a value is saved by a person, hand it in (and verify it when that person
 * may verify and a file is attached). It uses the same transitions and audit events as the manual steps, so the history
 * reads the same; only the system note says it happened automatically. Never throws: a value that cannot move on stays
 * as saved and the person is told why in the notice.
 */
export class AutoReviewService {
  constructor(
    private readonly updates: IIndicatorUpdateRepository,
    private readonly profiles: IReportingProfileRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async modeFor(projectId: string, tenantId: TenantId): Promise<ReviewMode> {
    const profile = await this.profiles.findByProject(projectId, tenantId);
    return reviewModeOf(profile.ok ? profile.value?.simpleReview : false);
  }

  async afterSave(ctx: AuthenticatedContext, projectId: string, updateIds: readonly string[]): Promise<AutoReviewResult[]> {
    const mode = await this.modeFor(projectId, ctx.tenant.tenantId);
    const canVerify = Permissions.can(ctx.tenant.role as Role, "indicator.verify");
    const results: AutoReviewResult[] = [];
    for (const updateId of updateIds) {
      const found = await this.updates.findById(updateId, ctx.tenant.tenantId);
      if (!found.ok || !found.value) continue;
      const u = found.value;
      const hasFigure = u.isNotApplicable || u.periodAchievement.trim() !== "" || u.cumulativeAchievement.trim() !== "";
      const decision = reviewDecision({ mode, status: u.verificationStatus, hasFigure, canVerify, evidenceCount: u.attachedEvidenceIds.length });
      let outcome = decision.outcome;
      let notice = decision.notice;
      if (decision.submit || decision.verify) {
        const moved = await reviewIndicatorUpdate({ repo: this.updates, audit: this.audit }, ctx, updateId, {
          eventType: decision.verify ? "logframe.indicator.verified" : "logframe.indicator.submitted",
          systemNote: decision.verify ? "Handed in and verified automatically (simple review)" : "Handed in automatically (simple review)",
          apply: (update, reviewerId) => {
            update.submit();
            if (decision.verify) update.verify(reviewerId);
          },
        });
        if (!moved.ok) {
          outcome = "SAVED_DRAFT";
          notice = `Saved as a draft. It could not be handed in: ${moved.error.message}`;
        }
      }
      results.push({ updateId, outcome, notice });
    }
    return results;
  }
}
