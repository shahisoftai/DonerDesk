import { DomainError, PORTFOLIO_PROJECT_ID, asReviewStatus, fileProjectOf, reviewTransition, type ReviewAction, type ReviewStatus, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ICanvasRepository } from "../../ports/canvas.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { InfographicNotifier } from "../infographics/studio.js";
import { can, fail, loadCanvas, ok } from "./canvas-shared.js";

/** Sends a canvas for review, approves it, sends it back with a reason, or takes it back to a draft. The rules are `reviewTransition`. */
export class ReviewCanvasHandler {
  constructor(private readonly repo: ICanvasRepository, private readonly audit: IAuditLogger, private readonly notifier?: InfographicNotifier) {}

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
    await this.tell(ctx, found.value, input.action, note);
    return ok({ status: next.status, ...(note ? { note } : {}) });
  }

  /** Telling someone is additive: a request goes to the people who can approve, a decision to the person who made the canvas. Never to the person acting. */
  private async tell(ctx: AuthenticatedContext, stored: { id: string; title: string; ownerId: string; scope: string; projectId?: string; canvas: Parameters<typeof fileProjectOf>[0] }, action: ReviewAction, note: string | undefined): Promise<void> {
    if (!this.notifier) return;
    if (action === "SUBMIT") {
      const projectId = stored.scope === "PORTFOLIO" ? PORTFOLIO_PROJECT_ID : fileProjectOf(stored.canvas, stored.projectId);
      const approvers = projectId ? await this.notifier.approvers(ctx, projectId) : [];
      await this.notifier.tell(ctx, approvers, "A canvas is waiting for review", `"${stored.title}" was sent for review.`, stored.id);
    } else if (action === "APPROVE") await this.notifier.tell(ctx, [stored.ownerId], "Your canvas was approved", `"${stored.title}" was approved.`, stored.id);
    else if (action === "REQUEST_CHANGES") await this.notifier.tell(ctx, [stored.ownerId], "Changes were asked for", `"${stored.title}": ${note ?? ""}`, stored.id);
  }
}
