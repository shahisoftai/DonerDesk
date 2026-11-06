import { DomainError, type DefaultPack, type Result, type TenantId } from "@donordesk/domain";
import type { ISetupPackRepository, StoredSetupPack } from "@donordesk/application";
import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

const ok = <T>(value: T): Result<T, DomainError> => ({ ok: true, value });
const err = (e: unknown): Result<never, DomainError> => ({ ok: false, error: new DomainError("CONFLICT", String(e)) });

/** The organisation's own default packs: one row per sector, the pack stored whole. */
export class PrismaSetupPackRepository implements ISetupPackRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(tenantId: TenantId): Promise<Result<StoredSetupPack[], DomainError>> {
    try {
      const rows = await this.prisma.setupDefaultPack.findMany({ where: { tenantId: tenantId.toString() }, orderBy: { sectorKey: "asc" } });
      return ok(rows.map((r) => ({ sectorKey: r.sectorKey, pack: r.packJson as unknown as DefaultPack, updatedAt: r.updatedAt, updatedById: r.updatedById })));
    } catch (e) {
      return err(e);
    }
  }

  async save(tenantId: TenantId, sectorKey: string, pack: DefaultPack, updatedById: string): Promise<Result<void, DomainError>> {
    try {
      const tenant = tenantId.toString();
      await this.prisma.setupDefaultPack.upsert({
        where: { tenantId_sectorKey: { tenantId: tenant, sectorKey } },
        create: { id: randomUUID(), tenantId: tenant, sectorKey, packJson: pack as never, updatedById },
        update: { packJson: pack as never, updatedById },
      });
      return ok(undefined);
    } catch (e) {
      return err(e);
    }
  }

  async remove(tenantId: TenantId, sectorKey: string): Promise<Result<boolean, DomainError>> {
    try {
      const r = await this.prisma.setupDefaultPack.deleteMany({ where: { tenantId: tenantId.toString(), sectorKey } });
      return ok(r.count > 0);
    } catch (e) {
      return err(e);
    }
  }
}
