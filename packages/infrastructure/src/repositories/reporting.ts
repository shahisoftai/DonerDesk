import { PrismaClient } from "@prisma/client";
import {
  ReportingPeriod,
  ReportDraft,
  ReportSection,
  TenantId,
  DomainError,
  DateRange,
  ReportStatus,
  parseChartConfig,
  type Result,
  type ReportType,
  type ReportDraftStatus,
  type SectionStatus,
  type SourceReference,
} from "@donordesk/domain";
import type {
  IReportingPeriodRepository,
  IReportDraftRepository,
  IReportSectionRepository,
} from "@donordesk/application";

function ok<T>(value: T): Result<T, DomainError> {
  return { ok: true, value };
}

export class PrismaReportingPeriodRepository implements IReportingPeriodRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async create(p: ReportingPeriod): Promise<Result<ReportingPeriod, DomainError>> {
    await this.prisma.reportingPeriod.create({
      data: {
        id: p.id,
        tenantId: p.tenantIdValue,
        projectId: p.projectId,
        donorTemplateId: p.donorTemplateId,
        donorTemplateVersion: p.donorTemplateVersion,
        donorTemplateMappingId: p.donorTemplateMappingId,
        reportType: p.reportType,
        startDate: p.duration.start,
        endDate: p.duration.end,
        deadline: p.deadline,
        internalReviewDeadline: p.internalReviewDeadline,
        status: p.status.toString(),
        readinessScore: p.readinessScore,
        responsibleOfficerId: p.responsibleOfficerId,
        reportingProfileSnapshotJson: p.reportingProfileSnapshotJson,
        templateSnapshotJson: p.templateSnapshotJson,
      },
    });
    return ok(p);
  }
  async update(p: ReportingPeriod): Promise<Result<ReportingPeriod, DomainError>> {
    await this.prisma.reportingPeriod.update({
      where: { id: p.id },
      data: {
        donorTemplateId: p.donorTemplateId,
        donorTemplateVersion: p.donorTemplateVersion,
        donorTemplateMappingId: p.donorTemplateMappingId,
        status: p.status.toString(),
        readinessScore: p.readinessScore,
        responsibleOfficerId: p.responsibleOfficerId,
      },
    });
    return ok(p);
  }
  async findById(id: string, tenantId: TenantId): Promise<Result<ReportingPeriod | null, DomainError>> {
    const row = await this.prisma.reportingPeriod.findFirst({ where: { id, tenantId: tenantId.toString() } });
    if (!row) return ok(null);
    return ok(this.toDomain(row));
  }
  async findByProject(projectId: string, tenantId: TenantId): Promise<Result<ReportingPeriod[], DomainError>> {
    const rows = await this.prisma.reportingPeriod.findMany({ where: { projectId, tenantId: tenantId.toString() }, orderBy: { startDate: "desc" } });
    return ok(rows.map((r) => this.toDomain(r)));
  }
  async findPreviousPeriods(projectId: string, beforeReportingPeriodId: string, tenantId: TenantId, limit = 4): Promise<Result<ReportingPeriod[], DomainError>> {
    const current = await this.prisma.reportingPeriod.findFirst({
      where: { id: beforeReportingPeriodId, projectId, tenantId: tenantId.toString() },
      select: { startDate: true },
    });
    if (!current) return ok([]);
    const rows = await this.prisma.reportingPeriod.findMany({
      where: { projectId, tenantId: tenantId.toString(), startDate: { lt: current.startDate } },
      orderBy: { startDate: "desc" },
      take: Math.max(1, Math.min(20, limit)),
    });
    return ok(rows.map((r) => this.toDomain(r)));
  }
  private toDomain(row: {
    id: string;
    tenantId: string;
    projectId: string;
    donorTemplateId: string | null;
    donorTemplateVersion: number | null;
    donorTemplateMappingId: string | null;
    reportType: string;
    startDate: Date;
    endDate: Date;
    deadline: Date;
    internalReviewDeadline: Date | null;
    status: string;
    readinessScore: number;
    responsibleOfficerId: string | null;
    reportingProfileSnapshotJson: string;
    templateSnapshotJson: string;
    createdAt: Date;
  }): ReportingPeriod {
    return ReportingPeriod.rehydrate({
      id: row.id,
      tenantId: row.tenantId,
      projectId: row.projectId,
      createdAt: row.createdAt,
      props: {
        donorTemplateId: row.donorTemplateId ?? undefined,
        donorTemplateVersion: row.donorTemplateVersion ?? undefined,
        donorTemplateMappingId: row.donorTemplateMappingId ?? undefined,
        reportType: row.reportType as ReportType,
        duration: DateRange.create(row.startDate, row.endDate),
        deadline: row.deadline,
        internalReviewDeadline: row.internalReviewDeadline ?? undefined,
        status: ReportStatus.create(row.status as Parameters<typeof ReportStatus.create>[0]),
        readinessScore: row.readinessScore,
        responsibleOfficerId: row.responsibleOfficerId ?? undefined,
        reportingProfileSnapshotJson: row.reportingProfileSnapshotJson,
        templateSnapshotJson: row.templateSnapshotJson,
      },
    });
  }
}

