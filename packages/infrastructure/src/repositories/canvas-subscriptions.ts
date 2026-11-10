import { TenantId, ok, type Result } from "@donordesk/domain";
import type { ICanvasSubscriptionRepository, StoredCanvasSubscription, SubscriptionEvery } from "@donordesk/application";
import type { PrismaClient } from "@prisma/client";

type Row = NonNullable<Awaited<ReturnType<PrismaClient["canvasSubscription"]["findFirst"]>>>;
const from = (r: Row): StoredCanvasSubscription => ({ id: r.id, tenantId: TenantId.create(r.tenantId), canvasId: r.canvasId, userId: r.userId, every: r.every as SubscriptionEvery, ...(r.lastSentAt ? { lastSentAt: r.lastSentAt } : {}), createdAt: r.createdAt });

export class PrismaCanvasSubscriptionRepository implements ICanvasSubscriptionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsert(s: StoredCanvasSubscription): Promise<Result<void>> {
    await this.prisma.canvasSubscription.upsert({
      where: { canvasId_userId: { canvasId: s.canvasId, userId: s.userId } },
      create: { id: s.id, tenantId: s.tenantId.toString(), canvasId: s.canvasId, userId: s.userId, every: s.every },
      update: { every: s.every },
    });
    return ok(undefined);
  }

  async remove(canvasId: string, tenantId: TenantId, userId: string): Promise<Result<void>> {
    await this.prisma.canvasSubscription.deleteMany({ where: { canvasId, tenantId: tenantId.toString(), userId } });
    return ok(undefined);
  }

  async listForUser(tenantId: TenantId, userId: string): Promise<Result<StoredCanvasSubscription[]>> {
    return ok((await this.prisma.canvasSubscription.findMany({ where: { tenantId: tenantId.toString(), userId }, orderBy: { createdAt: "asc" } })).map(from));
  }

  async listAll(tenantId: TenantId): Promise<Result<StoredCanvasSubscription[]>> {
    return ok((await this.prisma.canvasSubscription.findMany({ where: { tenantId: tenantId.toString() }, orderBy: { createdAt: "asc" }, take: 5000 })).map(from));
  }

  async setSent(id: string, tenantId: TenantId, at: Date): Promise<Result<void>> {
    await this.prisma.canvasSubscription.updateMany({ where: { id, tenantId: tenantId.toString() }, data: { lastSentAt: at } });
    return ok(undefined);
  }
}
