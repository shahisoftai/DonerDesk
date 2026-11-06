import { TenantId, canvasFromColumns, documentOf, ok, type Result } from "@donordesk/domain";
import type { CanvasSourceKind, ICanvasRepository, StoredCanvas } from "@donordesk/application";
import type { PrismaClient } from "@prisma/client";

type Row = NonNullable<Awaited<ReturnType<PrismaClient["canvas"]["findFirst"]>>>;

/** A row whose document cannot be read is skipped, never an error: one damaged canvas must not take a list down. */
function fromRow(r: Row): StoredCanvas | null {
  const canvas = canvasFromColumns({ id: r.id, scope: r.scope, mode: r.mode, title: r.title, revision: r.revision, docJson: r.docJson });
  if (!canvas) return null;
  return {
    id: r.id, tenantId: TenantId.create(r.tenantId), scope: canvas.scope, mode: canvas.mode, ...(r.projectId ? { projectId: r.projectId } : {}), ownerId: r.ownerId, title: r.title, canvas,
    ...(r.sourceKind ? { sourceKind: r.sourceKind as CanvasSourceKind } : {}), ...(r.sourceId ? { sourceId: r.sourceId } : {}), createdAt: r.createdAt, updatedAt: r.updatedAt,
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
      data: { title: c.title, mode: c.mode, projectId: c.projectId ?? null, docJson: documentOf(c.canvas), revision: expectedRevision + 1 },
    });
    return ok(done.count > 0);
  }

  async delete(id: string, tenantId: TenantId): Promise<Result<void>> {
    await this.prisma.canvas.deleteMany({ where: { id, tenantId: tenantId.toString() } });
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
