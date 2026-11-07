import { DomainError, canEditCanvas, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ICanvasRepository, ICanvasShareLinkRepository } from "../../ports/canvas.js";
import type { IClock } from "../../ports/core.js";
import { can, fail, loadCanvas, ok, viewerOf } from "./canvas-shared.js";
import { linkDto, type CanvasShareLinkDto } from "./canvas-share-links.js";

export class ListCanvasSharesHandler {
  constructor(private readonly repo: ICanvasRepository, private readonly links: ICanvasShareLinkRepository, private readonly clock: IClock) {}
  async handle(ctx: AuthenticatedContext, canvasId: string): Promise<Result<CanvasShareLinkDto[], DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot see share links"));
    const found = await loadCanvas(this.repo, ctx, canvasId);
    if (!found.ok) return found;
    if (!canEditCanvas(found.value, viewerOf(ctx))) return ok([]);
    const listed = await this.links.listByCanvas(canvasId, ctx.tenant.tenantId);
    if (!listed.ok) return listed;
    const now = this.clock.now();
    return ok(listed.value.map((l) => linkDto(l, now)));
  }
}
