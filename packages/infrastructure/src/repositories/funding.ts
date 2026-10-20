import type { PrismaClient } from "@prisma/client";
import type { CleanGrant, DomainError, FundingStatus, GrantRecord, ProgrammeRecord, Result, TenantId } from "@donordesk/domain";
import type { IFundingRepository } from "@donordesk/application";

function ok<T>(value: T): Result<T, DomainError> {
  return { ok: true, value };
}

const programme = (r: { id: string; tenantId: string; name: string; code: string | null; description: string | null; status: string; createdById: string; createdAt: Date }): ProgrammeRecord => ({
  id: r.id, tenantId: r.tenantId, name: r.name, code: r.code ?? undefined, description: r.description ?? undefined, status: r.status as FundingStatus, createdById: r.createdById, createdAt: r.createdAt,
});

const grant = (r: { id: string; tenantId: string; programmeId: string | null; title: string; donorName: string; awardNumber: string | null; amount: string | null; currency: string | null; startDate: Date | null; endDate: Date | null; status: string; createdById: string; createdAt: Date }): GrantRecord => ({
  id: r.id, tenantId: r.tenantId, programmeId: r.programmeId ?? undefined, title: r.title, donorName: r.donorName, awardNumber: r.awardNumber ?? undefined,
  amount: r.amount ?? undefined, currency: r.currency ?? undefined, startDate: r.startDate ?? undefined, endDate: r.endDate ?? undefined,
  status: r.status as FundingStatus, createdById: r.createdById, createdAt: r.createdAt,
});

/** Programmes, grants and project placement. A project's placement is written here only, never by `Project.update`. */
export class PrismaFundingRepository implements IFundingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listProgrammes(tenantId: TenantId): Promise<Result<ProgrammeRecord[], DomainError>> {
    return ok((await this.prisma.programme.findMany({ where: { tenantId: tenantId.toString() }, orderBy: { name: "asc" } })).map(programme));
  }
  async findProgramme(id: string, tenantId: TenantId): Promise<Result<ProgrammeRecord | null, DomainError>> {
    const row = await this.prisma.programme.findFirst({ where: { id, tenantId: tenantId.toString() } });
    return ok(row ? programme(row) : null);
  }
  async createProgramme(record: ProgrammeRecord): Promise<Result<ProgrammeRecord, DomainError>> {
    await this.prisma.programme.create({ data: { id: record.id, tenantId: record.tenantId, name: record.name, code: record.code ?? null, description: record.description ?? null, status: record.status, createdById: record.createdById, createdAt: record.createdAt } });
    return ok(record);
  }
  async updateProgramme(id: string, tenantId: TenantId, c: { name: string; code?: string | undefined; description?: string | undefined; status: FundingStatus }): Promise<Result<void, DomainError>> {
    // null, not undefined: clearing a field must clear it.
    await this.prisma.programme.updateMany({ where: { id, tenantId: tenantId.toString() }, data: { name: c.name, code: c.code ?? null, description: c.description ?? null, status: c.status } });
    return ok(undefined);
  }

  async listGrants(tenantId: TenantId): Promise<Result<GrantRecord[], DomainError>> {
    return ok((await this.prisma.grant.findMany({ where: { tenantId: tenantId.toString() }, orderBy: [{ donorName: "asc" }, { title: "asc" }] })).map(grant));
  }
  async findGrant(id: string, tenantId: TenantId): Promise<Result<GrantRecord | null, DomainError>> {
    const row = await this.prisma.grant.findFirst({ where: { id, tenantId: tenantId.toString() } });
    return ok(row ? grant(row) : null);
  }
  async createGrant(r: GrantRecord): Promise<Result<GrantRecord, DomainError>> {
    await this.prisma.grant.create({
      data: { id: r.id, tenantId: r.tenantId, programmeId: r.programmeId ?? null, title: r.title, donorName: r.donorName, awardNumber: r.awardNumber ?? null, amount: r.amount ?? null, currency: r.currency ?? null, startDate: r.startDate ?? null, endDate: r.endDate ?? null, status: r.status, createdById: r.createdById, createdAt: r.createdAt },
    });
    return ok(r);
  }
  async updateGrant(id: string, tenantId: TenantId, c: CleanGrant): Promise<Result<void, DomainError>> {
    await this.prisma.grant.updateMany({
      where: { id, tenantId: tenantId.toString() },
      data: { title: c.title, donorName: c.donorName, programmeId: c.programmeId ?? null, awardNumber: c.awardNumber ?? null, amount: c.amount ?? null, currency: c.currency ?? null, startDate: c.startDate ?? null, endDate: c.endDate ?? null, status: c.status },
    });
    return ok(undefined);
  }

  async projectPlacements(tenantId: TenantId): Promise<Result<Map<string, { programmeId: string | null; grantId: string | null }>, DomainError>> {
    const rows = await this.prisma.project.findMany({
      where: { tenantId: tenantId.toString(), OR: [{ programmeId: { not: null } }, { grantId: { not: null } }] },
      select: { id: true, programmeId: true, grantId: true },
    });
    return ok(new Map(rows.map((r) => [r.id, { programmeId: r.programmeId, grantId: r.grantId }])));
  }
  async placeProject(projectId: string, tenantId: TenantId, placement: { programmeId: string | null; grantId: string | null }): Promise<Result<void, DomainError>> {
    await this.prisma.project.updateMany({ where: { id: projectId, tenantId: tenantId.toString() }, data: { programmeId: placement.programmeId, grantId: placement.grantId } });
    return ok(undefined);
  }
}
