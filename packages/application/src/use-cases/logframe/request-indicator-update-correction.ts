import type { Result, DomainError } from "@donordesk/domain";
import type { IndicatorUpdateReviewReasonInput } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { IAuditLogger } from "../../ports/core.js";
import { reviewIndicatorUpdate } from "./review-indicator-update.js";

export class RequestIndicatorUpdateCorrectionHandler {
  constructor(private readonly repo: IIndicatorUpdateRepository, private readonly audit: IAuditLogger) {}

  handle(
    ctx: AuthenticatedContext,
    indicatorUpdateId: string,
    input: IndicatorUpdateReviewReasonInput,
  ): Promise<Result<void, DomainError>> {
    return reviewIndicatorUpdate({ repo: this.repo, audit: this.audit }, ctx, indicatorUpdateId, {
      eventType: "logframe.indicator.correction_requested",
      apply: (update) => update.requestCorrection(input.reason),
      systemNote: input.reason,
    });
  }
}
