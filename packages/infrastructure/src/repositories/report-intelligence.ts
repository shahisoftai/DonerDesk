import { PrismaClient } from "@prisma/client";
import {
  ReportClaim,
  ReportGenerationRun,
  DonorTemplateMapping,
  DomainError,
  type Result,
  type ReportPlan,
  type GenerationRunSnapshot,
  type ClaimSource,
  type ClaimType,
  type TemplateRegionMapping,
  type VerificationResult,
} from "@donordesk/domain";
import type {
  IReportPlanRepository,
  IReportClaimRepository,
  IGenerationRunRepository,
  IDonorTemplateMappingRepository,
} from "@donordesk/application";

function ok<T>(value: T): Result<T, DomainError> {
  return { ok: true, value };
}

export class PrismaReportPlanRepository implements IReportPlanRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(p: ReportPlan): Promise<Result<ReportPlan, DomainError>> {
    await this.prisma.reportPlan.create({
      data: {
        id: p.id,
        tenantId: p.tenantId,
        projectId: p.projectId,
        reportingPeriodId: p.reportingPeriodId,
        version: p.version,
        sectionsJson: JSON.stringify(p.sections),
        styleJson: JSON.stringify(p.style),
        generatedBy: p.generatedBy,
      },
    });
    return ok(p);
  }

  /**
   * Atomically allocates the next plan version and creates the plan. Handles
   * concurrent regenerations: when another request wins the version slot
   * (P2002 on the (tenantId, reportingPeriodId, version) unique key), the
   * version is re-read and the insert retried. Up to 10 attempts.
   */
  async createNextVersion(p: ReportPlan): Promise<Result<ReportPlan, DomainError>> {
    let plan = p;
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        const max = await this.prisma.reportPlan.aggregate({
          where: { tenantId: plan.tenantId, reportingPeriodId: plan.reportingPeriodId },
          _max: { version: true },
        });
        const nextVersion = (max._max.version ?? 0) + 1;
        await this.prisma.reportPlan.create({
          data: {
            id: plan.id,
            tenantId: plan.tenantId,
            projectId: plan.projectId,
            reportingPeriodId: plan.reportingPeriodId,
            version: nextVersion,
            sectionsJson: JSON.stringify(plan.sections),
            styleJson: JSON.stringify(plan.style),
            generatedBy: plan.generatedBy,
          },
        });
        return ok({ ...plan, version: nextVersion });
      } catch (error) {
        const e = error as { code?: string };
        if (e?.code === "P2002") continue;
        return { ok: false, error: new DomainError("CONFLICT", String(error)) };
      }
    }
    return { ok: false, error: new DomainError("CONFLICT", "Could not allocate a unique report plan version") };
  }

  async update(p: ReportPlan): Promise<Result<ReportPlan, DomainError>> {
    await this.prisma.reportPlan.update({
      where: { id: p.id },
      data: {
        version: p.version,
        sectionsJson: JSON.stringify(p.sections),
        styleJson: JSON.stringify(p.style),
        generatedBy: p.generatedBy,
      },
    });
    return ok(p);
  }

  async findById(id: string, tenantId: { toString(): string }): Promise<Result<ReportPlan | null, DomainError>> {
    const row = await this.prisma.reportPlan.findFirst({ where: { id, tenantId: tenantId.toString() } });
    if (!row) return ok(null);
    return ok(this.toDomain(row));
  }

  async findByReportingPeriod(reportingPeriodId: string, tenantId: { toString(): string }): Promise<Result<ReportPlan[], DomainError>> {
    const rows = await this.prisma.reportPlan.findMany({
      where: { reportingPeriodId, tenantId: tenantId.toString() },
      orderBy: { version: "desc" },
    });
    return ok(rows.map((r) => this.toDomain(r)));
  }

  private toDomain(row: {
    id: string;
    tenantId: string;
    projectId: string;
    reportingPeriodId: string;
    version: number;
    sectionsJson: string;
    styleJson: string;
    generatedBy: string;
  }): ReportPlan {
    return {
      id: row.id,
      tenantId: row.tenantId,
      projectId: row.projectId,
      reportingPeriodId: row.reportingPeriodId,
      version: row.version,
      sections: JSON.parse(row.sectionsJson) as ReportPlan["sections"],
      style: JSON.parse(row.styleJson) as ReportPlan["style"],
      generatedBy: row.generatedBy as ReportPlan["generatedBy"],
    };
  }
}

