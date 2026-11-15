import { DomainError, canSeeCanvas, err, ok, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { ICanvasRepository } from "../../ports/canvas.js";
import type { ICanvasSubscriptionRepository, StoredCanvasSubscription, SubscriptionEvery } from "../../ports/canvas-subscriptions.js";
import { SUBSCRIPTION_CHOICES, subscriptionDto, type CanvasSubscriptionDto } from "./canvas-subscription-dto.js";

/** Subscribe the caller to a canvas they can see (Phase 48.16); audited. */
export class SubscribeToCanvasHandler {
  constructor(private readonly ids: IIdGenerator, private readonly repo: ICanvasSubscriptionRepository, private readonly canvases: ICanvasRepository, private readonly audit: IAuditLogger, private readonly clock: IClock) {}
  async handle(ctx: AuthenticatedContext, canvasId: string, every: SubscriptionEvery): Promise<Result<CanvasSubscriptionDto, DomainError>> {
    if (!SUBSCRIPTION_CHOICES.includes(every)) return err(DomainError.validation("Choose weekly or monthly."));
    const found = await this.canvases.findById(canvasId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    // A canvas that is not the caller's to see does not exist for them.
    if (!found.value || !canSeeCanvas({ scope: found.value.scope, ownerId: found.value.ownerId, projectId: found.value.projectId }, { userId: ctx.tenant.userId })) return err(DomainError.notFound("Canvas", canvasId));
    const s: StoredCanvasSubscription = { id: this.ids.generate(), tenantId: ctx.tenant.tenantId, canvasId, userId: ctx.tenant.userId, every, createdAt: this.clock.now() };
    const saved = await this.repo.upsert(s);
    if (!saved.ok) return saved;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "canvas.subscribed", entityType: "canvas", entityId: canvasId, newValue: every });
    return ok(subscriptionDto(s));
  }
}
