import type {
  IBrandKitRepository,
  IInfographicAssetRepository,
  IInfographicRepository,
  IInfographicShareRepository,
  IInfographicUserTemplateRepository,
  InfographicAssetRecord,
  InfographicExportRecord,
  InfographicRecord,
  InfographicShareLinkRecord,
  InfographicUserTemplateRecord,
} from "@donordesk/application";
import { DomainError, ok } from "@donordesk/domain";
import type { DesignStatus, OrganizationBrandKit, Result, TenantId } from "@donordesk/domain";
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
  status: (row.status as DesignStatus) ?? "DRAFT",
  selfApproved: row.selfApproved,
  ...(row.reviewRequestedById ? { reviewRequestedById: row.reviewRequestedById } : {}),
  ...(row.reviewRequestedAt ? { reviewRequestedAt: row.reviewRequestedAt } : {}),
  ...(row.approvedById ? { approvedById: row.approvedById } : {}),
  ...(row.approvedAt ? { approvedAt: row.approvedAt } : {}),
  ...(row.parentId ? { parentId: row.parentId } : {}),
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
  pageCount: row.pageCount,
  approved: row.approved,
  ...(row.waivedJson ? { waivedJson: row.waivedJson } : {}),
  ...(row.altText ? { altText: row.altText } : {}),
});

/** Saved infographic compositions and their published exports (Phases 31-32). One repository, one aggregate family. */
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
        status: record.status,
        selfApproved: record.selfApproved,
        parentId: record.parentId ?? null,
      },
    });
    return ok(recordFrom(row));
  }

  async update(record: InfographicRecord): Promise<Result<InfographicRecord, DomainError>> {
    try {
      // Prisma ignores `undefined` on update, so every clearable field is written as `?? null`.
      const row = await this.prisma.projectInfographic.update({
        where: { id: record.id },
        data: {
          title: record.title,
          templateId: record.templateId,
          templateVersion: record.templateVersion,
          configJson: record.configJson,
          updatedById: record.updatedById,
          updatedAt: record.updatedAt,
          status: record.status,
          selfApproved: record.selfApproved,
          reviewRequestedById: record.reviewRequestedById ?? null,
          reviewRequestedAt: record.reviewRequestedAt ?? null,
          approvedById: record.approvedById ?? null,
          approvedAt: record.approvedAt ?? null,
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
    const rows = await this.prisma.projectInfographic.findMany({ where: { projectId, tenantId: tenantId.toString() }, orderBy: { updatedAt: "desc" } });
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
        pageCount: record.pageCount,
        approved: record.approved,
        waivedJson: record.waivedJson ?? null,
        altText: record.altText ?? null,
      },
    });
    return ok(exportRecordFrom(row));
  }

  async findExportById(id: string, tenantId: TenantId): Promise<Result<InfographicExportRecord | null, DomainError>> {
    const row = await this.prisma.infographicExport.findFirst({ where: { id, tenantId: tenantId.toString() } });
    return ok(row ? exportRecordFrom(row) : null);
  }

  async findExportsByInfographic(infographicId: string, tenantId: TenantId): Promise<Result<InfographicExportRecord[], DomainError>> {
    const rows = await this.prisma.infographicExport.findMany({ where: { infographicId, tenantId: tenantId.toString() }, orderBy: { createdAt: "desc" } });
    return ok(rows.map(exportRecordFrom));
  }

  async findExportsByProject(projectId: string, tenantId: TenantId): Promise<Result<InfographicExportRecord[], DomainError>> {
    const rows = await this.prisma.infographicExport.findMany({ where: { projectId, tenantId: tenantId.toString() }, orderBy: { createdAt: "desc" }, take: 200 });
    return ok(rows.map(exportRecordFrom));
  }
}

type AssetRow = NonNullable<Awaited<ReturnType<PrismaClient["infographicAsset"]["findFirst"]>>>;
const assetFrom = (row: AssetRow): InfographicAssetRecord => ({
  id: row.id,
  tenantId: row.tenantId,
  kind: row.kind as InfographicAssetRecord["kind"],
  name: row.name,
  contentType: row.contentType,
  storageKey: row.storageKey,
  width: row.width,
  height: row.height,
  sizeBytes: row.sizeBytes,
  ...(row.credit ? { credit: row.credit } : {}),
  createdById: row.createdById,
  createdAt: row.createdAt,
  ...(row.archivedAt ? { archivedAt: row.archivedAt } : {}),
});

export class PrismaInfographicAssetRepository implements IInfographicAssetRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(record: InfographicAssetRecord): Promise<Result<InfographicAssetRecord, DomainError>> {
    const row = await this.prisma.infographicAsset.create({
      data: { id: record.id, tenantId: record.tenantId, kind: record.kind, name: record.name, contentType: record.contentType, storageKey: record.storageKey, width: record.width, height: record.height, sizeBytes: record.sizeBytes, credit: record.credit ?? null, createdById: record.createdById, createdAt: record.createdAt },
    });
    return ok(assetFrom(row));
  }

  async findById(id: string, tenantId: TenantId): Promise<Result<InfographicAssetRecord | null, DomainError>> {
    const row = await this.prisma.infographicAsset.findFirst({ where: { id, tenantId: tenantId.toString() } });
    return ok(row ? assetFrom(row) : null);
  }

  async findByIds(ids: readonly string[], tenantId: TenantId): Promise<Result<InfographicAssetRecord[], DomainError>> {
    if (ids.length === 0) return ok([]);
    const rows = await this.prisma.infographicAsset.findMany({ where: { id: { in: [...ids] }, tenantId: tenantId.toString() } });
    return ok(rows.map(assetFrom));
  }

  async list(tenantId: TenantId): Promise<Result<InfographicAssetRecord[], DomainError>> {
    const rows = await this.prisma.infographicAsset.findMany({ where: { tenantId: tenantId.toString() }, orderBy: { createdAt: "desc" }, take: 500 });
    return ok(rows.map(assetFrom));
  }

  async archive(id: string, tenantId: TenantId, at: Date): Promise<Result<void, DomainError>> {
    await this.prisma.infographicAsset.updateMany({ where: { id, tenantId: tenantId.toString() }, data: { archivedAt: at } });
    return ok(undefined);
  }
}