export class PrismaReportDraftRepository implements IReportDraftRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async create(d: ReportDraft): Promise<Result<ReportDraft, DomainError>> {
    await this.prisma.reportDraft.create({
      data: {
        id: d.id,
        tenantId: d.tenantIdValue,
        projectId: d.projectId,
        reportingPeriodId: d.reportingPeriodId,
        title: d.title,
        status: d.status,
        version: d.version,
        generatedByAi: d.generatedByAi,
        createdById: d.createdById,
        approvedById: d.approvedById,
        approvedAt: d.approvedAt,
      },
    });
    return ok(d);
  }
  async update(d: ReportDraft): Promise<Result<ReportDraft, DomainError>> {
    await this.prisma.reportDraft.update({
      where: { id: d.id },
      data: {
        title: d.title,
        status: d.status,
        version: d.version,
        approvedById: d.approvedById,
        approvedAt: d.approvedAt,
      },
    });
    return ok(d);
  }
  async findById(id: string, tenantId: TenantId): Promise<Result<ReportDraft | null, DomainError>> {
    const row = await this.prisma.reportDraft.findFirst({ where: { id, tenantId: tenantId.toString() } });
    if (!row) return ok(null);
    return ok(this.toDomain(row));
  }
  async findByReportingPeriod(reportingPeriodId: string, tenantId: TenantId): Promise<Result<ReportDraft[], DomainError>> {
    const rows = await this.prisma.reportDraft.findMany({ where: { reportingPeriodId, tenantId: tenantId.toString() }, orderBy: { createdAt: "desc" } });
    return ok(rows.map((r) => this.toDomain(r)));
  }
  private toDomain(row: {
    id: string;
    tenantId: string;
    projectId: string;
    reportingPeriodId: string;
    title: string;
    status: string;
    version: number;
    generatedByAi: boolean;
    createdById: string;
    approvedById: string | null;
    approvedAt: Date | null;
    createdAt: Date;
  }): ReportDraft {
    return ReportDraft.rehydrate({
      id: row.id,
      tenantId: row.tenantId,
      projectId: row.projectId,
      createdAt: row.createdAt,
      props: {
        reportingPeriodId: row.reportingPeriodId,
        title: row.title,
        status: row.status as ReportDraftStatus,
        version: row.version,
        generatedByAi: row.generatedByAi,
        createdById: row.createdById,
        approvedById: row.approvedById ?? undefined,
        approvedAt: row.approvedAt ?? undefined,
      },
    });
  }
}

export class PrismaReportSectionRepository implements IReportSectionRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async create(s: ReportSection): Promise<Result<ReportSection, DomainError>> {
    await this.prisma.reportSection.create({
      data: {
        id: s.id,
        tenantId: s.tenantIdValue,
        reportDraftId: s.reportDraftId,
        sectionTitle: s.sectionTitle,
        sectionOrder: s.sectionOrder,
        content: s.content,
        sourceReferencesJson: JSON.stringify(s.sourceReferences),
        unsupportedClaims: JSON.stringify(s.unsupportedClaims),
        status: s.status,
        chartConfigJson: s.chartConfig ? JSON.stringify(s.chartConfig) : null,
        currentRevisionId: s.currentRevisionId,
      },
    });
    return ok(s);
  }
  async update(s: ReportSection): Promise<Result<ReportSection, DomainError>> {
    await this.prisma.reportSection.update({
      where: { id: s.id },
      data: {
        sectionTitle: s.sectionTitle,
        sectionOrder: s.sectionOrder,
        content: s.content,
        sourceReferencesJson: JSON.stringify(s.sourceReferences),
        unsupportedClaims: JSON.stringify(s.unsupportedClaims),
        status: s.status,
        chartConfigJson: s.chartConfig ? JSON.stringify(s.chartConfig) : null,
        currentRevisionId: s.currentRevisionId,
      },
    });
    return ok(s);
  }
  async findById(id: string, tenantId: TenantId): Promise<Result<ReportSection | null, DomainError>> {
    const row = await this.prisma.reportSection.findFirst({ where: { id, tenantId: tenantId.toString() } });
    if (!row) return ok(null);
    return ok(this.toDomain(row));
  }
  async findByReportDraft(reportDraftId: string, tenantId: TenantId): Promise<Result<ReportSection[], DomainError>> {
    const rows = await this.prisma.reportSection.findMany({ where: { reportDraftId, tenantId: tenantId.toString() }, orderBy: { sectionOrder: "asc" } });
    return ok(rows.map((r) => this.toDomain(r)));
  }
  async delete(id: string, tenantId: TenantId): Promise<Result<void, DomainError>> {
    await this.prisma.reportSection.deleteMany({ where: { id, tenantId: tenantId.toString() } });
    return ok(undefined);
  }
  private toDomain(row: {
    id: string;
    tenantId: string;
    reportDraftId: string;
    sectionTitle: string;
    sectionOrder: number;
    content: string;
    sourceReferencesJson: string;
    unsupportedClaims: string;
    status: string;
    chartConfigJson: string | null;
    currentRevisionId: string | null;
    createdAt: Date;
  }): ReportSection {
    return ReportSection.rehydrate({
      id: row.id,
      tenantId: row.tenantId,
      reportDraftId: row.reportDraftId,
      createdAt: row.createdAt,
      props: {
        sectionTitle: row.sectionTitle,
        sectionOrder: row.sectionOrder,
        content: row.content,
        sourceReferences: JSON.parse(row.sourceReferencesJson) as SourceReference[],
        unsupportedClaims: JSON.parse(row.unsupportedClaims),
        status: row.status as SectionStatus,
        chartConfig: parseChartConfig(row.chartConfigJson),
        currentRevisionId: row.currentRevisionId ?? undefined,
      },
    });
  }
}
