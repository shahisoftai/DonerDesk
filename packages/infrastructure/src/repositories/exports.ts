import { PrismaClient } from "@prisma/client";
import {
  ExportPackage,
  TenantId,
  DomainError,
  type Result,
  type ExportType,
} from "@donordesk/domain";
import type { IExportRepository } from "@donordesk/application";

function ok<T>(value: T): Result<T, DomainError> {
  return { ok: true, value };
}

export class PrismaExportRepository implements IExportRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async create(e: ExportPackage): Promise<Result<ExportPackage, DomainError>> {
    await this.prisma.exportPackage.create({
      data: {
        id: e.id,
        tenantId: e.tenantIdValue,
        projectId: e.projectId,
        reportingPeriodId: e.reportingPeriodId,
        exportType: e.exportType,
        fileUrl: e.fileUrl,
        version: e.version,
        exportedById: e.exportedById,
        includedFiles: JSON.stringify(e.includedFiles),
      },
    });
    return ok(e);
  }
  async findById(id: string, tenantId: TenantId): Promise<Result<ExportPackage | null, DomainError>> {
    const row = await this.prisma.exportPackage.findFirst({ where: { id, tenantId: tenantId.toString() } });
    if (!row) return ok(null);
    return ok(this.toDomain(row));
  }
  async findByProject(projectId: string, tenantId: TenantId): Promise<Result<ExportPackage[], DomainError>> {
    const rows = await this.prisma.exportPackage.findMany({ where: { projectId, tenantId: tenantId.toString() }, orderBy: { createdAt: "desc" } });
    return ok(rows.map((r) => this.toDomain(r)));
  }
  private toDomain(row: {
    id: string;
    tenantId: string;
    projectId: string;
    reportingPeriodId: string;
    exportType: string;
    fileUrl: string;
    version: number;
    exportedById: string;
    includedFiles: string;
    createdAt: Date;
  }): ExportPackage {
    return ExportPackage.rehydrate({
      id: row.id,
      tenantId: row.tenantId,
      projectId: row.projectId,
      createdAt: row.createdAt,
      props: {
        reportingPeriodId: row.reportingPeriodId,
        exportType: row.exportType as ExportType,
        fileUrl: row.fileUrl,
        version: row.version,
        exportedById: row.exportedById,
        includedFiles: JSON.parse(row.includedFiles),
      },
    });
  }
}
