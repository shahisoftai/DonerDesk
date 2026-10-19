import type { IPlanRevisionRepository } from "@donordesk/application";
import { DomainError, ok } from "@donordesk/domain";
import type { PlanChangeSet, PlanRevision, Result, TenantId } from "@donordesk/domain";
import type { PrismaClient } from "@prisma/client";

export class PrismaPlanRevisionRepository implements IPlanRevisionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async append(r: PlanRevision): Promise<Result<void, DomainError>> {
    await this.prisma.planRevision.create({
      data: { id: r.id, tenantId: r.tenantId, projectId: r.projectId, plannedActivityId: r.plannedActivityId, changeJson: JSON.stringify(r.change), reason: r.reason ?? null, changedById: r.changedById, changedAt: r.changedAt },
    });
    return ok(undefined);
  }

  private static toDomain(row: { id: string; tenantId: string; projectId: string; plannedActivityId: string; changeJson: string; reason: string | null; changedById: string; changedAt: Date }): PlanRevision {
    return { id: row.id, tenantId: row.tenantId, projectId: row.projectId, plannedActivityId: row.plannedActivityId, change: JSON.parse(row.changeJson) as PlanChangeSet, ...(row.reason ? { reason: row.reason } : {}), changedById: row.changedById, changedAt: row.changedAt };
  }

  async findByPlannedActivity(plannedActivityId: string, tenantId: TenantId) {
    const rows = await this.prisma.planRevision.findMany({ where: { plannedActivityId, tenantId: tenantId.toString() }, orderBy: { changedAt: "asc" } });
    return ok(rows.map(PrismaPlanRevisionRepository.toDomain));
  }

  async findRecentByProject(projectId: string, tenantId: TenantId, limit: number) {
    const rows = await this.prisma.planRevision.findMany({ where: { projectId, tenantId: tenantId.toString() }, orderBy: { changedAt: "desc" }, take: limit });
    return ok(rows.map(PrismaPlanRevisionRepository.toDomain));
  }
}