export class PrismaReportClaimRepository implements IReportClaimRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(c: ReportClaim): Promise<Result<ReportClaim, DomainError>> {
    await this.prisma.reportClaim.create({
      data: {
        id: c.id,
        tenantId: c.tenantIdValue,
        projectId: c.projectId,
        reportDraftId: c.reportDraftId,
        sectionId: c.sectionId,
        text: c.text,
        type: c.type,
        sourcesJson: JSON.stringify(c.sources),
        verificationResult: c.verificationResult,
        verificationDetail: c.verificationDetail,
        resolutionNotes: c.resolutionNotes,
        resolvedById: c.resolvedById,
        resolvedAt: c.resolvedAt,
      },
    });
    return ok(c);
  }

  async update(c: ReportClaim): Promise<Result<ReportClaim, DomainError>> {
    await this.prisma.reportClaim.update({
      where: { id: c.id },
      data: {
        sourcesJson: JSON.stringify(c.sources),
        verificationResult: c.verificationResult,
        verificationDetail: c.verificationDetail,
        resolutionNotes: c.resolutionNotes,
        resolvedById: c.resolvedById,
        resolvedAt: c.resolvedAt,
      },
    });
    return ok(c);
  }

  async findById(id: string, tenantId: { toString(): string }): Promise<Result<ReportClaim | null, DomainError>> {
    const row = await this.prisma.reportClaim.findFirst({ where: { id, tenantId: tenantId.toString() } });
    if (!row) return ok(null);
    return ok(this.toDomain(row));
  }

  async findByDraft(draftId: string, tenantId: { toString(): string }): Promise<Result<ReportClaim[], DomainError>> {
    const rows = await this.prisma.reportClaim.findMany({
      where: { reportDraftId: draftId, tenantId: tenantId.toString() },
      orderBy: { createdAt: "asc" },
    });
    return ok(rows.map((r) => this.toDomain(r)));
  }

  async findBySection(sectionId: string, tenantId: { toString(): string }): Promise<Result<ReportClaim[], DomainError>> {
    const rows = await this.prisma.reportClaim.findMany({
      where: { sectionId, tenantId: tenantId.toString() },
      orderBy: { createdAt: "asc" },
    });
    return ok(rows.map((r) => this.toDomain(r)));
  }

  private toDomain(row: {
    id: string;
    tenantId: string;
    projectId: string;
    reportDraftId: string;
    sectionId: string;
    text: string;
    type: string;
    sourcesJson: string;
    verificationResult: string;
    verificationDetail: string;
    resolutionNotes: string | null;
    resolvedById: string | null;
    resolvedAt: Date | null;
    createdAt: Date;
  }): ReportClaim {
    return ReportClaim.rehydrate({
      id: row.id,
      tenantId: row.tenantId,
      projectId: row.projectId,
      reportDraftId: row.reportDraftId,
      createdAt: row.createdAt,
      props: {
        sectionId: row.sectionId,
        text: row.text,
        type: row.type as ClaimType,
        sources: JSON.parse(row.sourcesJson) as ClaimSource[],
        verificationResult: row.verificationResult as VerificationResult,
        verificationDetail: row.verificationDetail,
        resolutionNotes: row.resolutionNotes ?? undefined,
        resolvedById: row.resolvedById ?? undefined,
        resolvedAt: row.resolvedAt ?? undefined,
      },
    });
  }
}

