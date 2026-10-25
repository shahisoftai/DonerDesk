import type { IInfographicRepository, InfographicExportRecord, InfographicRecord } from "@donordesk/application";
import { DomainError, ok } from "@donordesk/domain";
import type { Result, TenantId } from "@donordesk/domain";
import type { PrismaClient } from "@prisma/client";

type InfographicRow = Awaited<ReturnType<PrismaClient["projectInfographic"]["findFirst"]>>;
type InfographicExportRow = Awaited<ReturnType<PrismaClient["infographicExport"]["findFirst"]>>;

const recordFrom = (row: NonNullable<InfographicRow>): InfographicRecord => ({
  id: row.id,
  tenantId: row.tenantId,
  projectId: row.projectId,
  title: row.title,
  templateId: row.templateId,
  templateVersion: row.templateVersion,
  configJson: row.configJson,
  createdById: row.createdById,
  updatedById: row.updatedById,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const exportRecordFrom = (row: NonNullable<InfographicExportRow>): InfographicExportRecord => ({
  id: row.id,
  tenantId: row.tenantId,
  infographicId: row.infographicId,
  projectId: row.projectId,
  format: row.format as InfographicExportRecord["format"],
  storageKey: row.storageKey,
  sizeBytes: row.sizeBytes,
  snapshotJson: row.snapshotJson,
  provenanceJson: row.provenanceJson,
  generatedById: row.generatedById,
  createdAt: row.createdAt,
});

/** Saved infographic compositions and their published exports (Phase 31). One repository, one aggregate family. */
export class PrismaInfographicRepository implements IInfographicRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(record: InfographicRecord): Promise<Result<InfographicRecord, DomainError>> {
    const row = await this.prisma.projectInfographic.create({
      data: {
        id: record.id,
        tenantId: record.tenantId,
        projectId: record.projectId,
        title: record.title,
        templateId: record.templateId,
        templateVersion: record.templateVersion,
        configJson: record.configJson,
        createdById: record.createdById,
        updatedById: record.updatedById,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
    });
    return ok(recordFrom(row));
  }

  async update(record: InfographicRecord): Promise<Result<InfographicRecord, DomainError>> {
    try {
      const row = await this.prisma.projectInfographic.update({
        where: { id: record.id },
        data: {
          title: record.title,
          templateId: record.templateId,
          templateVersion: record.templateVersion,
          configJson: record.configJson,
          updatedById: record.updatedById,
          updatedAt: record.updatedAt,
        },
      });
      return ok(recordFrom(row));
    } catch (e) {
      if ((e as { code?: string }).code === "P2025") return { ok: false, error: DomainError.notFound("Infographic", record.id) };
      throw e;
    }
  }

  async findById(id: string, tenantId: TenantId): Promise<Result<InfographicRecord | null, DomainError>> {
    const row = await this.prisma.projectInfographic.findFirst({ where: { id, tenantId: tenantId.toString() } });
    return ok(row ? recordFrom(row) : null);
  }

  async findByProject(projectId: string, tenantId: TenantId): Promise<Result<InfographicRecord[], DomainError>> {
    const rows = await this.prisma.projectInfographic.findMany({
      where: { projectId, tenantId: tenantId.toString() },
      orderBy: { updatedAt: "desc" },
    });
    return ok(rows.map(recordFrom));
  }

  async remove(id: string, tenantId: TenantId): Promise<Result<void, DomainError>> {
    await this.prisma.projectInfographic.deleteMany({ where: { id, tenantId: tenantId.toString() } });
    return ok(undefined);
  }

  async addExport(record: InfographicExportRecord): Promise<Result<InfographicExportRecord, DomainError>> {
    const row = await this.prisma.infographicExport.create({
      data: {
        id: record.id,
        tenantId: record.tenantId,
        infographicId: record.infographicId,
        projectId: record.projectId,
        format: record.format,
        storageKey: record.storageKey,
        sizeBytes: record.sizeBytes,
        snapshotJson: record.snapshotJson,
        provenanceJson: record.provenanceJson,
        generatedById: record.generatedById,
        createdAt: record.createdAt,
      },
    });
    return ok(exportRecordFrom(row));
  }

  async findExportById(id: string, tenantId: TenantId): Promise<Result<InfographicExportRecord | null, DomainError>> {
    const row = await this.prisma.infographicExport.findFirst({ where: { id, tenantId: tenantId.toString() } });
    return ok(row ? exportRecordFrom(row) : null);
  }

  async findExportsByInfographic(infographicId: string, tenantId: TenantId): Promise<Result<InfographicExportRecord[], DomainError>> {
    const rows = await this.prisma.infographicExport.findMany({
      where: { infographicId, tenantId: tenantId.toString() },
      orderBy: { createdAt: "desc" },
    });
    return ok(rows.map(exportRecordFrom));
  }
}
