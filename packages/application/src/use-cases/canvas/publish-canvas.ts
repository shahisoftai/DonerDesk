import { DomainError, asReviewStatus, canEditCanvas, publishBlocker, type ExportFormatId, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ICanvasExportRepository, ICanvasRepository, StoredCanvasExport } from "../../ports/canvas.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { IStorage } from "../../ports/infrastructure.js";
import { can, fail, loadCanvas, ok, viewerOf } from "./canvas-shared.js";
import { renderCanvasFile, type CanvasFileFormat, type RenderDeps } from "./render-canvas-file.js";

export const PUBLISH_FORMATS = ["PNG", "PDF", "SVG", "PPTX"] as const;
export interface CanvasExportDto { id: string; canvasId: string; format: string; sizeBytes: number; createdAt: string; createdById: string }
export const exportDto = (e: StoredCanvasExport): CanvasExportDto => ({ id: e.id, canvasId: e.canvasId, format: e.format, sizeBytes: e.sizeBytes, createdAt: e.createdAt.toISOString(), createdById: e.createdById });

/**
 * Keeps a copy of what the canvas says now: the rendered file in storage, the exact settings it was drawn from and the footer's facts.
 * A published copy is never edited; publishing again makes another. A shared design must pass the Design check, and one for a donor must be approved.
 */
export class PublishCanvasHandler {
  constructor(
    private readonly repo: ICanvasRepository, private readonly exports: ICanvasExportRepository, private readonly deps: RenderDeps, private readonly storage: IStorage,
    private readonly ids: IIdGenerator, private readonly audit: IAuditLogger, private readonly clock: IClock,
  ) {}

  async handle(ctx: AuthenticatedContext, canvasId: string, input: { format: (typeof PUBLISH_FORMATS)[number]; scale?: 1 | 2 | 3 }): Promise<Result<CanvasExportDto, DomainError>> {
    if (!can(ctx, "report.export")) return fail(DomainError.forbidden("You cannot publish files"));
    const found = await loadCanvas(this.repo, ctx, canvasId);
    if (!found.ok) return found;
    if (!canEditCanvas(found.value, viewerOf(ctx))) return fail(DomainError.forbidden("Only someone who can change this canvas can publish it"));
    const blocker = publishBlocker(found.value.canvas, asReviewStatus(found.value.reviewStatus));
    if (blocker) return fail(DomainError.conflict(blocker));
    return this.publish(ctx, found.value, input.format, input.scale);
  }

  /** Shared with the scheduled snapshot, which has already checked the gate. */
  async publish(ctx: AuthenticatedContext, stored: Parameters<typeof renderCanvasFile>[2], format: CanvasFileFormat & ExportFormatId, scale?: 1 | 2 | 3): Promise<Result<CanvasExportDto, DomainError>> {
    const file = await renderCanvasFile(ctx, this.deps, stored, format, scale);
    if (!file.ok) return file;
    const id = this.ids.generate();
    const storageKey = `canvases/${ctx.tenant.tenantId.toString()}/${stored.id}/${id}.${file.value.extension}`;
    await this.storage.put({ key: storageKey, body: file.value.bytes, contentType: file.value.contentType });
    const record: StoredCanvasExport = {
      id, tenantId: ctx.tenant.tenantId, canvasId: stored.id, format, storageKey, sizeBytes: file.value.bytes.length,
      snapshotJson: JSON.stringify({ revision: stored.canvas.revision, design: file.value.configJson, skipped: file.value.skipped }), provenanceJson: JSON.stringify(file.value.provenance),
      createdById: ctx.tenant.userId, createdAt: this.clock.now(),
    };
    const saved = await this.exports.create(record);
    if (!saved.ok) return saved;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "canvas.published", entityType: "canvas_export", entityId: id, newValue: JSON.stringify({ canvasId: stored.id, format, bytes: record.sizeBytes }) });
    return ok(exportDto(record));
  }
}
