import { PrismaClient } from "@prisma/client";
import {
  ChecklistItem,
  TenantId,
  DomainError,
  type Result,
  type ChecklistItemType,
  type Severity,
  type ChecklistStatus,
} from "@donordesk/domain";
import type { IChecklistRepository } from "@donordesk/application";

function ok<T>(value: T): Result<T, DomainError> {
  return { ok: true, value };
}

export class PrismaChecklistRepository implements IChecklistRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(c: ChecklistItem): Promise<Result<ChecklistItem, DomainError>> {
    await this.prisma.checklistItem.create({
      data: {
        id: c.id,
        tenantId: c.tenantIdValue,
        projectId: c.projectId,
        reportingPeriodId: c.reportingPeriodId,
        type: c.type,
        title: c.title,
        description: c.description,
        severity: c.severity,
        relatedEntityType: c.relatedEntityType,
        relatedEntityId: c.relatedEntityId,
        assignedToId: c.assignedToId,
        dueDate: c.dueDate,
        status: c.status,
        resolutionNotes: c.resolutionNotes,
      },
    });
    return ok(c);
  }

  async update(c: ChecklistItem): Promise<Result<ChecklistItem, DomainError>> {
    await this.prisma.checklistItem.update({
      where: { id: c.id },
      data: {
        type: c.type,
        title: c.title,
        description: c.description,
        severity: c.severity,
        relatedEntityType: c.relatedEntityType,
        relatedEntityId: c.relatedEntityId,
        assignedToId: c.assignedToId,
        dueDate: c.dueDate,
        status: c.status,
        resolutionNotes: c.resolutionNotes,
      },
    });
    return ok(c);
  }

  async findById(id: string, tenantId: TenantId): Promise<Result<ChecklistItem | null, DomainError>> {
    const row = await this.prisma.checklistItem.findFirst({ where: { id, tenantId: tenantId.toString() } });
    if (!row) return ok(null);
    return ok(this.toDomain(row));
  }

  async findByReportingPeriod(reportingPeriodId: string, tenantId: TenantId): Promise<Result<ChecklistItem[], DomainError>> {
    const rows = await this.prisma.checklistItem.findMany({ where: { reportingPeriodId, tenantId: tenantId.toString() }, orderBy: [{ severity: "asc" }, { createdAt: "asc" }] });
    return ok(rows.map((r) => this.toDomain(r)));
  }

  async findByProject(projectId: string, tenantId: TenantId): Promise<Result<ChecklistItem[], DomainError>> {
    const rows = await this.prisma.checklistItem.findMany({ where: { projectId, tenantId: tenantId.toString() } });
    return ok(rows.map((r) => this.toDomain(r)));
  }

  async delete(id: string, tenantId: TenantId): Promise<Result<void, DomainError>> {
    await this.prisma.checklistItem.deleteMany({ where: { id, tenantId: tenantId.toString() } });
    return ok(undefined);
  }

  async countByPeriod(reportingPeriodId: string, tenantId: TenantId): Promise<Result<number, DomainError>> {
    const n = await this.prisma.checklistItem.count({ where: { reportingPeriodId, tenantId: tenantId.toString() } });
    return ok(n);
  }

  async countResolvedByPeriod(reportingPeriodId: string, tenantId: TenantId): Promise<Result<number, DomainError>> {
    const n = await this.prisma.checklistItem.count({
      where: { reportingPeriodId, tenantId: tenantId.toString(), status: { in: ["RESOLVED", "ACCEPTED_RISK", "NOT_APPLICABLE"] } },
    });
    return ok(n);
  }

  private toDomain(row: {
    id: string;
    tenantId: string;
    projectId: string;
    reportingPeriodId: string;
    type: string;
    title: string;
    description: string;
    severity: string;
    relatedEntityType: string | null;
    relatedEntityId: string | null;
    assignedToId: string | null;
    dueDate: Date | null;
    status: string;
    resolutionNotes: string | null;
    createdAt: Date;
  }): ChecklistItem {
    return ChecklistItem.rehydrate({
      id: row.id,
      tenantId: row.tenantId,
      projectId: row.projectId,
      createdAt: row.createdAt,
      props: {
        reportingPeriodId: row.reportingPeriodId,
        type: row.type as ChecklistItemType,
        title: row.title,
        description: row.description,
        severity: row.severity as Severity,
        relatedEntityType: row.relatedEntityType ?? undefined,
        relatedEntityId: row.relatedEntityId ?? undefined,
        assignedToId: row.assignedToId ?? undefined,
        dueDate: row.dueDate ?? undefined,
        status: row.status as ChecklistStatus,
        resolutionNotes: row.resolutionNotes ?? undefined,
      },
    });
  }
}
