import { DomainError, asReviewStatus, reviewTransition, type ReviewAction, type ReviewStatus, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ICanvasRepository } from "../../ports/canvas.js";
import type { IAuditLogger } from "../../ports/core.js";
import { can, fail, loadCanvas, ok } from "./canvas-shared.js";

/** Sends a canvas for review, approves it, sends it back with a reason, or takes it back to a draft. The rules are `reviewTransition`. */
export class ReviewCanvasHandler {
  constructor(private readonly repo: ICanvasRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, canvasId: string, input: { action: ReviewAction; note?: string | undefined }): Promise<Result<{ status: ReviewStatus; note?: string }, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot review canvases"));
    const found = await loadCanvas(this.repo, ctx, canvasId);
    if (!found.ok) return found;
    const next = reviewTransition(asReviewStatus(found.value.reviewStatus), input.action, { isReviewer: can(ctx, "report.approve"), note: input.note });
    if (!next.ok) return fail(DomainError.conflict(next.reason));
    const note = input.note?.trim();
    const done = await this.repo.setReview(canvasId, ctx.tenant.tenantId, { status: next.status, ...(next.status === "APPROVED" || next.status === "CHANGES_REQUESTED" ? { reviewedById: ctx.tenant.userId } : {}), ...(note ? { note } : {}) });
    if (!done.ok) return done;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: `canvas.review.${input.action.toLowerCase()}`, entityType: "canvas", entityId: canvasId, newValue: JSON.stringify({ status: next.status }) });
    return ok({ status: next.status, ...(note ? { note } : {}) });
  }
}
