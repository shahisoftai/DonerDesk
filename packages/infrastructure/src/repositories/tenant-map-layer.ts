import type { ITenantMapLayerRepository, TenantMapLayerRecord } from "@donordesk/application";
import { TenantId } from "@donordesk/domain";
import type { PrismaClient } from "@prisma/client";

type Row = NonNullable<Awaited<ReturnType<PrismaClient["tenantMapLayer"]["findUnique"]>>>;

function recordFrom(row: Row): TenantMapLayerRecord {
  return {
    id: row.id,
    tenantId: TenantId.create(row.tenantId),
    name: row.name,
    storageKey: row.storageKey,
    sizeBytes: row.sizeBytes,
    featureCount: row.featureCount,
    uploadedById: row.uploadedById,
    updatedAt: row.updatedAt,
  };
}

export class PrismaTenantMapLayerRepository implements ITenantMapLayerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByTenant(tenantId: TenantId): Promise<TenantMapLayerRecord | null> {
    const row = await this.prisma.tenantMapLayer.findUnique({ where: { tenantId: tenantId.toString() } });
    return row ? recordFrom(row) : null;
  }

  async save(layer: TenantMapLayerRecord): Promise<void> {
    await this.prisma.tenantMapLayer.upsert({
      where: { tenantId: layer.tenantId.toString() },
      update: {
        name: layer.name,
        storageKey: layer.storageKey,
        sizeBytes: layer.sizeBytes,
        featureCount: layer.featureCount,
        uploadedById: layer.uploadedById,
      },
      create: {
        id: layer.id,
        tenantId: layer.tenantId.toString(),
        name: layer.name,
        storageKey: layer.storageKey,
        sizeBytes: layer.sizeBytes,
        featureCount: layer.featureCount,
        uploadedById: layer.uploadedById,
      },
    });
  }

  async remove(tenantId: TenantId): Promise<void> {
    await this.prisma.tenantMapLayer.deleteMany({ where: { tenantId: tenantId.toString() } });
  }
}
