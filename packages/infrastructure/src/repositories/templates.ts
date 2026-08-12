import { PrismaClient } from "@prisma/client";
import {
  DonorTemplate,
  TenantId,
  DomainError,
  type Result,
  createSection,
  type TemplateSection,
} from "@donordesk/domain";
import type { IDonorTemplateRepository } from "@donordesk/application";

function ok<T>(value: T): Result<T, DomainError> {
  return { ok: true, value };
}

export class PrismaDonorTemplateRepository implements IDonorTemplateRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(t: DonorTemplate): Promise<Result<DonorTemplate, DomainError>> {
    await this.prisma.donorTemplate.create({
      data: {
        id: t.id,
        tenantId: t.tenantId.toString(),
        projectId: t.projectId,
        templateName: t.templateName,
        donorName: t.donorName,
        reportType: t.reportType,
        language: t.language,
        requiredAnnexes: JSON.stringify(t.requiredAnnexes),
        notes: t.notes,
        originalFileUrl: t.originalFileUrl,
        extractedRawText: t.extractedRawText,
        sectionsJson: JSON.stringify(t.sections),
        version: t.version,
        uploadedById: t.uploadedById,
      },
    });
    return ok(t);
  }

  async update(t: DonorTemplate): Promise<Result<DonorTemplate, DomainError>> {
    await this.prisma.donorTemplate.update({
      where: { id: t.id },
      data: {
        templateName: t.templateName,
        donorName: t.donorName,
        reportType: t.reportType,
        language: t.language,
        requiredAnnexes: JSON.stringify(t.requiredAnnexes),
        notes: t.notes,
        originalFileUrl: t.originalFileUrl,
        extractedRawText: t.extractedRawText,
        sectionsJson: JSON.stringify(t.sections),
        version: t.version,
      },
    });
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

  private toDomain(row: {
    id: string;
    tenantId: string;
    projectId: string;
    templateName: string;
    donorName: string;
    reportType: string;
    language: string;
    requiredAnnexes: string;
    notes: string | null;
    originalFileUrl: string | null;
    extractedRawText: string | null;
    sectionsJson: string;
    version: number;
    uploadedById: string;
    createdAt: Date;
  }): DonorTemplate {
    const sectionInputs = JSON.parse(row.sectionsJson) as Array<Omit<TemplateSection, "order">>;
    const sections = sectionInputs.map((s) => createSection(s));
    return DonorTemplate.rehydrate({
      id: row.id,
      tenantId: TenantId.create(row.tenantId),
      projectId: row.projectId,
      createdAt: row.createdAt,
      props: {
        templateName: row.templateName,
        donorName: row.donorName,
        reportType: row.reportType as DonorTemplate["reportType"],
        language: row.language,
        requiredAnnexes: JSON.parse(row.requiredAnnexes),
        notes: row.notes ?? undefined,
        originalFileUrl: row.originalFileUrl ?? undefined,
        extractedRawText: row.extractedRawText ?? undefined,
        sections,
        version: row.version,
        uploadedById: row.uploadedById,
      },
    });
  }
}
