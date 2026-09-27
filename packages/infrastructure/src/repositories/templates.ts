import { PrismaClient, type DonorTemplate as DonorTemplateRow } from "@prisma/client";
import {
  DonorTemplate,
  TenantId,
  DomainError,
  parsePersistedRequirements,
  parsePersistedSections,
  type ExtractionMeta,
  type Result,
  type TemplateStatus,
  type TemplateVersionSnapshot,
} from "@donordesk/domain";
import type { IDonorTemplateRepository, IDonorTemplateVersionReader, ILogger, TemplateVersionSummary } from "@donordesk/application";

function ok<T>(value: T): Result<T, DomainError> {
  return { ok: true, value };
}

const TEMPLATE_STATUSES: readonly TemplateStatus[] = ["EXTRACTING", "NEEDS_REVIEW", "REVIEWED", "EXTRACTION_FAILED"];

function parseJson(raw: string | null | undefined): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/**
 * Donor templates plus their immutable per-version snapshots. Every write that
 * lands on a version not yet snapshotted appends a `DonorTemplateVersion` row
 * in the same transaction, so a pinned version can always be resolved.
 */
export class PrismaDonorTemplateRepository implements IDonorTemplateRepository, IDonorTemplateVersionReader {
  constructor(private readonly prisma: PrismaClient, private readonly logger?: ILogger) {}

  async create(t: DonorTemplate): Promise<Result<DonorTemplate, DomainError>> {
    await this.prisma.$transaction(async (tx) => {
      await tx.donorTemplate.create({
        data: { id: t.id, tenantId: t.tenantId.toString(), projectId: t.projectId, uploadedById: t.uploadedById, ...this.toRow(t) },
      });
      await tx.donorTemplateVersion.create({ data: this.versionRow(t, t.uploadedById, "Created") });
    });
    return ok(t);
  }

