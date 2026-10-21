import type { PrismaClient } from "@prisma/client";
import { ok, type AdaptationRecord, type PlainDate, type TenantId } from "@donordesk/domain";
import type { IAdaptationRepository } from "@donordesk/application";

type Row = NonNullable<Awaited<ReturnType<PrismaClient["projectAdaptation"]["findFirst"]>>>;

const toDate = (d: PlainDate): Date => new Date(`${d}T00:00:00.000Z`);
const toDay = (d: Date): PlainDate => d.toISOString().slice(0, 10);

const toDomain = (r: Row): AdaptationRecord => ({
  id: r.id, projectId: r.projectId, recordedOn: toDay(r.recordedOn), whatChanged: r.whatChanged, why: r.why,
  ...(r.effectOnResults ? { effectOnResults: r.effectOnResults } : {}),
  ...(r.plannedActivityId ? { plannedActivityId: r.plannedActivityId } : {}),
  ...(r.indicatorId ? { indicatorId: r.indicatorId } : {}),
  ...(r.reportingPeriodId ? { reportingPeriodId: r.reportingPeriodId } : {}),
  recordedById: r.recordedById,
});

/** Mutable fields are written as null (not undefined) so a cleared link or effect really clears. */
const mutable = (a: AdaptationRecord) => ({
  recordedOn: toDate(a.recordedOn), whatChanged: a.whatChanged, why: a.why, effectOnResults: a.effectOnResults ?? null,
  plannedActivityId: a.plannedActivityId ?? null, indicatorId: a.indicatorId ?? null, reportingPeriodId: a.reportingPeriodId ?? null,
});

export class PrismaAdaptationRepository implements IAdaptationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(a: AdaptationRecord, tenantId: TenantId) {
    await this.prisma.projectAdaptation.create({ data: { id: a.id, tenantId: tenantId.toString(), projectId: a.projectId, recordedById: a.recordedById, ...mutable(a) } });
    return ok(a);
  }
  async update(a: AdaptationRecord, tenantId: TenantId) {
    await this.prisma.projectAdaptation.updateMany({ where: { id: a.id, tenantId: tenantId.toString() }, data: mutable(a) });
    return ok(a);
  }
  async findById(id: string, tenantId: TenantId) {
    const row = await this.prisma.projectAdaptation.findFirst({ where: { id, tenantId: tenantId.toString() } });
    return ok(row ? toDomain(row) : null);
  }
  async findByProject(projectId: string, tenantId: TenantId) {
    const rows = await this.prisma.projectAdaptation.findMany({ where: { projectId, tenantId: tenantId.toString() }, orderBy: [{ recordedOn: "desc" }, { createdAt: "desc" }] });
    return ok(rows.map(toDomain));
  }
  async findInRange(projectId: string, start: PlainDate, end: PlainDate, tenantId: TenantId) {
    const rows = await this.prisma.projectAdaptation.findMany({
      where: { projectId, tenantId: tenantId.toString(), recordedOn: { gte: toDate(start), lte: toDate(end) } },
      orderBy: [{ recordedOn: "desc" }, { createdAt: "desc" }],
    });
    return ok(rows.map(toDomain));
  }
}
