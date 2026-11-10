import { TenantId, ok, type Result } from "@donordesk/domain";
import type { IPlaceFlowRepository, StoredPlaceFlow } from "@donordesk/application";
import type { PrismaClient } from "@prisma/client";

type Row = NonNullable<Awaited<ReturnType<PrismaClient["placeFlow"]["findFirst"]>>>;
const from = (r: Row): StoredPlaceFlow => ({ id: r.id, tenantId: TenantId.create(r.tenantId), projectId: r.projectId, fromPlaceId: r.fromPlaceId, toPlaceId: r.toPlaceId, what: r.what, quantity: r.quantity, unit: r.unit, ...(r.note ? { note: r.note } : {}), createdById: r.createdById, createdAt: r.createdAt });

export class PrismaPlaceFlowRepository implements IPlaceFlowRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(f: StoredPlaceFlow): Promise<Result<void>> {
    await this.prisma.placeFlow.create({ data: { id: f.id, tenantId: f.tenantId.toString(), projectId: f.projectId, fromPlaceId: f.fromPlaceId, toPlaceId: f.toPlaceId, what: f.what, quantity: f.quantity, unit: f.unit, note: f.note ?? null, createdById: f.createdById } });
    return ok(undefined);
  }

  async delete(id: string, tenantId: TenantId, projectId: string): Promise<Result<void>> {
    await this.prisma.placeFlow.deleteMany({ where: { id, tenantId: tenantId.toString(), projectId } });
    return ok(undefined);
  }

  async listByProject(tenantId: TenantId, projectId: string): Promise<Result<StoredPlaceFlow[]>> {
    return ok((await this.prisma.placeFlow.findMany({ where: { tenantId: tenantId.toString(), projectId }, orderBy: { createdAt: "asc" }, take: 600 })).map(from));
  }
}
