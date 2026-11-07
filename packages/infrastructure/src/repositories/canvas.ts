import { TenantId, asReviewStatus, asSnapshotSchedule, canvasFromColumns, documentOf, ok, type ReviewStatus, type Result } from "@donordesk/domain";
import type { CanvasSourceKind, ICanvasRepository, StoredCanvas } from "@donordesk/application";
import type { PrismaClient } from "@prisma/client";

type Row = NonNullable<Awaited<ReturnType<PrismaClient["canvas"]["findFirst"]>>>;

/** A row whose document cannot be read is skipped, never an error: one damaged canvas must not take a list down. */
function fromRow(r: Row): StoredCanvas | null {
  const canvas = canvasFromColumns({ id: r.id, scope: r.scope, mode: r.mode, title: r.title, revision: r.revision, docJson: r.docJson });
  if (!canvas) return null;
  return {
    id: r.id, tenantId: TenantId.create(r.tenantId), scope: canvas.scope, mode: canvas.mode, ...(r.projectId ? { projectId: r.projectId } : {}), ownerId: r.ownerId, title: r.title, canvas,
    ...(r.sourceKind ? { sourceKind: r.sourceKind as CanvasSourceKind } : {}), ...(r.sourceId ? { sourceId: r.sourceId } : {}), reviewStatus: asReviewStatus(r.reviewStatus), ...(r.reviewedById ? { reviewedById: r.reviewedById } : {}), ...(r.reviewNote ? { reviewNote: r.reviewNote } : {}),
    snapshotEvery: asSnapshotSchedule(r.snapshotEvery), ...(r.lastSnapshotAt ? { lastSnapshotAt: r.lastSnapshotAt } : {}), ...(r.snapshotActor ? { snapshotActor: r.snapshotActor } : {}), createdAt: r.createdAt, updatedAt: r.updatedAt,
  };
}

export class PrismaCanvasRepository implements ICanvasRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(c: StoredCanvas): Promise<Result<boolean>> {
    try {
      await this.prisma.canvas.create({ data: {
        id: c.id, tenantId: c.tenantId.toString(), scope: c.scope, mode: c.mode, projectId: c.projectId ?? null, ownerId: c.ownerId, title: c.title, docJson: documentOf(c.canvas),
        revision: c.canvas.revision, sourceKind: c.sourceKind ?? null, sourceId: c.sourceId ?? null,
      } });
      return ok(true);
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") return ok(false);
      throw e;
    }
  }

  async update(c: StoredCanvas, expectedRevision: number): Promise<Result<boolean>> {
    const done = await this.prisma.canvas.updateMany({
      where: { id: c.id, tenantId: c.tenantId.toString(), revision: expectedRevision },
      data: { title: c.title, mode: c.mode, projectId: c.projectId ?? null, docJson: documentOf(c.canvas), revision: expectedRevision + 1, reviewStatus: c.reviewStatus ?? "DRAFT", reviewedById: c.reviewedById ?? null, reviewNote: c.reviewNote ?? null },
    });
    return ok(done.count > 0);
  }

  async setReview(id: string, tenantId: TenantId, review: { status: ReviewStatus; reviewedById?: string; note?: string }): Promise<Result<void>> {
    await this.prisma.canvas.updateMany({ where: { id, tenantId: tenantId.toString() }, data: { reviewStatus: review.status, reviewedById: review.reviewedById ?? null, reviewNote: review.note ?? null } });
    return ok(undefined);
  }

  async setSnapshot(id: string, tenantId: TenantId, change: { every?: string; lastAt?: Date; actor?: string }): Promise<Result<void>> {
    await this.prisma.canvas.updateMany({ where: { id, tenantId: tenantId.toString() }, data: { ...(change.every ? { snapshotEvery: change.every } : {}), ...(change.lastAt ? { lastSnapshotAt: change.lastAt } : {}), ...(change.actor ? { snapshotActor: change.actor } : {}) } });
    return ok(undefined);
  }

  async listScheduled(tenantId: TenantId): Promise<Result<StoredCanvas[]>> {
    const rows = await this.prisma.canvas.findMany({ where: { tenantId: tenantId.toString(), snapshotEvery: { not: "NONE" } } });
    return ok(rows.map(fromRow).filter((c): c is StoredCanvas => c !== null));
  }

  async delete(id: string, tenantId: TenantId): Promise<Result<void>> {
    const tenant = tenantId.toString();
    // A deleted canvas takes its links (they would otherwise stay usable), history and kept-copy records with it; the kept files in storage are not touched here.
    await this.prisma.canvasShareLink.deleteMany({ where: { canvasId: id, tenantId: tenant } });
    await this.prisma.canvasVersion.deleteMany({ where: { canvasId: id, tenantId: tenant } });
    await this.prisma.canvasExport.deleteMany({ where: { canvasId: id, tenantId: tenant } });
    await this.prisma.canvas.deleteMany({ where: { id, tenantId: tenant } });
    return ok(undefined);
  }

  async findById(id: string, tenantId: TenantId): Promise<Result<StoredCanvas | null>> {
    const r = await this.prisma.canvas.findFirst({ where: { id, tenantId: tenantId.toString() } });
    return ok(r ? fromRow(r) : null);
  }

  async findBySource(tenantId: TenantId, kind: CanvasSourceKind, sourceId: string): Promise<Result<StoredCanvas | null>> {
    const r = await this.prisma.canvas.findFirst({ where: { tenantId: tenantId.toString(), sourceKind: kind, sourceId } });
    return ok(r ? fromRow(r) : null);
  }

  async listVisible(tenantId: TenantId, ownerId: string, projectId?: string): Promise<Result<StoredCanvas[]>> {
    const rows = await this.prisma.canvas.findMany({
      where: { tenantId: tenantId.toString(), OR: [{ scope: "ORG" }, { scope: "PORTFOLIO" }, { scope: "MINE", ownerId }, ...(projectId ? [{ scope: "PROJECT", projectId }] : [{ scope: "PROJECT" }])] },
      orderBy: { updatedAt: "desc" },
    });
    return ok(rows.map(fromRow).filter((c): c is StoredCanvas => c !== null));
  }
}
