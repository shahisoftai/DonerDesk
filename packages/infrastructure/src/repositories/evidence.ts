import { PrismaClient, Prisma } from "@prisma/client";
import {
  EvidenceFile,
  TenantId,
  DomainError,
  type Result,
  type EvidenceType,
  type ConfidentialityLevel,
  type EvidenceVerificationStatus,
  type SuggestedTag,
  type StorageProvider,
} from "@donordesk/domain";
import type { IEvidenceRepository, EvidenceFilter, EvidenceListResult } from "@donordesk/application";

function ok<T>(value: T): Result<T, DomainError> {
  return { ok: true, value };
}

export class PrismaEvidenceRepository implements IEvidenceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(e: EvidenceFile): Promise<Result<EvidenceFile, DomainError>> {
    await this.prisma.evidenceFile.create({
      data: {
        id: e.id,
        tenantId: e.tenantIdValue,
        projectId: e.projectId,
        reportingPeriodId: e.reportingPeriodId,
        fileName: e.fileName,
        title: e.title,
        fileUrl: e.fileUrl,
        fileType: e.fileType,
        fileSize: e.fileSize,
        storageProvider: e.storageProvider,
        driveFileId: e.driveFileId,
        driveWebLink: e.driveWebLink,
        storageKey: e.storageKey,
        evidenceType: e.evidenceType,
        activityId: e.activityId,
        indicatorId: e.indicatorId,
        location: e.location,
        activityDate: e.activityDate,
        uploadedById: e.uploadedById,
        verificationStatus: e.verificationStatus,
        confidentialityLevel: e.confidentialityLevel,
        notes: e.notes,
        aiSummary: e.aiSummary,
        extractedText: e.extractedText,
        aiSuggestedTagsJson: JSON.stringify(e.aiSuggestedTags),
        sensitivityWarning: e.sensitivityWarning,
      },
    });
    return ok(e);
  }

  async update(e: EvidenceFile): Promise<Result<EvidenceFile, DomainError>> {
    await this.prisma.evidenceFile.update({
      where: { id: e.id },
      data: {
        title: e.title,
        evidenceType: e.evidenceType,
        reportingPeriodId: e.reportingPeriodId,
        activityId: e.activityId,
        indicatorId: e.indicatorId,
        location: e.location,
        activityDate: e.activityDate,
        verificationStatus: e.verificationStatus,
        confidentialityLevel: e.confidentialityLevel,
        notes: e.notes,
        aiSummary: e.aiSummary,
        aiSuggestedTagsJson: JSON.stringify(e.aiSuggestedTags),
        sensitivityWarning: e.sensitivityWarning,
      },
    });
    return ok(e);
  }

  async findById(id: string, tenantId: TenantId): Promise<Result<EvidenceFile | null, DomainError>> {
    const row = await this.prisma.evidenceFile.findFirst({ where: { id, tenantId: tenantId.toString() } });
    if (!row) return ok(null);
    return ok(this.toDomain(row));
  }

  async search(filter: EvidenceFilter, tenantId: TenantId): Promise<Result<EvidenceListResult, DomainError>> {
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 20;
    const where: Prisma.EvidenceFileWhereInput = { tenantId: tenantId.toString() };
    if (filter.projectId) where.projectId = filter.projectId;
    if (filter.reportingPeriodId) where.reportingPeriodId = filter.reportingPeriodId;
    if (filter.activityId) where.activityId = filter.activityId;
    if (filter.indicatorId) where.indicatorId = filter.indicatorId;
    if (filter.evidenceType) where.evidenceType = filter.evidenceType;
    if (filter.location) where.location = { contains: filter.location };
    if (filter.uploadedById) where.uploadedById = filter.uploadedById;
    if (filter.verificationStatus) where.verificationStatus = filter.verificationStatus;
    if (filter.confidentialityLevel) where.confidentialityLevel = filter.confidentialityLevel;
    if (filter.dateFrom || filter.dateTo) {
      where.activityDate = {};
      if (filter.dateFrom) (where.activityDate as { gte?: Date }).gte = filter.dateFrom;
      if (filter.dateTo) (where.activityDate as { lte?: Date }).lte = filter.dateTo;
    }
    if (filter.query) {
      where.OR = [
        { fileName: { contains: filter.query } },
        { title: { contains: filter.query } },
        { notes: { contains: filter.query } },
      ];
    }
    const [rows, total] = await Promise.all([
      this.prisma.evidenceFile.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.evidenceFile.count({ where }),
    ]);
    return ok({ items: rows.map((r) => this.toDomain(r)), total, page, pageSize });
  }

  async countByPeriod(reportingPeriodId: string, tenantId: TenantId): Promise<Result<number, DomainError>> {
    const n = await this.prisma.evidenceFile.count({ where: { reportingPeriodId, tenantId: tenantId.toString() } });
    return ok(n);
  }

  async countVerifiedByPeriod(reportingPeriodId: string, tenantId: TenantId): Promise<Result<number, DomainError>> {
    const n = await this.prisma.evidenceFile.count({ where: { reportingPeriodId, tenantId: tenantId.toString(), verificationStatus: "VERIFIED" } });
    return ok(n);
  }

  async delete(id: string, tenantId: TenantId): Promise<Result<void, DomainError>> {
    await this.prisma.evidenceFile.deleteMany({ where: { id, tenantId: tenantId.toString() } });
    return ok(undefined);
  }

  async sumManagedStorageBytes(tenantId: TenantId): Promise<Result<bigint, DomainError>> {
    const rows = await this.prisma.evidenceFile.findMany({
      where: {
        tenantId: tenantId.toString(),
        storageProvider: { not: "GOOGLE_DRIVE" },
      },
      select: { fileSize: true },
    });
    const total = rows.reduce((sum, r) => sum + BigInt(r.fileSize), 0n);
    return ok(total);
  }

  private toDomain(row: {
    id: string;
    tenantId: string;
    projectId: string;
    reportingPeriodId: string | null;
    fileName: string;
    title: string;
    fileUrl: string;
    fileType: string;
    fileSize: number;
    storageProvider: string;
    driveFileId: string | null;
    driveWebLink: string | null;
    storageKey: string | null;
    evidenceType: string;
    activityId: string | null;
    indicatorId: string | null;
    location: string | null;
    activityDate: Date | null;
    uploadedById: string;
    verificationStatus: string;
    confidentialityLevel: string;
    notes: string | null;
    aiSummary: string | null;
    extractedText: string | null;
    aiSuggestedTagsJson: string;
    sensitivityWarning: string | null;
    createdAt: Date;
  }): EvidenceFile {
    return EvidenceFile.rehydrate({
      id: row.id,
      tenantId: row.tenantId,
      projectId: row.projectId,
      createdAt: row.createdAt,
      props: {
        fileName: row.fileName,
        title: row.title,
        fileUrl: row.fileUrl,
        fileType: row.fileType,
        fileSize: row.fileSize,
        storageProvider: (row.storageProvider as StorageProvider) ?? "LOCAL",
        driveFileId: row.driveFileId ?? undefined,
        driveWebLink: row.driveWebLink ?? undefined,
        storageKey: row.storageKey ?? undefined,
        evidenceType: row.evidenceType as EvidenceType,
        reportingPeriodId: row.reportingPeriodId ?? undefined,
        activityId: row.activityId ?? undefined,
        indicatorId: row.indicatorId ?? undefined,
        location: row.location ?? undefined,
        activityDate: row.activityDate ?? undefined,
        uploadedById: row.uploadedById,
        verificationStatus: row.verificationStatus as EvidenceVerificationStatus,
        confidentialityLevel: row.confidentialityLevel as ConfidentialityLevel,
        notes: row.notes ?? undefined,
        aiSummary: row.aiSummary ?? undefined,
        extractedText: row.extractedText ?? undefined,
        aiSuggestedTags: JSON.parse(row.aiSuggestedTagsJson) as SuggestedTag[],
        sensitivityWarning: row.sensitivityWarning ?? undefined,
      },
    });
  }
}