export class PrismaBrandKitRepository implements IBrandKitRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async get(tenantId: TenantId): Promise<Result<OrganizationBrandKit | null, DomainError>> {
    const row = await this.prisma.infographicBrandKit.findFirst({ where: { tenantId: tenantId.toString() } });
    if (!row) return ok(null);
    try {
      return ok(JSON.parse(row.brandJson) as OrganizationBrandKit);
    } catch {
      return ok(null);
    }
  }

  async save(tenantId: TenantId, kit: OrganizationBrandKit, userId: string, id: string): Promise<Result<void, DomainError>> {
    await this.prisma.infographicBrandKit.upsert({
      where: { tenantId: tenantId.toString() },
      create: { id, tenantId: tenantId.toString(), brandJson: JSON.stringify(kit), updatedById: userId },
      update: { brandJson: JSON.stringify(kit), updatedById: userId },
    });
    return ok(undefined);
  }
}

type TemplateRow = NonNullable<Awaited<ReturnType<PrismaClient["infographicUserTemplate"]["findFirst"]>>>;
const templateFrom = (row: TemplateRow): InfographicUserTemplateRecord => ({
  id: row.id,
  tenantId: row.tenantId,
  name: row.name,
  ...(row.description ? { description: row.description } : {}),
  baseTemplateId: row.baseTemplateId,
  configJson: row.configJson,
  createdById: row.createdById,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export class PrismaInfographicUserTemplateRepository implements IInfographicUserTemplateRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(record: InfographicUserTemplateRecord): Promise<Result<InfographicUserTemplateRecord, DomainError>> {
    const row = await this.prisma.infographicUserTemplate.create({
      data: { id: record.id, tenantId: record.tenantId, name: record.name, description: record.description ?? null, baseTemplateId: record.baseTemplateId, configJson: record.configJson, createdById: record.createdById, createdAt: record.createdAt, updatedAt: record.updatedAt },
    });
    return ok(templateFrom(row));
  }

  async findById(id: string, tenantId: TenantId): Promise<Result<InfographicUserTemplateRecord | null, DomainError>> {
    const row = await this.prisma.infographicUserTemplate.findFirst({ where: { id, tenantId: tenantId.toString() } });
    return ok(row ? templateFrom(row) : null);
  }

  async list(tenantId: TenantId): Promise<Result<InfographicUserTemplateRecord[], DomainError>> {
    const rows = await this.prisma.infographicUserTemplate.findMany({ where: { tenantId: tenantId.toString() }, orderBy: { createdAt: "desc" }, take: 200 });
    return ok(rows.map(templateFrom));
  }

  async remove(id: string, tenantId: TenantId): Promise<Result<void, DomainError>> {
    await this.prisma.infographicUserTemplate.deleteMany({ where: { id, tenantId: tenantId.toString() } });
    return ok(undefined);
  }
}

type ShareRow = NonNullable<Awaited<ReturnType<PrismaClient["infographicShareLink"]["findFirst"]>>>;
const shareFrom = (row: ShareRow): InfographicShareLinkRecord => ({
  id: row.id,
  tenantId: row.tenantId,
  infographicId: row.infographicId,
  exportId: row.exportId,
  tokenHash: row.tokenHash,
  expiresAt: row.expiresAt,
  ...(row.revokedAt ? { revokedAt: row.revokedAt } : {}),
  viewCount: row.viewCount,
  createdById: row.createdById,
  createdAt: row.createdAt,
});

export class PrismaInfographicShareRepository implements IInfographicShareRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(record: InfographicShareLinkRecord): Promise<Result<InfographicShareLinkRecord, DomainError>> {
    const row = await this.prisma.infographicShareLink.create({
      data: { id: record.id, tenantId: record.tenantId, infographicId: record.infographicId, exportId: record.exportId, tokenHash: record.tokenHash, expiresAt: record.expiresAt, createdById: record.createdById, createdAt: record.createdAt },
    });
    return ok(shareFrom(row));
  }

  async listByInfographic(infographicId: string, tenantId: TenantId): Promise<Result<InfographicShareLinkRecord[], DomainError>> {
    const rows = await this.prisma.infographicShareLink.findMany({ where: { infographicId, tenantId: tenantId.toString() }, orderBy: { createdAt: "desc" }, take: 100 });
    return ok(rows.map(shareFrom));
  }

  async revoke(id: string, tenantId: TenantId, at: Date): Promise<Result<void, DomainError>> {
    await this.prisma.infographicShareLink.updateMany({ where: { id, tenantId: tenantId.toString() }, data: { revokedAt: at } });
    return ok(undefined);
  }

  /** By token hash, across organizations: the visitor has no session. Run on the admin connection. */
  async findByTokenHash(tokenHash: string): Promise<Result<InfographicShareLinkRecord | null, DomainError>> {
    const row = await this.prisma.infographicShareLink.findFirst({ where: { tokenHash } });
    return ok(row ? shareFrom(row) : null);
  }

  async recordView(id: string): Promise<Result<void, DomainError>> {
    await this.prisma.infographicShareLink.updateMany({ where: { id }, data: { viewCount: { increment: 1 } } });
    return ok(undefined);
  }
}
