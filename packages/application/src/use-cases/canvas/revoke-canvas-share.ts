import { DomainError, canEditCanvas, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ICanvasRepository, ICanvasShareLinkRepository } from "../../ports/canvas.js";
import type { IAuditLogger, IClock } from "../../ports/core.js";
import { can, fail, loadCanvas, ok, viewerOf } from "./canvas-shared.js";

export class RevokeCanvasShareHandler {
  constructor(private readonly repo: ICanvasRepository, private readonly links: ICanvasShareLinkRepository, private readonly audit: IAuditLogger, private readonly clock: IClock) {}
  async handle(ctx: AuthenticatedContext, canvasId: string, linkId: string): Promise<Result<void, DomainError>> {
    if (!can(ctx, "report.export")) return fail(DomainError.forbidden("You cannot change share links"));
    const found = await loadCanvas(this.repo, ctx, canvasId);
    if (!found.ok) return found;
    if (!canEditCanvas(found.value, viewerOf(ctx))) return fail(DomainError.forbidden("You cannot change this one"));
    const link = await this.links.findById(linkId, ctx.tenant.tenantId);
    if (!link.ok) return link;
    if (!link.value || link.value.canvasId !== canvasId) return fail(DomainError.notFound("Link", linkId));
    const done = await this.links.revoke(linkId, ctx.tenant.tenantId, this.clock.now());
    if (!done.ok) return done;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "canvas.share.revoked", entityType: "canvas_share_link", entityId: linkId });
    return ok(undefined);
  }
}
