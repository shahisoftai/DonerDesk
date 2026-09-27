import type { Result, DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { IAuditLogger } from "../../ports/core.js";
import { reviewIndicatorUpdate } from "./review-indicator-update.js";

export class VerifyIndicatorUpdateHandler {
  constructor(private readonly repo: IIndicatorUpdateRepository, private readonly audit: IAuditLogger) {}

  handle(ctx: AuthenticatedContext, indicatorUpdateId: string): Promise<Result<void, DomainError>> {
    return reviewIndicatorUpdate({ repo: this.repo, audit: this.audit }, ctx, indicatorUpdateId, {
      eventType: "logframe.indicator.verified",
      apply: (update, reviewerId) => {
        update.submit();
        update.verify(reviewerId);
      },
    });
  }
}
