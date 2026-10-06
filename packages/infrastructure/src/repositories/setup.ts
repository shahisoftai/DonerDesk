import { PrismaClient } from "@prisma/client";
import {
  ProjectSetup,
  ReportingProfile,
  normalizeFinanceDataMode,
  type ProjectSetupProps,
  type ReportingProfileProps,
  type WorkspaceProvisionStatus,
  TenantId,
  DomainError,
  type Result,
} from "@donordesk/domain";
import type {
  IProjectSetupRepository,
  IReportingProfileRepository,
  UpsertReportingProfileResult,
} from "@donordesk/application";

function ok<T>(value: T): Result<T, DomainError> {
  return { ok: true, value };
}

function err<T = never>(e: unknown): Result<T, DomainError> {
  return { ok: false, error: new DomainError("CONFLICT", e instanceof Error ? e.message : String(e)) };
}

export class PrismaProjectSetupRepository implements IProjectSetupRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(p: ProjectSetup): Promise<Result<ProjectSetup, DomainError>> {
    try {
      await this.prisma.projectSetup.create({
        data: {
          id: p.id,
          tenantId: p.tenantIdValue,
          projectId: p.projectId,
          workspaceProvisionStatus: p.workspaceProvisionStatus,
          workspaceProvisionError: p.workspaceProvisionError,
          provisionAttemptCount: p.provisionAttemptCount,
          lastProvisionAttemptAt: p.lastProvisionAttemptAt,
          acknowledgedAt: p.acknowledgedAt,
          acknowledgedById: p.acknowledgedById,
        },
      });
      return ok(p);
    } catch (e) {
      return err(e);
    }
  }

  async update(p: ProjectSetup): Promise<Result<ProjectSetup, DomainError>> {
    try {
      await this.prisma.projectSetup.update({
        where: { id: p.id },
        data: {
          workspaceProvisionStatus: p.workspaceProvisionStatus,
          workspaceProvisionError: p.workspaceProvisionError,
          provisionAttemptCount: p.provisionAttemptCount,
          lastProvisionAttemptAt: p.lastProvisionAttemptAt,
          acknowledgedAt: p.acknowledgedAt,
          acknowledgedById: p.acknowledgedById,
        },
      });
      return ok(p);
    } catch (e) {
      return err(e);
    }
  }

  async findByProject(projectId: string, tenantId: TenantId): Promise<Result<ProjectSetup | null, DomainError>> {
    const row = await this.prisma.projectSetup.findFirst({
      where: { projectId, tenantId: tenantId.toString() },
    });
    if (!row) return ok(null);
    return ok(this.toDomain(row));
  }

  async ensureForProject(projectId: string, tenantId: TenantId): Promise<Result<ProjectSetup, DomainError>> {
    const existing = await this.findByProject(projectId, tenantId);
    if (!existing.ok) return existing;
    if (existing.value) return { ok: true, value: existing.value };
    // Create a default PENDING setup row (drive tenants only; LOCAL projects are
    // marked NOT_REQUIRED by the create handler, but legacy projects may lack one).
    const setup = ProjectSetup.create({
      id: crypto.randomUUID(),
      tenantId: tenantId.toString(),
      projectId,
    });
    return this.create(setup);
  }

  private toDomain(row: {
    id: string;
    tenantId: string;
    projectId: string;
    workspaceProvisionStatus: string;
    workspaceProvisionError: string | null;
    provisionAttemptCount: number;
    lastProvisionAttemptAt: Date | null;
    acknowledgedAt: Date | null;
    acknowledgedById: string | null;
    createdAt: Date;
  }): ProjectSetup {
    const props: ProjectSetupProps = {
      workspaceProvisionStatus: row.workspaceProvisionStatus as WorkspaceProvisionStatus,
      workspaceProvisionError: row.workspaceProvisionError ?? undefined,
      provisionAttemptCount: row.provisionAttemptCount,
      lastProvisionAttemptAt: row.lastProvisionAttemptAt ?? undefined,
      acknowledgedAt: row.acknowledgedAt ?? undefined,
      acknowledgedById: row.acknowledgedById ?? undefined,
    };
    return ProjectSetup.rehydrate({
      id: row.id,
      tenantId: row.tenantId,
      projectId: row.projectId,
      createdAt: row.createdAt,
      props,
    });
  }
}

