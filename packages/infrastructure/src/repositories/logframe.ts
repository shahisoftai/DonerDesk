import { PrismaClient } from "@prisma/client";
import {
  LogframeItem,
  Indicator,
  IndicatorUpdate,
  TenantId,
  DomainError,
  type Result,
  type IndicatorType,
  type VerificationStatus,
} from "@donordesk/domain";
import type {
  ILogframeRepository,
  IIndicatorRepository,
  IIndicatorUpdateRepository,
} from "@donordesk/application";

function ok<T>(value: T): Result<T, DomainError> {
  return { ok: true, value };
}

export class PrismaLogframeRepository implements ILogframeRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async create(i: LogframeItem): Promise<Result<LogframeItem, DomainError>> {
    await this.prisma.logframeItem.create({
      data: {
        id: i.id,
        tenantId: i.tenantIdValue,
        projectId: i.projectId,
        parentId: i.parentId,
        level: i.level,
        code: i.code,
        title: i.title,
        description: i.description,
      },
    });
    return ok(i);
  }
  async update(i: LogframeItem): Promise<Result<LogframeItem, DomainError>> {
    await this.prisma.logframeItem.update({
      where: { id: i.id },
      data: {
        parentId: i.parentId,
        level: i.level,
        code: i.code,
        title: i.title,
        description: i.description,
      },
    });
    return ok(i);
  }
  async findById(id: string, tenantId: TenantId): Promise<Result<LogframeItem | null, DomainError>> {
    const row = await this.prisma.logframeItem.findFirst({ where: { id, tenantId: tenantId.toString() } });
    if (!row) return ok(null);
    return ok(
      LogframeItem.rehydrate({
        id: row.id,
        tenantId: row.tenantId,
        projectId: row.projectId,
        createdAt: row.createdAt,
        props: { parentId: row.parentId ?? undefined, level: row.level as never, code: row.code ?? undefined, title: row.title, description: row.description ?? undefined },
      }),
    );
  }
  async findByProject(projectId: string, tenantId: TenantId): Promise<Result<LogframeItem[], DomainError>> {
    const rows = await this.prisma.logframeItem.findMany({ where: { projectId, tenantId: tenantId.toString() }, orderBy: { createdAt: "asc" } });
    return ok(
      rows.map((row) =>
        LogframeItem.rehydrate({
          id: row.id,
          tenantId: row.tenantId,
          projectId: row.projectId,
          createdAt: row.createdAt,
          props: { parentId: row.parentId ?? undefined, level: row.level as never, code: row.code ?? undefined, title: row.title, description: row.description ?? undefined },
        }),
      ),
    );
  }
  async delete(id: string, tenantId: TenantId): Promise<Result<void, DomainError>> {
    await this.prisma.logframeItem.deleteMany({ where: { id, tenantId: tenantId.toString() } });
    return ok(undefined);
  }
}

export class PrismaIndicatorRepository implements IIndicatorRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async create(i: Indicator): Promise<Result<Indicator, DomainError>> {
    await this.prisma.indicator.create({
      data: {
        id: i.id,
        tenantId: i.tenantIdValue,
        projectId: i.projectId,
        logframeItemId: i.logframeItemId,
        code: i.code,
        name: i.name,
        type: i.type,
        baseline: i.baseline,
        target: i.target,
        unit: i.unit,
        meansOfVerification: i.meansOfVerification,
        dataSource: i.dataSource,
        frequency: i.frequency,
        responsibleUserId: i.responsibleUserId,
        disaggregationRequired: i.disaggregationRequired,
      },
    });
    return ok(i);
  }
  async update(i: Indicator): Promise<Result<Indicator, DomainError>> {
    await this.prisma.indicator.update({
      where: { id: i.id },
      data: {
        code: i.code,
        name: i.name,
        type: i.type,
        baseline: i.baseline,
        target: i.target,
        unit: i.unit,
        meansOfVerification: i.meansOfVerification,
        dataSource: i.dataSource,
        frequency: i.frequency,
        responsibleUserId: i.responsibleUserId,
        disaggregationRequired: i.disaggregationRequired,
      },
    });
    return ok(i);
  }
  async findById(id: string, tenantId: TenantId): Promise<Result<Indicator | null, DomainError>> {
    const row = await this.prisma.indicator.findFirst({ where: { id, tenantId: tenantId.toString() } });
    if (!row) return ok(null);
    return ok(this.toDomain(row));
  }
  async findByProject(projectId: string, tenantId: TenantId): Promise<Result<Indicator[], DomainError>> {
    const rows = await this.prisma.indicator.findMany({ where: { projectId, tenantId: tenantId.toString() }, orderBy: { createdAt: "asc" } });
    return ok(rows.map((r) => this.toDomain(r)));
  }
  async findByLogframeItem(logframeItemId: string, tenantId: TenantId): Promise<Result<Indicator[], DomainError>> {
    const rows = await this.prisma.indicator.findMany({ where: { logframeItemId, tenantId: tenantId.toString() }, orderBy: { createdAt: "asc" } });
    return ok(rows.map((r) => this.toDomain(r)));
  }
  async delete(id: string, tenantId: TenantId): Promise<Result<void, DomainError>> {
    await this.prisma.indicator.deleteMany({ where: { id, tenantId: tenantId.toString() } });
    return ok(undefined);
  }
  private toDomain(row: {
    id: string;
    tenantId: string;
    projectId: string;
    logframeItemId: string;
    code: string;
    name: string;
    type: string;
    baseline: string;
    target: string;
    unit: string | null;
    meansOfVerification: string | null;
    dataSource: string | null;
    frequency: string | null;
    responsibleUserId: string | null;
    disaggregationRequired: boolean;
    createdAt: Date;
  }): Indicator {
    return Indicator.rehydrate({
      id: row.id,
      tenantId: row.tenantId,
      projectId: row.projectId,
      createdAt: row.createdAt,
      props: {
        logframeItemId: row.logframeItemId,
        code: row.code,
        name: row.name,
        type: row.type as IndicatorType,
        baseline: row.baseline,
        target: row.target,
        unit: row.unit ?? undefined,
        meansOfVerification: row.meansOfVerification ?? undefined,
        dataSource: row.dataSource ?? undefined,
        frequency: row.frequency ?? undefined,
        responsibleUserId: row.responsibleUserId ?? undefined,
        disaggregationRequired: row.disaggregationRequired,
      },
    });
  }
}

