import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { IAuditLogger } from "../../ports/core.js";
import { EVIDENCE_REQUIRED_MESSAGE, type VerificationEvidencePolicy } from "../../services/verification-evidence-policy.js";
import { reviewIndicatorUpdate } from "./review-indicator-update.js";

export class VerifyIndicatorUpdateHandler {
  constructor(
    private readonly repo: IIndicatorUpdateRepository,
    private readonly audit: IAuditLogger,
    /** With this, a project that requires evidence for verified values is held to it. */
    private readonly evidencePolicy?: VerificationEvidencePolicy,
  ) {}

  async handle(ctx: AuthenticatedContext, indicatorUpdateId: string): Promise<Result<void, DomainError>> {
    let evidenceRequired = false;
    if (this.evidencePolicy) {
      const found = await this.repo.findById(indicatorUpdateId, ctx.tenant.tenantId);
      if (found.ok && found.value) evidenceRequired = await this.evidencePolicy.requiredForIndicator(found.value.indicatorId, ctx.tenant.tenantId);
    }
    return reviewIndicatorUpdate({ repo: this.repo, audit: this.audit }, ctx, indicatorUpdateId, {
      eventType: "logframe.indicator.verified",
      apply: (update, reviewerId) => {
        if (evidenceRequired && update.attachedEvidenceIds.length === 0) throw DomainError.validation(EVIDENCE_REQUIRED_MESSAGE);
        update.submit();
        update.verify(reviewerId);
      },
    });
  }
}
