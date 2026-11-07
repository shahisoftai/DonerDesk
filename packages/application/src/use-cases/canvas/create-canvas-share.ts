import { randomBytes } from "node:crypto";
import { DomainError, asReviewStatus, canEditCanvas, publishBlocker, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ICanvasExportRepository, ICanvasRepository, ICanvasShareLinkRepository, StoredCanvasShareLink } from "../../ports/canvas.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import { can, fail, loadCanvas, ok, viewerOf } from "./canvas-shared.js";
import { sha256 } from "./canvas-share-links.js";

export interface CreateCanvasShareInput { kind: "LIVE" | "FROZEN"; label: string; expiresInDays: number; exportId?: string | undefined }

/**
 * A public link. LIVE shows the canvas drawn from current data as an outside guest (no finance, no names); FROZEN serves one published
 * copy and nothing else. The token is shown once; only its hash is kept. A canvas that is not allowed to be published is not allowed a link.
 */
export class CreateCanvasShareHandler {
  constructor(private readonly repo: ICanvasRepository, private readonly exports: ICanvasExportRepository, private readonly links: ICanvasShareLinkRepository, private readonly ids: IIdGenerator, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, canvasId: string, input: CreateCanvasShareInput): Promise<Result<{ id: string; token: string; expiresAt: string }, DomainError>> {
    if (!can(ctx, "report.export")) return fail(DomainError.forbidden("You cannot share canvases"));
    const found = await loadCanvas(this.repo, ctx, canvasId);
    if (!found.ok) return found;
    if (!canEditCanvas(found.value, viewerOf(ctx))) return fail(DomainError.forbidden("You cannot share this one"));
    const blocker = publishBlocker(found.value.canvas, asReviewStatus(found.value.reviewStatus));
    if (blocker) return fail(DomainError.conflict(blocker));
    if (input.kind === "FROZEN") {
      const copy = input.exportId ? await this.exports.findById(input.exportId, ctx.tenant.tenantId) : undefined;
      if (!copy || !copy.ok || !copy.value || copy.value.canvasId !== canvasId) return fail(DomainError.validation("Choose a published copy of this canvas to share."));
    }
    const now = this.clock.now();
    const token = randomBytes(24).toString("base64url");
    const link: StoredCanvasShareLink = {
      id: this.ids.generate(), tenantId: ctx.tenant.tenantId, canvasId, kind: input.kind, ...(input.kind === "FROZEN" && input.exportId ? { exportId: input.exportId } : {}), label: input.label.trim() || "Link",
      tokenHash: sha256(token), expiresAt: new Date(now.getTime() + input.expiresInDays * 86_400_000), createdById: ctx.tenant.userId, createdAt: now,
    };
    const saved = await this.links.create(link);
    if (!saved.ok) return saved;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "canvas.share.created", entityType: "canvas_share_link", entityId: link.id, newValue: JSON.stringify({ canvasId, kind: input.kind }) });
    return ok({ id: link.id, token, expiresAt: link.expiresAt.toISOString() });
  }
}