export class PrismaReportingProfileRepository implements IReportingProfileRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(p: ReportingProfile): Promise<Result<ReportingProfile, DomainError>> {
    try {
      await this.prisma.reportingProfile.create({
        data: {
          id: p.id,
          tenantId: p.tenantIdValue,
          projectId: p.projectId,
          defaultTemplateId: p.defaultTemplateId,
          language: p.language,
          tone: p.tone,
          writingStyle: p.writingStyle,
          audienceNotes: p.audienceNotes,
          formattingRulesJson: JSON.stringify(p.formattingRules),
          specialRequirementsJson: JSON.stringify(p.specialRequirements),
          sectionOverridesJson: JSON.stringify(p.sectionOverrides),
          deadlineOffsetDays: p.deadlineOffsetDays,
          autoPeriodCreation: p.autoPeriodCreation,
          financeDataMode: p.financeDataMode,
          defaultTemplateByTypeJson: JSON.stringify(p.defaultTemplateByType),
          requireSecondApprover: p.requireSecondApprover,
          standingStatementsJson: JSON.stringify(p.standingStatements),
          version: p.version,
          createdById: p.createdById,
          updatedById: p.updatedById,
        },
      });
      return ok(p);
    } catch (e) {
      return err(e);
    }
  }

  async update(p: ReportingProfile): Promise<Result<ReportingProfile, DomainError>> {
    try {
      await this.prisma.reportingProfile.update({
        where: { id: p.id },
        data: {
          defaultTemplateId: p.defaultTemplateId,
          language: p.language,
          tone: p.tone,
          writingStyle: p.writingStyle,
          audienceNotes: p.audienceNotes,
          formattingRulesJson: JSON.stringify(p.formattingRules),
          specialRequirementsJson: JSON.stringify(p.specialRequirements),
          sectionOverridesJson: JSON.stringify(p.sectionOverrides),
          deadlineOffsetDays: p.deadlineOffsetDays,
          autoPeriodCreation: p.autoPeriodCreation,
          financeDataMode: p.financeDataMode,
          defaultTemplateByTypeJson: JSON.stringify(p.defaultTemplateByType),
          requireSecondApprover: p.requireSecondApprover,
          standingStatementsJson: JSON.stringify(p.standingStatements),
          version: p.version,
          updatedById: p.updatedById,
        },
      });
      return ok(p);
    } catch (e) {
      return err(e);
    }
  }

  async findByProject(projectId: string, tenantId: TenantId): Promise<Result<ReportingProfile | null, DomainError>> {
    const row = await this.prisma.reportingProfile.findFirst({
      where: { projectId, tenantId: tenantId.toString() },
    });
    if (!row) return ok(null);
    return ok(this.toDomain(row));
  }

  private toDomain(row: {
    id: string;
    tenantId: string;
    projectId: string;
    defaultTemplateId: string | null;
    language: string;
    tone: string;
    writingStyle: string | null;
    audienceNotes: string | null;
    formattingRulesJson: string;
    specialRequirementsJson: string;
    sectionOverridesJson: string;
    deadlineOffsetDays: number | null;
    autoPeriodCreation: boolean;
    financeDataMode: string;
    defaultTemplateByTypeJson?: string | null;
    requireSecondApprover?: boolean | null;
    standingStatementsJson?: string | null;
    version: number;
    createdById: string;
    updatedById: string;
    createdAt: Date;
  }): ReportingProfile {
    const props: ReportingProfileProps = {
      defaultTemplateId: row.defaultTemplateId ?? undefined,
      language: row.language,
      tone: row.tone as ReportingProfileProps["tone"],
      writingStyle: row.writingStyle ?? undefined,
      audienceNotes: row.audienceNotes ?? undefined,
      formattingRules: JSON.parse(row.formattingRulesJson) as string[],
      specialRequirements: JSON.parse(row.specialRequirementsJson) as string[],
      sectionOverrides: JSON.parse(row.sectionOverridesJson) as Record<string, { min?: number; max?: number }>,
      deadlineOffsetDays: row.deadlineOffsetDays ?? undefined,
      autoPeriodCreation: row.autoPeriodCreation,
      financeDataMode: normalizeFinanceDataMode(row.financeDataMode),
      defaultTemplateByType: parseStringMap(row.defaultTemplateByTypeJson),
      requireSecondApprover: row.requireSecondApprover ?? false,
      standingStatements: parseStringMap(row.standingStatementsJson),
      version: row.version,
      createdById: row.createdById,
      updatedById: row.updatedById,
    };
    return ReportingProfile.rehydrate({
      id: row.id,
      tenantId: row.tenantId,
      projectId: row.projectId,
      createdAt: row.createdAt,
      props,
    });
  }
}

// Kept for interface parity (the application only uses create/update/find).
export type { UpsertReportingProfileResult };

/** A stored JSON object of strings; anything else reads as empty. */
function parseStringMap(json: string | null | undefined): Record<string, string> {
  if (!json) return {};
  try {
    const parsed: unknown = JSON.parse(json);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === "string"));
  } catch {
    return {};
  }
}
