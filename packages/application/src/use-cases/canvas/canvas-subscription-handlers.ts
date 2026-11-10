import { DomainError, asSnapshotSchedule, canSeeCanvas, err, ok, snapshotDue, type Result, type TenantId } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { ICanvasRepository } from "../../ports/canvas.js";
import type { ICanvasSubscriptionRepository, StoredCanvasSubscription, SubscriptionEvery } from "../../ports/canvas-subscriptions.js";
import type { IPersonNotifier } from "../../ports/reminders.js";

/**
 * A person's own email subscriptions to canvases (Phase 48.16). Subscribing needs the right to see the canvas; what is sent is a short
 * note with the canvas's title and a link, never a figure, and a person who can no longer see the canvas is sent nothing. No handler
 * takes a user id: it is always the caller's.
 */
export interface CanvasSubscriptionDto { canvasId: string; every: SubscriptionEvery }
const dto = (s: StoredCanvasSubscription): CanvasSubscriptionDto => ({ canvasId: s.canvasId, every: s.every });
export const SUBSCRIPTION_CHOICES: readonly SubscriptionEvery[] = ["WEEKLY", "MONTHLY"];

export class ListMyCanvasSubscriptionsHandler {
  constructor(private readonly repo: ICanvasSubscriptionRepository) {}
  async handle(ctx: AuthenticatedContext): Promise<Result<{ subscriptions: CanvasSubscriptionDto[] }, DomainError>> {
    const r = await this.repo.listForUser(ctx.tenant.tenantId, ctx.tenant.userId);
    return r.ok ? ok({ subscriptions: r.value.map(dto) }) : r;
  }
}

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
    return ok(dto(s));
  }
}

export class UnsubscribeFromCanvasHandler {
  constructor(private readonly repo: ICanvasSubscriptionRepository, private readonly audit: IAuditLogger) {}
  async handle(ctx: AuthenticatedContext, canvasId: string): Promise<Result<void, DomainError>> {
    const r = await this.repo.remove(canvasId, ctx.tenant.tenantId, ctx.tenant.userId);
    if (!r.ok) return r;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "canvas.unsubscribed", entityType: "canvas", entityId: canvasId });
    return ok(undefined);
  }
}

export interface SubscriptionRunDto { checked: number; sent: number; skipped: number }

/** Called by the hourly run: each due subscription is sent once, and the time is recorded, so a repeat run does nothing until the next is due. */
export class RunCanvasSubscriptionsHandler {
  constructor(private readonly repo: ICanvasSubscriptionRepository, private readonly canvases: ICanvasRepository, private readonly notifier: IPersonNotifier, private readonly clock: IClock) {}
  async handle(tenantId: TenantId): Promise<Result<SubscriptionRunDto, DomainError>> {
    const all = await this.repo.listAll(tenantId);
    if (!all.ok) return all;
    const now = this.clock.now();
    const out: SubscriptionRunDto = { checked: 0, sent: 0, skipped: 0 };
    for (const s of all.value) {
      if (!snapshotDue(asSnapshotSchedule(s.every), s.lastSentAt, now)) continue;
      out.checked += 1;
      const found = await this.canvases.findById(s.canvasId, tenantId);
      const canvas = found.ok ? found.value : null;
      if (!canvas || !canSeeCanvas({ scope: canvas.scope, ownerId: canvas.ownerId, projectId: canvas.projectId }, { userId: s.userId })) { out.skipped += 1; continue; }
      await this.notifier.send({ tenantId, recipientId: s.userId, type: "CANVAS_DIGEST", title: "A visual you follow is ready", message: `${canvas.title} is ready to open with the latest figures.`, relatedEntityType: "canvas", relatedEntityId: canvas.id, urgent: false });
      await this.repo.setSent(s.id, tenantId, now);
      out.sent += 1;
    }
    return ok(out);
  }
}
