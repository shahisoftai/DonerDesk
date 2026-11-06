import { DomainError, canCreateCanvas, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { ICanvasRepository, StoredCanvas } from "../../ports/canvas.js";
import { can, dtoOf, fail, loadCanvas, ok, viewerOf, type CanvasDto } from "./canvas-shared.js";

export class DuplicateCanvasHandler {
  constructor(private readonly ids: IIdGenerator, private readonly repo: ICanvasRepository, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  /** A copy is always the caller's own (personal): sharing it is a separate, deliberate step. Its source link is not copied, so converting the original again still finds the original. */
  async handle(ctx: AuthenticatedContext, id: string): Promise<Result<CanvasDto, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot make dashboards or infographics"));
    const found = await loadCanvas(this.repo, ctx, id);
    if (!found.ok) return found;
    if (!canCreateCanvas("MINE", viewerOf(ctx))) return fail(DomainError.forbidden("You cannot make a copy"));
    const newId = this.ids.generate();
    const now = this.clock.now();
    const title = `${found.value.title} (copy)`.slice(0, 120);
    const copy: StoredCanvas = { id: newId, tenantId: ctx.tenant.tenantId, scope: "MINE", mode: found.value.mode, ownerId: ctx.tenant.userId, title, canvas: { ...structuredClone(found.value.canvas), id: newId, title, scope: "MINE", revision: 1 }, createdAt: now, updatedAt: now };
    const r = await this.repo.create(copy);
    if (!r.ok) return r;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "canvas.duplicated", entityType: "canvas", entityId: newId, newValue: JSON.stringify({ from: id }) });
    return ok(dtoOf(copy, ctx));
  }
}
