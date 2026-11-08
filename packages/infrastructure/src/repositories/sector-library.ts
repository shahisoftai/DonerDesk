import { TenantId, ok, type OrgEntryKind, type Result } from "@donordesk/domain";
import type { IOrganisationLibraryStore, OrganisationLibraryRecord } from "@donordesk/application";
import type { PrismaClient } from "@prisma/client";

const parse = (text: string): unknown => { try { return JSON.parse(text); } catch { return null; } };

/** An organisation's own library records. Every call names the organisation; a damaged payload reads as null (the domain then skips it). */
export class PrismaOrganisationLibraryStore implements IOrganisationLibraryStore {
  constructor(private readonly prisma: PrismaClient) {}

  async list(tenantId: TenantId): Promise<Result<OrganisationLibraryRecord[]>> {
    const rows = await this.prisma.organisationLibraryEntry.findMany({ where: { tenantId: tenantId.toString() }, orderBy: { createdAt: "asc" } });
    return ok(rows.map((r) => ({ entryId: r.entryId, kind: r.kind as OrgEntryKind, payload: parse(r.payloadJson), libraryVersion: r.libraryVersion, updatedById: r.updatedById, updatedAt: r.updatedAt })));
  }

  async upsert(tenantId: TenantId, record: Omit<OrganisationLibraryRecord, "updatedAt">): Promise<Result<void>> {
    const t = tenantId.toString();
    await this.prisma.organisationLibraryEntry.upsert({
      where: { tenantId_entryId_kind: { tenantId: t, entryId: record.entryId, kind: record.kind } },
      create: { id: `${t.slice(0, 8)}-${record.kind}-${record.entryId}`.slice(0, 120), tenantId: t, entryId: record.entryId, kind: record.kind, payloadJson: JSON.stringify(record.payload), libraryVersion: record.libraryVersion, updatedById: record.updatedById },
      update: { payloadJson: JSON.stringify(record.payload), libraryVersion: record.libraryVersion, updatedById: record.updatedById },
    });
    return ok(undefined);
  }

  async remove(tenantId: TenantId, entryId: string, kind: OrgEntryKind): Promise<Result<void>> {
    await this.prisma.organisationLibraryEntry.deleteMany({ where: { tenantId: tenantId.toString(), entryId, kind } });
    return ok(undefined);
  }
}
