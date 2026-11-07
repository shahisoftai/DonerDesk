import { DomainError, canEditCanvas, type SnapshotSchedule, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ICanvasRepository } from "../../ports/canvas.js";
import type { IAuditLogger } from "../../ports/core.js";
import { can, fail, loadCanvas, ok, viewerOf } from "./canvas-shared.js";

/** Switches the scheduled snapshot of a canvas on or off. Snapshots are made as the person who switched them on, so they show nothing that person could not publish. */
export class SetCanvasSnapshotsHandler {
  constructor(private readonly repo: ICanvasRepository, private readonly audit: IAuditLogger) {}
  async handle(ctx: AuthenticatedContext, canvasId: string, every: SnapshotSchedule): Promise<Result<{ every: SnapshotSchedule }, DomainError>> {
    if (!can(ctx, "report.export")) return fail(DomainError.forbidden("You cannot schedule snapshots"));
    const found = await loadCanvas(this.repo, ctx, canvasId);
    if (!found.ok) return found;
    if (!canEditCanvas(found.value, viewerOf(ctx))) return fail(DomainError.forbidden("You cannot change this one"));
    const done = await this.repo.setSnapshot(canvasId, ctx.tenant.tenantId, { every, actor: `${ctx.tenant.userId}:${ctx.tenant.role}` });
    if (!done.ok) return done;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "canvas.snapshots.set", entityType: "canvas", entityId: canvasId, newValue: JSON.stringify({ every }) });
    return ok({ every });
  }
}
