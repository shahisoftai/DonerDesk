import type { IPlannedActivityPlaceRepository } from "@donordesk/application";
import { ok } from "@donordesk/domain";
import type { Result, TenantId, DomainError } from "@donordesk/domain";
import type { PrismaClient } from "@prisma/client";

/** Places a planned activity takes place in. */
export class PrismaPlannedActivityPlaceRepository implements IPlannedActivityPlaceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findPlaceIds(plannedActivityId: string, tenantId: TenantId): Promise<Result<string[], DomainError>> {
    const rows = await this.prisma.plannedActivityPlace.findMany({ where: { tenantId: tenantId.toString(), plannedActivityId }, orderBy: { createdAt: "asc" }, select: { placeId: true } });
    return ok(rows.map((r) => r.placeId));
  }

  async findPlaceIdsFor(plannedActivityIds: string[], tenantId: TenantId): Promise<Result<Map<string, string[]>, DomainError>> {
    const out = new Map<string, string[]>();
    if (plannedActivityIds.length === 0) return ok(out);
    const rows = await this.prisma.plannedActivityPlace.findMany({ where: { tenantId: tenantId.toString(), plannedActivityId: { in: plannedActivityIds } }, orderBy: { createdAt: "asc" }, select: { plannedActivityId: true, placeId: true } });
    for (const r of rows) out.set(r.plannedActivityId, [...(out.get(r.plannedActivityId) ?? []), r.placeId]);
    return ok(out);
  }

  async replace(input: { tenantId: string; projectId: string; plannedActivityId: string; placeIds: string[]; userId: string; now: Date }): Promise<Result<void, DomainError>> {
    // One timestamp per row, a millisecond apart, so the order the person chose is the order read back.
    await this.prisma.$transaction([
      this.prisma.plannedActivityPlace.deleteMany({ where: { tenantId: input.tenantId, plannedActivityId: input.plannedActivityId } }),
      ...(input.placeIds.length
        ? [this.prisma.plannedActivityPlace.createMany({
          data: input.placeIds.map((placeId, i) => ({ id: `${input.plannedActivityId}:${placeId}`, tenantId: input.tenantId, projectId: input.projectId, plannedActivityId: input.plannedActivityId, placeId, createdById: input.userId, createdAt: new Date(input.now.getTime() + i) })),
        })]
        : []),
    ]);
    return ok(undefined);
  }
}