export class PrismaReportGenerationRunRepository implements IGenerationRunRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(run: ReportGenerationRun): Promise<Result<ReportGenerationRun, DomainError>> {
    await this.prisma.reportGenerationRun.create({
      data: {
        id: run.id,
        tenantId: run.snapshot.tenantId,
        projectId: run.snapshot.projectId,
        reportingPeriodId: run.snapshot.reportingPeriodId,
        draftId: run.snapshot.draftId,
        snapshotJson: JSON.stringify(run.snapshot),
      },
    });
    return ok(run);
  }

  async findById(id: string, tenantId: { toString(): string }): Promise<Result<ReportGenerationRun | null, DomainError>> {
    const row = await this.prisma.reportGenerationRun.findFirst({ where: { id, tenantId: tenantId.toString() } });
    if (!row) return ok(null);
    return ok(this.toDomain(row));
  }

  async findByDraft(draftId: string, tenantId: { toString(): string }): Promise<Result<ReportGenerationRun[], DomainError>> {
    const rows = await this.prisma.reportGenerationRun.findMany({
      where: { draftId, tenantId: tenantId.toString() },
      orderBy: { createdAt: "asc" },
    });
    return ok(rows.map((r) => this.toDomain(r)));
  }

  private toDomain(row: { id: string; tenantId: string; snapshotJson: string; createdAt: Date }): ReportGenerationRun {
    const snapshot = JSON.parse(row.snapshotJson) as GenerationRunSnapshot;
    return ReportGenerationRun.rehydrate(snapshot);
  }
}

export class PrismaDonorTemplateMappingRepository implements IDonorTemplateMappingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(m: DonorTemplateMapping): Promise<Result<DonorTemplateMapping, DomainError>> {
    await this.prisma.donorTemplateMapping.create({
      data: {
        id: m.id,
        tenantId: m.tenantIdValue,
        templateId: m.templateId,
        version: m.version,
        regionsJson: JSON.stringify(m.regionsList),
        approvedById: m.approvedById,
        approvedAt: m.approvedAt,
      },
    });
    return ok(m);
  }

  async findById(id: string, tenantId: { toString(): string }): Promise<Result<DonorTemplateMapping | null, DomainError>> {
    const row = await this.prisma.donorTemplateMapping.findFirst({ where: { id, tenantId: tenantId.toString() } });
    if (!row) return ok(null);
    return ok(this.toDomain(row));
  }

  async findByTemplate(templateId: string, tenantId: { toString(): string }): Promise<Result<DonorTemplateMapping[], DomainError>> {
    const rows = await this.prisma.donorTemplateMapping.findMany({
      where: { templateId, tenantId: tenantId.toString() },
      orderBy: { version: "desc" },
    });
    return ok(rows.map((r) => this.toDomain(r)));
  }

  async findByTemplateAndVersion(templateId: string, version: number, tenantId: { toString(): string }): Promise<Result<DonorTemplateMapping | null, DomainError>> {
    const row = await this.prisma.donorTemplateMapping.findFirst({
      where: { templateId, version, tenantId: tenantId.toString() },
    });
    if (!row) return ok(null);
    return ok(this.toDomain(row));
  }

  private toDomain(row: {
    id: string;
    tenantId: string;
    templateId: string;
    version: number;
    regionsJson: string;
    approvedById: string | null;
    approvedAt: Date | null;
    createdAt: Date;
  }): DonorTemplateMapping {
    return DonorTemplateMapping.rehydrate({
      id: row.id,
      tenantId: row.tenantId,
      templateId: row.templateId,
      version: row.version,
      regions: JSON.parse(row.regionsJson) as TemplateRegionMapping[],
      approvedById: row.approvedById ?? undefined,
      approvedAt: row.approvedAt ?? undefined,
      createdAt: row.createdAt,
    });
  }
}
