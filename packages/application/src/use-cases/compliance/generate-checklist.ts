import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import { DetectMissingEvidenceHandler } from "./detect-missing-evidence.js";

/**
 * Thin internal entry point for generating a period's compliance checklist on
 * period start. Delegates to the existing checklist detector.
 */
export class GenerateChecklistHandler {
  constructor(private readonly delegate: DetectMissingEvidenceHandler) {}

  handle(ctx: AuthenticatedContext, reportingPeriodId: string): ReturnType<DetectMissingEvidenceHandler["handle"]> {
    return this.delegate.handle(ctx, reportingPeriodId);
  }
}