export class PrismaIndicatorUpdateRepository implements IIndicatorUpdateRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async create(u: IndicatorUpdate): Promise<Result<IndicatorUpdate, DomainError>> {
    await this.prisma.indicatorUpdate.create({
      data: {
        id: u.id,
        tenantId: u.tenantIdValue,
        indicatorId: u.indicatorId,
        reportingPeriodId: u.reportingPeriodId,
        periodAchievement: u.periodAchievement,
        cumulativeAchievement: u.cumulativeAchievement,
        comments: u.comments,
        dataSource: u.dataSource,
        attachedEvidenceIds: JSON.stringify(u.attachedEvidenceIds),
        verificationStatus: u.verificationStatus,
        verifiedById: u.verifiedById,
        verifiedAt: u.verifiedAt,
        createdById: u.createdById,
      },
    });
    return ok(u);
  }
  async update(u: IndicatorUpdate): Promise<Result<IndicatorUpdate, DomainError>> {
    await this.prisma.indicatorUpdate.update({
      where: { id: u.id },
      data: {
        periodAchievement: u.periodAchievement,
        cumulativeAchievement: u.cumulativeAchievement,
        comments: u.comments,
        dataSource: u.dataSource,
        attachedEvidenceIds: JSON.stringify(u.attachedEvidenceIds),
        verificationStatus: u.verificationStatus,
        verifiedById: u.verifiedById,
        verifiedAt: u.verifiedAt,
      },
    });
    return ok(u);
  }
  async findById(id: string, tenantId: TenantId): Promise<Result<IndicatorUpdate | null, DomainError>> {
    const row = await this.prisma.indicatorUpdate.findFirst({ where: { id, tenantId: tenantId.toString() } });
    if (!row) return ok(null);
    return ok(this.toDomain(row));
  }
  async findByReportingPeriod(reportingPeriodId: string, tenantId: TenantId): Promise<Result<IndicatorUpdate[], DomainError>> {
    const rows = await this.prisma.indicatorUpdate.findMany({ where: { reportingPeriodId, tenantId: tenantId.toString() }, orderBy: { createdAt: "asc" } });
    return ok(rows.map((r) => this.toDomain(r)));
  }
  async findByIndicator(indicatorId: string, tenantId: TenantId): Promise<Result<IndicatorUpdate[], DomainError>> {
    const rows = await this.prisma.indicatorUpdate.findMany({ where: { indicatorId, tenantId: tenantId.toString() }, orderBy: { createdAt: "asc" } });
    return ok(rows.map((r) => this.toDomain(r)));
  }
  async findByIndicatorAndPeriod(indicatorId: string, reportingPeriodId: string, tenantId: TenantId): Promise<Result<IndicatorUpdate | null, DomainError>> {
    const row = await this.prisma.indicatorUpdate.findFirst({
      where: { indicatorId, reportingPeriodId, tenantId: tenantId.toString() },
      orderBy: { createdAt: "asc" },
    });
    if (!row) return ok(null);
    return ok(this.toDomain(row));
  }
  private toDomain(row: {
    id: string;
    tenantId: string;
    indicatorId: string;
    reportingPeriodId: string;
    periodAchievement: string;
    cumulativeAchievement: string;
    comments: string | null;
    dataSource: string | null;
    attachedEvidenceIds: string;
    verificationStatus: string;
    verifiedById: string | null;
    verifiedAt: Date | null;
    createdById: string;
    createdAt: Date;
  }): IndicatorUpdate {
    return IndicatorUpdate.rehydrate({
      id: row.id,
      tenantId: row.tenantId,
      createdAt: row.createdAt,
      props: {
        indicatorId: row.indicatorId,
        reportingPeriodId: row.reportingPeriodId,
        periodAchievement: row.periodAchievement,
        cumulativeAchievement: row.cumulativeAchievement,
        comments: row.comments ?? undefined,
        dataSource: row.dataSource ?? undefined,
        attachedEvidenceIds: JSON.parse(row.attachedEvidenceIds),
        verificationStatus: row.verificationStatus as VerificationStatus,
        verifiedById: row.verifiedById ?? undefined,
        verifiedAt: row.verifiedAt ?? undefined,
        createdById: row.createdById,
      },
    });
  }
}
