import { DomainError, EXPORT_FORMATS, type Result, type TenantId } from "@donordesk/domain";
import type { ICanvasExportRepository } from "../../ports/canvas.js";
import type { IStorage } from "../../ports/infrastructure.js";
import { fail, ok } from "./canvas-shared.js";
import type { StoredFileDto } from "./get-canvas-export-file.js";

/** The one published copy a FROZEN link serves. */
export class GetCanvasShareFileHandler {
  constructor(private readonly exports: ICanvasExportRepository, private readonly storage: IStorage) {}
  async handle(tenantId: TenantId, canvasId: string, exportId: string): Promise<Result<StoredFileDto, DomainError>> {
    const found = await this.exports.findById(exportId, tenantId);
    if (!found.ok || !found.value || found.value.canvasId !== canvasId) return fail(DomainError.notFound("File", "unavailable"));
    const info = EXPORT_FORMATS[found.value.format];
    return ok({ bytes: await this.storage.read(found.value.storageKey), contentType: info.mime, fileName: `canvas.${info.extension}` });
  }
}
