import type { Result } from "@donordesk/domain";
import type { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ReviewActivityDecision } from "./review-activity.js";

/** The single-record review this handler repeats; depending on the shape, not the class, keeps it replaceable. */
export interface ActivityReviewer {
  handle(ctx: AuthenticatedContext, activityId: string, decision: ReviewActivityDecision): Promise<Result<void, DomainError>>;
}

export interface BulkReviewItemResult {
  activityId: string;
  ok: boolean;
  error?: string;
}

const MAX_BULK = 200;

/**
 * Reviews several activity records with one decision and one shared note. It repeats the single review, so every
 * rule and every audit event is exactly the one-by-one behaviour; a refused record does not stop the others.
 */
export class BulkReviewActivitiesHandler {
  constructor(private readonly reviewer: ActivityReviewer) {}

  async handle(
    ctx: AuthenticatedContext,
    input: { activityIds: string[]; decision: ReviewActivityDecision["decision"]; notes?: string },
  ): Promise<{ results: BulkReviewItemResult[]; succeeded: number; failed: number }> {
    const ids = [...new Set(input.activityIds)].slice(0, MAX_BULK);
    const results: BulkReviewItemResult[] = [];
    for (const activityId of ids) {
      const r = await this.reviewer.handle(ctx, activityId, { decision: input.decision, notes: input.notes });
      results.push(r.ok ? { activityId, ok: true } : { activityId, ok: false, error: r.error.message });
    }
    const succeeded = results.filter((r) => r.ok).length;
    return { results, succeeded, failed: results.length - succeeded };
  }
}
