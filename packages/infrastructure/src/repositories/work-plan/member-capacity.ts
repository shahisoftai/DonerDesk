import type { IMemberCapacityRepository } from "@donordesk/application";
import { DomainError, ok } from "@donordesk/domain";
import type { Result, TenantId } from "@donordesk/domain";
import type { PrismaClient } from "@prisma/client";

/** How many planned activities a person can lead in a week (phase 28.1-J). Blank is a null row value, never 0. */
export class PrismaMemberCapacityRepository implements IMemberCapacityRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findMany(userIds: string[], tenantId: TenantId): Promise<Result<Map<string, number | null>, DomainError>> {
    const rows = userIds.length === 0 ? [] : await this.prisma.memberCapacity.findMany({ where: { tenantId: tenantId.toString(), userId: { in: userIds } } });
    return ok(new Map(rows.map((r) => [r.userId, r.activitiesPerWeek])));
  }

  async set(userId: string, value: number | null, by: { userId: string; now: Date }, tenantId: TenantId): Promise<Result<void, DomainError>> {
    const tenant = tenantId.toString();
    await this.prisma.memberCapacity.upsert({
      where: { tenantId_userId: { tenantId: tenant, userId } },
      create: { id: `${tenant}:${userId}`, tenantId: tenant, userId, activitiesPerWeek: value, updatedById: by.userId, updatedAt: by.now },
      update: { activitiesPerWeek: value, updatedById: by.userId, updatedAt: by.now },
    });
    return ok(undefined);
  }
}
