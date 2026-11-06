import { DomainError, blankCanvas, canCreateCanvas, canvasProblems, canvasScopeProblem, type Canvas, type CanvasMode, type CanvasPage, type CanvasProfile, type CanvasScope, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { ICanvasRepository, StoredCanvas } from "../../ports/canvas.js";
import type { VisibleProjects } from "../../services/visible-projects.js";
import { can, dtoOf, fail, ok, viewerOf, type CanvasDto } from "./canvas-shared.js";

export interface CreateCanvasInput {
  title: string; scope: CanvasScope; projectId?: string | undefined; mode?: CanvasMode | undefined; profile?: CanvasProfile | undefined; language?: string | undefined; themeId?: string | undefined; format?: string | undefined;
  /** Pages to start from (a template applied, or a copy); absent = one empty page. */
  pages?: CanvasPage[] | undefined; options?: Canvas["options"];
}

export class CreateCanvasHandler {
  constructor(private readonly ids: IIdGenerator, private readonly repo: ICanvasRepository, private readonly visible: VisibleProjects, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, input: CreateCanvasInput): Promise<Result<CanvasDto, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot make dashboards or infographics"));
    if (!canCreateCanvas(input.scope, viewerOf(ctx))) return fail(DomainError.forbidden("Only people who manage shared work can make a shared one"));
    const scopeProblem = canvasScopeProblem({ scope: input.scope, projectId: input.projectId });
    if (scopeProblem) return fail(DomainError.validation(scopeProblem));
    if (input.projectId) {
      const mine = await this.visible.for(ctx);
      if (!mine.ok) return mine;
      if (!mine.value.some((p) => p.id === input.projectId)) return fail(DomainError.notFound("Project", input.projectId));
    }
    const id = this.ids.generate();
    const base = blankCanvas({ id, title: input.title.trim(), scope: input.scope, ...(input.mode ? { mode: input.mode } : {}), ...(input.profile ? { profile: input.profile } : {}), ...(input.language ? { language: input.language } : {}), ...(input.themeId ? { themeId: input.themeId } : {}), ...(input.format ? { format: input.format } : {}) });
    const canvas: Canvas = { ...base, ...(input.pages?.length ? { pages: input.pages } : {}), ...(input.options ? { options: input.options } : {}) };
    // A canvas made from pages (a template, a copy) must be sound; an empty one has nothing to check.
    if (input.pages?.length) { const bad = canvasProblems(canvas)[0]; if (bad) return fail(DomainError.validation(bad.message)); }
    const now = this.clock.now();
    const stored: StoredCanvas = { id, tenantId: ctx.tenant.tenantId, scope: input.scope, mode: canvas.mode, ...(input.projectId ? { projectId: input.projectId } : {}), ownerId: ctx.tenant.userId, title: canvas.title, canvas, createdAt: now, updatedAt: now };
    const created = await this.repo.create(stored);
    if (!created.ok) return created;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "canvas.created", entityType: "canvas", entityId: id, newValue: JSON.stringify({ scope: input.scope, blocks: canvas.pages.reduce((n, p) => n + p.blocks.length, 0) }) });
    return ok(dtoOf(stored, ctx));
  }
}
