import type { BeneficiaryRecord, IBeneficiaryLinkRepository, IBeneficiaryRepository } from "@donordesk/application";
import { DomainError, ok } from "@donordesk/domain";
import type { Result, TenantId } from "@donordesk/domain";
import type { PrismaClient } from "@prisma/client";

/** Beneficiary records by case code (phase 28.1-G). A repeated case code in a project is refused by the handler and the unique key. */
export class PrismaBeneficiaryRepository implements IBeneficiaryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async add(b: BeneficiaryRecord): Promise<Result<void, DomainError>> {
    try {
      await this.prisma.beneficiary.create({
        data: { id: b.id, tenantId: b.tenantId, projectId: b.projectId, caseCode: b.caseCode, sex: b.sex, ageGroup: b.ageGroup, location: b.location, enrolledOn: new Date(`${b.enrolledOn}T00:00:00.000Z`), consentRecordedById: b.consentRecordedById, createdById: b.createdById, createdAt: b.createdAt },
      });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") return { ok: false, error: DomainError.conflict("This case code is already used in this project", { field: "caseCode" }) };
      throw e;
    }
    return ok(undefined);
  }

  async addMany(list: BeneficiaryRecord[]): Promise<Result<void, DomainError>> {
    try {
      await this.prisma.beneficiary.createMany({
        data: list.map((b) => ({ id: b.id, tenantId: b.tenantId, projectId: b.projectId, caseCode: b.caseCode, sex: b.sex, ageGroup: b.ageGroup, location: b.location, enrolledOn: new Date(`${b.enrolledOn}T00:00:00.000Z`), consentRecordedById: b.consentRecordedById, createdById: b.createdById, createdAt: b.createdAt })),
      });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") return { ok: false, error: DomainError.conflict("A case code in this file is already used in this project") };
      throw e;
    }
    return ok(undefined);
  }

  async findByProject(projectId: string, tenantId: TenantId): Promise<Result<BeneficiaryRecord[], DomainError>> {
    const rows = await this.prisma.beneficiary.findMany({ where: { tenantId: tenantId.toString(), projectId }, orderBy: { caseCode: "asc" } });
    return ok(rows.map((r) => ({
      id: r.id, tenantId: r.tenantId, projectId: r.projectId, caseCode: r.caseCode, sex: r.sex, ageGroup: r.ageGroup, location: r.location,
      enrolledOn: r.enrolledOn.toISOString().slice(0, 10), consentRecordedById: r.consentRecordedById, createdById: r.createdById, createdAt: r.createdAt,
    })));
  }

  async findById(id: string, tenantId: TenantId): Promise<Result<BeneficiaryRecord | null, DomainError>> {
    const r = await this.prisma.beneficiary.findFirst({ where: { id, tenantId: tenantId.toString() } });
    if (!r) return ok(null);
    return ok({
      id: r.id, tenantId: r.tenantId, projectId: r.projectId, caseCode: r.caseCode, sex: r.sex, ageGroup: r.ageGroup, location: r.location,
      enrolledOn: r.enrolledOn.toISOString().slice(0, 10), consentRecordedById: r.consentRecordedById, createdById: r.createdById, createdAt: r.createdAt,
    });
  }

  async update(id: string, tenantId: TenantId, f: { caseCode: string; sex: string; ageGroup: string; location: string; enrolledOn: string }): Promise<Result<void, DomainError>> {
    try {
      const res = await this.prisma.beneficiary.updateMany({
        where: { id, tenantId: tenantId.toString() },
        data: { caseCode: f.caseCode, sex: f.sex, ageGroup: f.ageGroup, location: f.location, enrolledOn: new Date(`${f.enrolledOn}T00:00:00.000Z`) },
      });
      if (res.count === 0) return { ok: false, error: DomainError.notFound("Person", id) };
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") return { ok: false, error: DomainError.conflict("This case code is already used in this project", { field: "caseCode" }) };
      throw e;
    }
    return ok(undefined);
  }

  async remove(id: string, tenantId: TenantId): Promise<Result<void, DomainError>> {
    const t = tenantId.toString();
    await this.prisma.$transaction([
      this.prisma.beneficiaryActivityLink.deleteMany({ where: { tenantId: t, beneficiaryId: id } }),
      this.prisma.beneficiary.deleteMany({ where: { id, tenantId: t } }),
    ]);
    return ok(undefined);
  }
}

/** The people (by case code) an activity reached. Adding a person already linked is skipped, so a person counts once. */
export class PrismaBeneficiaryLinkRepository implements IBeneficiaryLinkRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findBeneficiaryIds(plannedActivityId: string, tenantId: TenantId): Promise<Result<string[], DomainError>> {
    const rows = await this.prisma.beneficiaryActivityLink.findMany({ where: { tenantId: tenantId.toString(), plannedActivityId }, select: { beneficiaryId: true } });
    return ok(rows.map((r) => r.beneficiaryId));
  }

  async add(input: { tenantId: string; projectId: string; plannedActivityId: string; beneficiaryIds: string[]; userId: string; now: Date }): Promise<Result<number, DomainError>> {
    const res = await this.prisma.beneficiaryActivityLink.createMany({
      data: input.beneficiaryIds.map((beneficiaryId) => ({ id: `${input.plannedActivityId}:${beneficiaryId}`, tenantId: input.tenantId, projectId: input.projectId, plannedActivityId: input.plannedActivityId, beneficiaryId, createdById: input.userId, createdAt: input.now })),
      skipDuplicates: true,
    });
    return ok(res.count);
  }

  async remove(plannedActivityId: string, beneficiaryIds: string[], tenantId: TenantId): Promise<Result<number, DomainError>> {
    const res = await this.prisma.beneficiaryActivityLink.deleteMany({ where: { tenantId: tenantId.toString(), plannedActivityId, beneficiaryId: { in: beneficiaryIds } } });
    return ok(res.count);
  }
}
