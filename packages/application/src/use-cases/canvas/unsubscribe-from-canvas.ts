import { ok, type DomainError, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { ICanvasSubscriptionRepository } from "../../ports/canvas-subscriptions.js";

/** Remove the caller's own subscription (Phase 48.16); audited. */
export class UnsubscribeFromCanvasHandler {
  constructor(private readonly repo: ICanvasSubscriptionRepository, private readonly audit: IAuditLogger) {}
  async handle(ctx: AuthenticatedContext, canvasId: string): Promise<Result<void, DomainError>> {
    const r = await this.repo.remove(canvasId, ctx.tenant.tenantId, ctx.tenant.userId);
    if (!r.ok) return r;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "canvas.unsubscribed", entityType: "canvas", entityId: canvasId });
    return ok(undefined);
  }
}
