import { DomainError, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ICanvasRepository } from "../../ports/canvas.js";
import { can, dtoOf, fail, loadCanvas, ok, type CanvasDto } from "./canvas-shared.js";

export class GetCanvasHandler {
  constructor(private readonly repo: ICanvasRepository) {}
  async handle(ctx: AuthenticatedContext, id: string): Promise<Result<CanvasDto, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot see dashboards or infographics"));
    const c = await loadCanvas(this.repo, ctx, id);
    return c.ok ? ok(dtoOf(c.value, ctx)) : c;
  }
}
