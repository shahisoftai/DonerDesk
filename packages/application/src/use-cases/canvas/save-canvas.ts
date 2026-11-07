import { DomainError, canEditCanvas, canvasContentProblems, canvasStructureProblems, type Canvas, type CanvasMode, type CanvasPage, type CanvasProfile, type CanvasProblem, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock } from "../../ports/core.js";
import type { ICanvasRepository, ICanvasVersionRepository, StoredCanvas } from "../../ports/canvas.js";
import { can, dtoOf, fail, loadCanvas, ok, viewerOf, type CanvasDto } from "./canvas-shared.js";

export interface SaveCanvasInput {
  id: string; expectedRevision: number; title: string; pages: CanvasPage[]; profile: CanvasProfile; mode?: CanvasMode | undefined; language: string; themeId: string; options?: Canvas["options"];
}
export interface SavedCanvasDto { canvas: CanvasDto; /** What is not set up yet; informs the editor and gates sharing, never stops a save. */ problems: CanvasProblem[] }

export class SaveCanvasHandler {
  constructor(private readonly repo: ICanvasRepository, private readonly audit: IAuditLogger, private readonly clock: IClock, private readonly versions?: ICanvasVersionRepository) {}

  /** Stores the canvas as sent if its shape is sound (work in progress is fine: a block that needs its indicator is saved and reported). A save over someone else's change is refused. */
  async handle(ctx: AuthenticatedContext, input: SaveCanvasInput): Promise<Result<SavedCanvasDto, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot change dashboards or infographics"));
    const found = await loadCanvas(this.repo, ctx, input.id);
    if (!found.ok) return found;
    if (!canEditCanvas(found.value, viewerOf(ctx))) return fail(DomainError.forbidden("You cannot change this one"));
    const canvas: Canvas = { ...found.value.canvas, title: input.title.trim(), pages: input.pages, profile: input.profile, language: input.language, themeId: input.themeId, mode: input.mode ?? found.value.mode, ...(input.options ? { options: input.options } : {}), revision: input.expectedRevision };
    const shape = canvasStructureProblems(canvas)[0];
    if (shape) return fail(DomainError.validation(shape.message));
    // Any saved change puts a reviewed canvas back to a draft: what was approved is what is published.
    const stored: StoredCanvas = { ...found.value, title: canvas.title, mode: canvas.mode, canvas, updatedAt: this.clock.now(), reviewStatus: "DRAFT" };
    delete stored.reviewedById; delete stored.reviewNote;
    // The document being replaced is kept (a repeat of the same revision is ignored by the store).
    if (this.versions && found.value.canvas.revision === input.expectedRevision) {
      await this.versions.add({ id: `${input.id}:${input.expectedRevision}`, tenantId: ctx.tenant.tenantId, canvasId: input.id, revision: input.expectedRevision, title: found.value.title, canvas: found.value.canvas, savedById: ctx.tenant.userId, createdAt: this.clock.now() });
    }
    const done = await this.repo.update(stored, input.expectedRevision);
    if (!done.ok) return done;
    if (!done.value) return fail(DomainError.conflict("This was changed somewhere else since you opened it. Nothing was saved. Reload to see that version, then make your changes again."));
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "canvas.saved", entityType: "canvas", entityId: input.id, newValue: JSON.stringify({ revision: input.expectedRevision + 1, blocks: canvas.pages.reduce((n, p) => n + p.blocks.length, 0) }) });
    const now: StoredCanvas = { ...stored, canvas: { ...canvas, revision: input.expectedRevision + 1 } };
    return ok({ canvas: dtoOf(now, ctx), problems: canvasContentProblems(now.canvas) });
  }
}
