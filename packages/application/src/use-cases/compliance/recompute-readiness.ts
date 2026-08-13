import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import { CalculateReadinessHandler } from "./calculate-readiness.js";

/**
 * Thin internal entry point for a scheduled readiness recompute. Delegates to
 * the existing readiness calculation so no business logic is duplicated.
 */
export class RecomputeReadinessHandler {
  constructor(private readonly delegate: CalculateReadinessHandler) {}

  handle(ctx: AuthenticatedContext, reportingPeriodId: string): ReturnType<CalculateReadinessHandler["handle"]> {
    return this.delegate.handle(ctx, reportingPeriodId);
  }
}