  async update(t: DonorTemplate, meta?: { actorId?: string; changeNote?: string }): Promise<Result<DonorTemplate, DomainError>> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.donorTemplate.updateMany({ where: { id: t.id, tenantId: t.tenantId.toString() }, data: this.toRow(t) });
      if (res.count === 0) return false;
      const existing = await tx.donorTemplateVersion.findUnique({ where: { templateId_version: { templateId: t.id, version: t.version } } });
      if (existing) {
        await tx.donorTemplateVersion.update({
          where: { id: existing.id },
          data: { sectionsJson: JSON.stringify(t.sections), requirementsJson: JSON.stringify(t.requirements) },
        });
      } else {
        await tx.donorTemplateVersion.create({ data: this.versionRow(t, meta?.actorId ?? t.uploadedById, meta?.changeNote) });
      }
      return true;
    });
    if (!updated) return { ok: false, error: DomainError.notFound("DonorTemplate", t.id) };
    return ok(t);
  }

  async findById(id: string, tenantId: TenantId): Promise<Result<DonorTemplate | null, DomainError>> {
    const row = await this.prisma.donorTemplate.findFirst({ where: { id, tenantId: tenantId.toString() } });
    if (!row) return ok(null);
    return ok(this.toDomain(row));
  }

  async findByProject(projectId: string, tenantId: TenantId): Promise<Result<DonorTemplate[], DomainError>> {
    const rows = await this.prisma.donorTemplate.findMany({
      where: { projectId, tenantId: tenantId.toString() },
      orderBy: { createdAt: "desc" },
    });
    return ok(rows.map((r) => this.toDomain(r)));
  }

  async findLibrary(tenantId: TenantId): Promise<Result<DonorTemplate[], DomainError>> {
    const rows = await this.prisma.donorTemplate.findMany({
      where: { tenantId: tenantId.toString(), isLibrary: true },
      orderBy: [{ donorName: "asc" }, { templateName: "asc" }],
    });
    return ok(rows.map((r) => this.toDomain(r)));
  }

  async delete(id: string, tenantId: TenantId): Promise<Result<void, DomainError>> {
    const deleted = await this.prisma.donorTemplate.deleteMany({
      where: { id, tenantId: tenantId.toString() },
    });
    if (deleted.count === 0) {
      return { ok: false, error: DomainError.notFound("DonorTemplate", id) };
    }
    return ok(undefined);
  }

  async findVersion(templateId: string, version: number, tenantId: TenantId): Promise<Result<TemplateVersionSnapshot | null, DomainError>> {
    const row = await this.prisma.donorTemplateVersion.findFirst({ where: { templateId, version, tenantId: tenantId.toString() } });
    if (!row) return ok(null);
    return ok({
      version: row.version,
      sections: this.parseSections(parseJson(row.sectionsJson), templateId),
      requirements: parsePersistedRequirements(parseJson(row.requirementsJson)),
    });
  }

  async listVersions(templateId: string, tenantId: TenantId): Promise<Result<TemplateVersionSummary[], DomainError>> {
    const rows = await this.prisma.donorTemplateVersion.findMany({
      where: { templateId, tenantId: tenantId.toString() },
      orderBy: { version: "desc" },
      select: { version: true, createdAt: true, createdById: true, changeNote: true },
    });
    return ok(rows.map((r) => ({ version: r.version, createdAt: r.createdAt, createdById: r.createdById, changeNote: r.changeNote ?? undefined })));
  }

  private toRow(t: DonorTemplate) {
    const file = t.originalFile;
    return {
      templateName: t.templateName,
      donorName: t.donorName,
      reportType: t.reportType,
      language: t.language,
      requiredAnnexes: JSON.stringify(t.requiredAnnexes),
      requirementsJson: JSON.stringify(t.requirements),
      notes: t.notes ?? null,
      originalFileUrl: file?.url ?? null,
      originalFileName: file?.name ?? null,
      originalFileMime: file?.mimeType ?? null,
      originalFileHash: file?.sha256 ?? null,
      extractedRawText: t.extractedRawText ?? null,
      sectionsJson: JSON.stringify(t.sections),
      status: t.status,
      extractionMetaJson: t.extractionMeta ? JSON.stringify(t.extractionMeta) : null,
      isLibrary: t.isLibrary,
      sourceTemplateId: t.sourceTemplateId ?? null,
      version: t.version,
    };
  }

  private versionRow(t: DonorTemplate, actorId: string, changeNote?: string) {
    return {
      id: crypto.randomUUID(),
      tenantId: t.tenantId.toString(),
      templateId: t.id,
      version: t.version,
      sectionsJson: JSON.stringify(t.sections),
      requirementsJson: JSON.stringify(t.requirements),
      createdById: actorId,
      changeNote: changeNote ?? null,
    };
  }

  private parseSections(raw: unknown, templateId: string) {
    const { sections, dropped } = parsePersistedSections(raw);
    if (dropped.length > 0) {
      this.logger?.warn("Dropped invalid donor template sections on read", { templateId, dropped });
    }
    return sections;
  }

  private toDomain(row: DonorTemplateRow): DonorTemplate {
    const legacyAnnexes = parseJson(row.requiredAnnexes);
    const status = TEMPLATE_STATUSES.includes(row.status as TemplateStatus) ? (row.status as TemplateStatus) : "REVIEWED";
    const meta = parseJson(row.extractionMetaJson) as ExtractionMeta | undefined;
    return DonorTemplate.rehydrate({
      id: row.id,
      tenantId: TenantId.create(row.tenantId),
      projectId: row.projectId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      props: {
        templateName: row.templateName,
        donorName: row.donorName,
        reportType: row.reportType as DonorTemplate["reportType"],
        language: row.language,
        notes: row.notes ?? undefined,
        originalFile: row.originalFileUrl
          ? {
              url: row.originalFileUrl,
              name: row.originalFileName ?? undefined,
              mimeType: row.originalFileMime ?? undefined,
              sha256: row.originalFileHash ?? undefined,
            }
          : undefined,
        extractedRawText: row.extractedRawText ?? undefined,
        sections: this.parseSections(parseJson(row.sectionsJson), row.id),
        requirements: parsePersistedRequirements(parseJson(row.requirementsJson), Array.isArray(legacyAnnexes) ? (legacyAnnexes as string[]) : []),
        status,
        extractionMeta: meta && typeof meta === "object" ? { ...meta, warnings: Array.isArray(meta.warnings) ? meta.warnings : [] } : undefined,
        version: row.version,
        uploadedById: row.uploadedById,
        isLibrary: row.isLibrary,
        sourceTemplateId: row.sourceTemplateId ?? undefined,
      },
    });
  }
}
