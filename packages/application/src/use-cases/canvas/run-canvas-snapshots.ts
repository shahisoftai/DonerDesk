import { DomainError, asReviewStatus, asSnapshotSchedule, publishBlocker, snapshotDue, type Result, type TenantId } from "@donordesk/domain";
import type { ICanvasRepository } from "../../ports/canvas.js";
import type { IClock } from "../../ports/core.js";
import type { AuthenticatedContext } from "../../context.js";
import { ok } from "./canvas-shared.js";
import type { PublishCanvasHandler } from "./publish-canvas.js";

export interface SnapshotRunDto { checked: number; made: number; skipped: Array<{ canvasId: string; reason: string }> }

/**
 * Called by the hourly timer for one organisation: every canvas whose schedule is due gets a new published copy (a PDF), made as the
 * person who switched the schedule on. A canvas that may not be published right now (the Design check, a donor canvas not approved) is skipped
 * with the reason; the time of the last snapshot only moves when one was made.
 */
export class RunCanvasSnapshotsHandler {
  constructor(private readonly repo: ICanvasRepository, private readonly publisher: PublishCanvasHandler, private readonly clock: IClock) {}

  async handle(tenantId: TenantId): Promise<Result<SnapshotRunDto, DomainError>> {
    const listed = await this.repo.listScheduled(tenantId);
    if (!listed.ok) return listed;
    const now = this.clock.now();
    const out: SnapshotRunDto = { checked: 0, made: 0, skipped: [] };
    for (const c of listed.value) {
      const every = asSnapshotSchedule(c.snapshotEvery);
      if (!snapshotDue(every, c.lastSnapshotAt, now)) continue;
      out.checked += 1;
      const [userId, role] = (c.snapshotActor ?? "").split(":");
      if (!userId || !role) { out.skipped.push({ canvasId: c.id, reason: "No one is named to make it." }); continue; }
      const blocker = publishBlocker(c.canvas, asReviewStatus(c.reviewStatus));
      if (blocker) { out.skipped.push({ canvasId: c.id, reason: blocker }); continue; }
      const ctx: AuthenticatedContext = { tenant: { tenantId, userId, role } as never, requestId: "canvas-snapshot" };
      const made = await this.publisher.publish(ctx, c, "PDF");
      if (!made.ok) { out.skipped.push({ canvasId: c.id, reason: made.error.message }); continue; }
      await this.repo.setSnapshot(c.id, tenantId, { lastAt: now });
      out.made += 1;
    }
    return ok(out);
  }
}
