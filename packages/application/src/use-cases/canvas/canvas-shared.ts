import { DomainError, Permissions, canEditCanvas, canSeeCanvas, type Canvas, type CanvasScope, type Result, type Role } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ICanvasRepository, StoredCanvas } from "../../ports/canvas.js";

export const can = (ctx: AuthenticatedContext, permission: Parameters<typeof Permissions.can>[1]) => Permissions.can(ctx.tenant.role as Role, permission);
export const fail = <T>(error: DomainError): Result<T, DomainError> => ({ ok: false, error });
export const ok = <T>(value: T): Result<T, DomainError> => ({ ok: true, value });
export const viewerOf = (ctx: AuthenticatedContext) => ({ userId: ctx.tenant.userId, canManageShared: can(ctx, "project.edit") });

export interface CanvasSummaryDto {
  id: string; title: string; scope: CanvasScope; mode: Canvas["mode"]; profile: Canvas["profile"]; projectId?: string; ownerId: string;
  mine: boolean; canEdit: boolean; blockCount: number; pageCount: number; revision: number; updatedAt: string;
  sourceKind?: string;
  reviewStatus: string; reviewNote?: string; snapshotEvery: string; lastSnapshotAt?: string;
}
export interface CanvasDto extends CanvasSummaryDto { canvas: Canvas }

export function summaryOf(c: StoredCanvas, ctx: AuthenticatedContext): CanvasSummaryDto {
  return {
    id: c.id, title: c.title, scope: c.scope, mode: c.mode, profile: c.canvas.profile, ...(c.projectId ? { projectId: c.projectId } : {}), ownerId: c.ownerId,
    mine: c.ownerId === ctx.tenant.userId, canEdit: canEditCanvas(c, viewerOf(ctx)), blockCount: c.canvas.pages.reduce((n, p) => n + p.blocks.length, 0),
    pageCount: c.canvas.pages.length, revision: c.canvas.revision, updatedAt: c.updatedAt.toISOString(), ...(c.sourceKind ? { sourceKind: c.sourceKind } : {}),
    reviewStatus: c.reviewStatus ?? "DRAFT", ...(c.reviewNote ? { reviewNote: c.reviewNote } : {}), snapshotEvery: c.snapshotEvery ?? "NONE", ...(c.lastSnapshotAt ? { lastSnapshotAt: c.lastSnapshotAt.toISOString() } : {}),
  };
}
export const dtoOf = (c: StoredCanvas, ctx: AuthenticatedContext): CanvasDto => ({ ...summaryOf(c, ctx), canvas: { ...c.canvas, id: c.id, title: c.title, scope: c.scope, mode: c.mode } });

/** A personal canvas that is not yours does not exist as far as you can tell. */
export async function loadCanvas(repo: ICanvasRepository, ctx: AuthenticatedContext, id: string): Promise<Result<StoredCanvas, DomainError>> {
  const found = await repo.findById(id, ctx.tenant.tenantId);
  if (!found.ok) return found;
  if (!found.value || !canSeeCanvas(found.value, viewerOf(ctx))) return fail(DomainError.notFound("Canvas", id));
  return ok(found.value);
}
