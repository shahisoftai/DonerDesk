import type { IPlannedActivityIndicatorRepository, IProgressRepository, ProgressEntryRecord } from "@donordesk/application";
import { DomainError, ok } from "@donordesk/domain";
import type { Result, TenantId } from "@donordesk/domain";
import type { PrismaClient } from "@prisma/client";
import { toDate } from "./plan-dates.js";

/** Indicators a planned activity reports on. */
export class PrismaPlannedActivityIndicatorRepository implements IPlannedActivityIndicatorRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findIndicatorIds(plannedActivityId: string, tenantId: TenantId): Promise<Result<string[], DomainError>> {
    const rows = await this.prisma.plannedActivityIndicator.findMany({ where: { tenantId: tenantId.toString(), plannedActivityId }, select: { indicatorId: true } });
    return ok(rows.map((r) => r.indicatorId));
  }

  async replace(input: { tenantId: string; projectId: string; plannedActivityId: string; indicatorIds: string[]; userId: string; now: Date }): Promise<Result<void, DomainError>> {
    await this.prisma.$transaction([
      this.prisma.plannedActivityIndicator.deleteMany({ where: { tenantId: input.tenantId, plannedActivityId: input.plannedActivityId } }),
      ...(input.indicatorIds.length
        ? [this.prisma.plannedActivityIndicator.createMany({
          data: input.indicatorIds.map((indicatorId) => ({ id: `${input.plannedActivityId}:${indicatorId}`, tenantId: input.tenantId, projectId: input.projectId, plannedActivityId: input.plannedActivityId, indicatorId, createdById: input.userId, createdAt: input.now })),
        })]
        : []),
    ]);
    return ok(undefined);
  }
}

type ProgressRow = NonNullable<Awaited<ReturnType<PrismaClient["progressEntry"]["findFirst"]>>>;

function toProgress(r: ProgressRow): ProgressEntryRecord {
  return {
    id: r.id, tenantId: r.tenantId, projectId: r.projectId, plannedActivityId: r.plannedActivityId, kind: r.kind as ProgressEntryRecord["kind"],
    from: r.fromDate.toISOString().slice(0, 10), to: r.toDate.toISOString().slice(0, 10),
    values: JSON.parse(r.valuesJson) as ProgressEntryRecord["values"], narrative: JSON.parse(r.narrativeJson) as ProgressEntryRecord["narrative"],
    absorbedById: r.absorbedById, createdById: r.createdById, updatedById: r.updatedById, createdAt: r.createdAt, updatedAt: r.updatedAt,
  };
}

/** The progress log. Saving and removing change several rows, so each is one transaction. */
export class PrismaProgressRepository implements IProgressRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByItem(plannedActivityId: string, tenantId: TenantId): Promise<Result<ProgressEntryRecord[], DomainError>> {
    const rows = await this.prisma.progressEntry.findMany({ where: { tenantId: tenantId.toString(), plannedActivityId }, orderBy: [{ fromDate: "asc" }, { kind: "asc" }] });
    return ok(rows.map(toProgress));
  }

  async save(e: ProgressEntryRecord, absorbIds: string[]): Promise<Result<void, DomainError>> {
    const data = {
      kind: e.kind, fromDate: new Date(`${e.from}T00:00:00.000Z`), toDate: new Date(`${e.to}T00:00:00.000Z`),
      valuesJson: JSON.stringify(e.values), narrativeJson: JSON.stringify(e.narrative), absorbedById: e.absorbedById, updatedById: e.updatedById, updatedAt: e.updatedAt,
    };
    try {
      await this.prisma.$transaction([
        this.prisma.progressEntry.upsert({
          where: { id: e.id },
          create: { id: e.id, tenantId: e.tenantId, projectId: e.projectId, plannedActivityId: e.plannedActivityId, createdById: e.createdById, createdAt: e.createdAt, ...data },
          update: data,
        }),
        ...(absorbIds.length ? [this.prisma.progressEntry.updateMany({ where: { tenantId: e.tenantId, plannedActivityId: e.plannedActivityId, id: { in: absorbIds } }, data: { absorbedById: e.id } })] : []),
      ]);
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") return { ok: false, error: DomainError.conflict("That day is already logged. Open that entry to change it.") };
      throw err;
    }
    return ok(undefined);
  }

  async remove(id: string, plannedActivityId: string, tenantId: TenantId): Promise<Result<boolean, DomainError>> {
    const tenant = tenantId.toString();
    const [, deleted] = await this.prisma.$transaction([
      this.prisma.progressEntry.updateMany({ where: { tenantId: tenant, plannedActivityId, absorbedById: id }, data: { absorbedById: null } }),
      this.prisma.progressEntry.deleteMany({ where: { id, tenantId: tenant, plannedActivityId } }),
    ]);
    return ok(deleted.count > 0);
  }
}
