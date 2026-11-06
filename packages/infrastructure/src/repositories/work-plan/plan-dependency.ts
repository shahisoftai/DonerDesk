import type { IPlanDependencyRepository, PlanDependencyRecord } from "@donordesk/application";
import { DomainError, ok } from "@donordesk/domain";
import type { Result, TenantId } from "@donordesk/domain";
import type { PrismaClient } from "@prisma/client";

/** Finish-to-start links between planned activities (phase 28.1-A). A duplicate pair is a conflict. */
export class PrismaPlanDependencyRepository implements IPlanDependencyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async add(link: PlanDependencyRecord): Promise<Result<void, DomainError>> {
    try {
      await this.prisma.plannedActivityDependency.create({
        data: { id: link.id, tenantId: link.tenantId, projectId: link.projectId, predecessorId: link.predecessorId, successorId: link.successorId, createdById: link.createdById, createdAt: link.createdAt },
      });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") return { ok: false, error: DomainError.conflict("This link already exists") };
      throw e;
    }
    return ok(undefined);
  }

  async remove(predecessorId: string, successorId: string, tenantId: TenantId): Promise<Result<boolean, DomainError>> {
    const res = await this.prisma.plannedActivityDependency.deleteMany({ where: { tenantId: tenantId.toString(), predecessorId, successorId } });
    return ok(res.count > 0);
  }

  async findByProject(projectId: string, tenantId: TenantId): Promise<Result<PlanDependencyRecord[], DomainError>> {
    const rows = await this.prisma.plannedActivityDependency.findMany({ where: { tenantId: tenantId.toString(), projectId }, orderBy: { createdAt: "asc" } });
    return ok(rows.map((r) => ({ id: r.id, tenantId: r.tenantId, projectId: r.projectId, predecessorId: r.predecessorId, successorId: r.successorId, createdById: r.createdById, createdAt: r.createdAt })));
  }
}
