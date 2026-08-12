import { PrismaClient } from "@prisma/client";
import {
  Project,
  type ProjectProps,
  type ReportingFrequency,
  type Sector,
  DateRange,
  Money,
  TenantId,
  DomainError,
  type Result,
} from "@donordesk/domain";
import type { IProjectRepository } from "@donordesk/application";

function ok<T>(value: T): Result<T, DomainError> {
  return { ok: true, value };
}

function err<T = never>(e: DomainError): Result<T, DomainError> {
  return { ok: false, error: e };
}

export class PrismaProjectRepository implements IProjectRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(p: Project): Promise<Result<Project, DomainError>> {
    try {
      await this.prisma.project.create({
        data: {
          id: p.id,
          tenantId: p.tenantId.toString(),
          title: p.title,
          projectCode: p.projectCode,
          donorName: p.donorName,
          implementingOrganization: p.implementingOrganization,
          partnerOrganization: p.partnerOrganization,
          country: p.country,
          region: p.region,
          district: p.district,
          sector: p.sector,
          startDate: p.duration.start,
          endDate: p.duration.end,
          budgetAmount: p.budget?.amount,
          budgetCurrency: p.budget?.currency,
          reportingFrequency: p.reportingFrequency,
          description: p.description,
          primaryContactName: p.primaryContactName,
          projectManagerId: p.projectManagerId,
          meOfficerId: p.meOfficerId,
          reportingOfficerId: p.reportingOfficerId,
          status: p.status,
        },
      });
      return ok(p);
    } catch (e) {
      return err(new DomainError("CONFLICT", String(e)));
    }
  }

  async update(p: Project): Promise<Result<Project, DomainError>> {
    try {
      await this.prisma.project.update({
        where: { id: p.id },
        data: {
          title: p.title,
          projectCode: p.projectCode,
          donorName: p.donorName,
          implementingOrganization: p.implementingOrganization,
          partnerOrganization: p.partnerOrganization,
          country: p.country,
          region: p.region,
          district: p.district,
          sector: p.sector,
          startDate: p.duration.start,
          endDate: p.duration.end,
          budgetAmount: p.budget?.amount,
          budgetCurrency: p.budget?.currency,
          reportingFrequency: p.reportingFrequency,
          description: p.description,
          primaryContactName: p.primaryContactName,
          projectManagerId: p.projectManagerId,
          meOfficerId: p.meOfficerId,
          reportingOfficerId: p.reportingOfficerId,
          status: p.status,
        },
      });
      return ok(p);
    } catch (e) {
      return err(new DomainError("CONFLICT", String(e)));
    }
  }

  async findById(id: string, tenantId: TenantId): Promise<Result<Project | null, DomainError>> {
    const row = await this.prisma.project.findFirst({ where: { id, tenantId: tenantId.toString() } });
    if (!row) return ok(null);
    return ok(this.toDomain(row));
  }

  async listByTenant(tenantId: TenantId): Promise<Result<Project[], DomainError>> {
    const rows = await this.prisma.project.findMany({ where: { tenantId: tenantId.toString() }, orderBy: { createdAt: "asc" } });
    return ok(rows.map((r) => this.toDomain(r)));
  }

  private toDomain(row: {
    id: string;
    tenantId: string;
    title: string;
    projectCode: string;
    donorName: string;
    implementingOrganization: string;
    partnerOrganization: string | null;
    country: string;
    region: string | null;
    district: string | null;
    sector: string;
    startDate: Date;
    endDate: Date;
    budgetAmount: number | null;
    budgetCurrency: string | null;
    reportingFrequency: string;
    description: string | null;
    primaryContactName: string | null;
    projectManagerId: string | null;
    meOfficerId: string | null;
    reportingOfficerId: string | null;
    status: string;
    createdAt: Date;
  }): Project {
    const props: ProjectProps = {
      title: row.title,
      projectCode: row.projectCode,
      donorName: row.donorName,
      implementingOrganization: row.implementingOrganization,
      partnerOrganization: row.partnerOrganization ?? undefined,
      country: row.country,
      region: row.region ?? undefined,
      district: row.district ?? undefined,
      sector: row.sector as Sector,
      duration: DateRange.create(row.startDate, row.endDate),
      budget:
        row.budgetAmount !== null && row.budgetAmount !== undefined
          ? Money.create(row.budgetAmount, row.budgetCurrency ?? "USD")
          : undefined,
      reportingFrequency: row.reportingFrequency as ReportingFrequency,
      description: row.description ?? undefined,
      primaryContactName: row.primaryContactName ?? undefined,
      projectManagerId: row.projectManagerId ?? undefined,
      meOfficerId: row.meOfficerId ?? undefined,
      reportingOfficerId: row.reportingOfficerId ?? undefined,
      status: row.status as ProjectProps["status"],
    };
    return Project.rehydrate({
      id: row.id,
      tenantId: TenantId.create(row.tenantId),
      createdAt: row.createdAt,
      props,
    });
  }
}
