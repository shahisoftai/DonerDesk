import { ok, err, DomainError, type FacilityType, type Result, type TenantId } from "@donordesk/domain";
import type { IFacilityTypeRepository } from "@donordesk/application";
import type { PrismaClient } from "@prisma/client";

/** The organisation's facility types (Phase 50.3b) on its own row. The organisation is found by `tenantId`, never by its primary key. */
export class PrismaFacilityTypeRepository implements IFacilityTypeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async find(tenantId: TenantId): Promise<Result<FacilityType[]>> {
    const org = await this.prisma.organization.findFirst({ where: { tenantId: tenantId.toString() }, select: { facilityTypesJson: true } });
    const raw = org?.facilityTypesJson;
    if (!Array.isArray(raw)) return ok([]);
    return ok(raw.flatMap((t) => (t && typeof t === "object" && typeof (t as { key?: unknown }).key === "string" && typeof (t as { label?: unknown }).label === "string"
      ? [{ key: (t as { key: string }).key, label: (t as { label: string }).label, ...(typeof (t as { sector?: unknown }).sector === "string" ? { sector: (t as { sector: string }).sector } : {}) }] : [])));
  }

  async save(tenantId: TenantId, types: FacilityType[]): Promise<Result<void>> {
    const r = await this.prisma.organization.updateMany({ where: { tenantId: tenantId.toString() }, data: { facilityTypesJson: types as unknown as object } });
    return r.count === 1 ? ok(undefined) : err(DomainError.notFound("Organization", tenantId.toString()));
  }
}
