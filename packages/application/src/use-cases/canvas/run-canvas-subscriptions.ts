import { asSnapshotSchedule, canSeeCanvas, ok, snapshotDue, type DomainError, type Result, type TenantId } from "@donordesk/domain";
import type { IClock } from "../../ports/core.js";
import type { ICanvasRepository } from "../../ports/canvas.js";
import type { ICanvasSubscriptionRepository } from "../../ports/canvas-subscriptions.js";
import type { IPersonNotifier } from "../../ports/reminders.js";

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
