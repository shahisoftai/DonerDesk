import { DomainError, canEditCanvas, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { ICanvasRepository } from "../../ports/canvas.js";
import { can, fail, loadCanvas, ok, viewerOf } from "./canvas-shared.js";

export class DeleteCanvasHandler {
  constructor(private readonly repo: ICanvasRepository, private readonly audit: IAuditLogger) {}
  async handle(ctx: AuthenticatedContext, id: string): Promise<Result<void, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot delete dashboards or infographics"));
    const found = await loadCanvas(this.repo, ctx, id);
    if (!found.ok) return found;
    if (!canEditCanvas(found.value, viewerOf(ctx))) return fail(DomainError.forbidden("You cannot delete this one"));
    const r = await this.repo.delete(id, ctx.tenant.tenantId);
    if (!r.ok) return r;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "canvas.deleted", entityType: "canvas", entityId: id, oldValue: JSON.stringify({ title: found.value.title }) });
    return ok(undefined);
  }
}
