import { DomainError, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ICanvasExportRepository, ICanvasRepository } from "../../ports/canvas.js";
import { can, fail, loadCanvas, ok } from "./canvas-shared.js";
import { exportDto, type CanvasExportDto } from "./publish-canvas.js";

export class ListCanvasExportsHandler {
  constructor(private readonly repo: ICanvasRepository, private readonly exports: ICanvasExportRepository) {}
  async handle(ctx: AuthenticatedContext, canvasId: string): Promise<Result<CanvasExportDto[], DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot see published files"));
    const found = await loadCanvas(this.repo, ctx, canvasId);
    if (!found.ok) return found;
    const listed = await this.exports.listByCanvas(canvasId, ctx.tenant.tenantId);
    return listed.ok ? ok(listed.value.map(exportDto)) : listed;
  }
}
