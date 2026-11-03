import type { ITenantBoundaryLayerRepository, TenantBoundaryLayerRecord } from "@donordesk/application";
import { TenantId } from "@donordesk/domain";
import type { PrismaClient } from "@prisma/client";

type Row = NonNullable<Awaited<ReturnType<PrismaClient["tenantBoundaryLayer"]["findFirst"]>>>;

function recordFrom(row: Row): TenantBoundaryLayerRecord {
  return {
    id: row.id, tenantId: TenantId.create(row.tenantId), iso: row.iso, countryName: row.countryName, adminLevel: row.adminLevel, name: row.name,
    nameField: row.nameField, pcodeField: row.pcodeField, parentPcodeField: row.parentPcodeField, storageKey: row.storageKey,
    sizeBytes: row.sizeBytes, featureCount: row.featureCount, uploadedById: row.uploadedById, updatedAt: row.updatedAt,
  };
}

export class PrismaTenantBoundaryLayerRepository implements ITenantBoundaryLayerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(tenantId: TenantId): Promise<TenantBoundaryLayerRecord[]> {
    const rows = await this.prisma.tenantBoundaryLayer.findMany({ where: { tenantId: tenantId.toString() }, orderBy: [{ countryName: "asc" }, { adminLevel: "asc" }] });
    return rows.map(recordFrom);
  }

  async find(tenantId: TenantId, iso: string, adminLevel: number): Promise<TenantBoundaryLayerRecord | null> {
    const row = await this.prisma.tenantBoundaryLayer.findFirst({ where: { tenantId: tenantId.toString(), iso, adminLevel } });
    return row ? recordFrom(row) : null;
  }

  /** Replaces the layer for the same country and level; every mutable field is written, `?? null` so a cleared field is cleared. */
  async save(layer: TenantBoundaryLayerRecord): Promise<void> {
    const data = {
      countryName: layer.countryName, name: layer.name, nameField: layer.nameField, pcodeField: layer.pcodeField ?? null, parentPcodeField: layer.parentPcodeField ?? null,
      storageKey: layer.storageKey, sizeBytes: layer.sizeBytes, featureCount: layer.featureCount, uploadedById: layer.uploadedById,
    };
    await this.prisma.tenantBoundaryLayer.upsert({
      where: { tenantId_iso_adminLevel: { tenantId: layer.tenantId.toString(), iso: layer.iso, adminLevel: layer.adminLevel } },
      update: data,
      create: { id: layer.id, tenantId: layer.tenantId.toString(), iso: layer.iso, adminLevel: layer.adminLevel, ...data },
    });
  }

  async remove(tenantId: TenantId, iso: string, adminLevel: number): Promise<boolean> {
    const r = await this.prisma.tenantBoundaryLayer.deleteMany({ where: { tenantId: tenantId.toString(), iso, adminLevel } });
    return r.count > 0;
  }
}
