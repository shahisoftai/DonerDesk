import type { PrismaClient } from "@prisma/client";
import { ProjectRisk, ok, type PlainDate, type RiskKind, type RiskStatus, type Seriousness, type TenantId } from "@donordesk/domain";
import type { IProjectRiskRepository } from "@donordesk/application";

const toDate = (d: PlainDate): Date => new Date(`${d}T00:00:00.000Z`);
const toDay = (d: Date): PlainDate => d.toISOString().slice(0, 10);

type Row = NonNullable<Awaited<ReturnType<PrismaClient["projectRisk"]["findFirst"]>>>;

function toDomain(r: Row): ProjectRisk {
  return ProjectRisk.rehydrate({
    id: r.id, tenantId: r.tenantId, createdAt: r.createdAt, updatedAt: r.updatedAt,
    props: {
      projectId: r.projectId, kind: r.kind as RiskKind, title: r.title, seriousness: r.seriousness as Seriousness, ...(r.ownerId ? { ownerId: r.ownerId } : {}),
      action: r.action, status: r.status as RiskStatus, ...(r.closedNote ? { closedNote: r.closedNote } : {}), ...(r.closedById ? { closedById: r.closedById } : {}),
      ...(r.closedAt ? { closedAt: r.closedAt } : {}), ...(r.plannedActivityId ? { plannedActivityId: r.plannedActivityId } : {}), raisedById: r.raisedById,
      ...(r.reviewBy ? { reviewBy: toDay(r.reviewBy) } : {}),
    },
  });
}

/** Mutable fields are written as null (not undefined) so a cleared owner or review date really clears. */
function mutable(risk: ProjectRisk) {
  const s = risk.snapshot();
  return {
    kind: s.kind, title: s.title, seriousness: s.seriousness, ownerId: s.ownerId ?? null, action: s.action, status: s.status,
    closedNote: s.closedNote ?? null, closedById: s.closedById ?? null, closedAt: s.closedAt ?? null, reviewBy: s.reviewBy ? toDate(s.reviewBy) : null,
  };
}

export class PrismaProjectRiskRepository implements IProjectRiskRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(risk: ProjectRisk) {
    const s = risk.snapshot();
    await this.prisma.projectRisk.create({ data: { id: risk.id, tenantId: risk.tenantIdValue, projectId: s.projectId, plannedActivityId: s.plannedActivityId ?? null, raisedById: s.raisedById, ...mutable(risk) } });
    return ok(risk);
  }

  async update(risk: ProjectRisk) {
    await this.prisma.projectRisk.updateMany({ where: { id: risk.id, tenantId: risk.tenantIdValue }, data: mutable(risk) });
    return ok(risk);
  }

  async findById(id: string, tenantId: TenantId) {
    const row = await this.prisma.projectRisk.findFirst({ where: { id, tenantId: tenantId.toString() } });
    return ok(row ? toDomain(row) : null);
  }

  async findByProject(projectId: string, tenantId: TenantId) {
    const rows = await this.prisma.projectRisk.findMany({ where: { projectId, tenantId: tenantId.toString() }, orderBy: { createdAt: "desc" } });
    return ok(rows.map(toDomain));
  }
}
