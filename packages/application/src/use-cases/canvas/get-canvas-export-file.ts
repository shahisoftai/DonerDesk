import { DomainError, type Result, EXPORT_FORMATS } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ICanvasExportRepository, ICanvasRepository } from "../../ports/canvas.js";
import type { IStorage } from "../../ports/infrastructure.js";
import { can, fail, loadCanvas, ok } from "./canvas-shared.js";

export interface StoredFileDto { bytes: Buffer; contentType: string; fileName: string }

export class GetCanvasExportFileHandler {
  constructor(private readonly repo: ICanvasRepository, private readonly exports: ICanvasExportRepository, private readonly storage: IStorage) {}
  async handle(ctx: AuthenticatedContext, canvasId: string, exportId: string): Promise<Result<StoredFileDto, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot see published files"));
    const canvas = await loadCanvas(this.repo, ctx, canvasId);
    if (!canvas.ok) return canvas;
    const found = await this.exports.findById(exportId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value || found.value.canvasId !== canvasId) return fail(DomainError.notFound("Published file", exportId));
    const info = EXPORT_FORMATS[found.value.format];
    return ok({ bytes: await this.storage.read(found.value.storageKey), contentType: info.mime, fileName: `${canvas.value.title.replace(/[^\w.-]+/g, "-").slice(0, 60) || "canvas"}.${info.extension}` });
  }
}
