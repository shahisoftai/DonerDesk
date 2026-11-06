import { DomainError, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ICanvasRepository } from "../../ports/canvas.js";
import { can, fail, ok, summaryOf, type CanvasSummaryDto } from "./canvas-shared.js";

export class ListCanvasesHandler {
  constructor(private readonly repo: ICanvasRepository) {}

  /** Shared canvases and the caller's own; a personal canvas of someone else is never listed. */
  async handle(ctx: AuthenticatedContext, projectId?: string): Promise<Result<CanvasSummaryDto[], DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot see dashboards or infographics"));
    const r = await this.repo.listVisible(ctx.tenant.tenantId, ctx.tenant.userId, projectId);
    if (!r.ok) return r;
    return ok(r.value.map((c) => summaryOf(c, ctx)));
  }
}
