import { DomainError, type Canvas, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ICanvasRepository, ICanvasVersionRepository } from "../../ports/canvas.js";
import { can, fail, loadCanvas, ok } from "./canvas-shared.js";

export interface CanvasVersionDto { revision: number; title: string; savedById: string; savedAt: string }
const KEPT = 30;

/** The earlier versions of a canvas (newest first) and, for one revision, its document, so the editor can put it back as an edit. */
export class ListCanvasVersionsHandler {
  constructor(private readonly repo: ICanvasRepository, private readonly versions: ICanvasVersionRepository) {}

  async list(ctx: AuthenticatedContext, canvasId: string): Promise<Result<CanvasVersionDto[], DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot see earlier versions"));
    const found = await loadCanvas(this.repo, ctx, canvasId);
    if (!found.ok) return found;
    const listed = await this.versions.list(canvasId, ctx.tenant.tenantId, KEPT);
    return listed.ok ? ok(listed.value.map((v) => ({ revision: v.revision, title: v.title, savedById: v.savedById, savedAt: v.createdAt.toISOString() }))) : listed;
  }

  async get(ctx: AuthenticatedContext, canvasId: string, revision: number): Promise<Result<{ revision: number; title: string; canvas: Canvas }, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot see earlier versions"));
    const found = await loadCanvas(this.repo, ctx, canvasId);
    if (!found.ok) return found;
    const v = await this.versions.find(canvasId, revision, ctx.tenant.tenantId);
    if (!v.ok) return v;
    if (!v.value) return fail(DomainError.notFound("Version", String(revision)));
    return ok({ revision: v.value.revision, title: v.value.title, canvas: v.value.canvas });
  }
}
