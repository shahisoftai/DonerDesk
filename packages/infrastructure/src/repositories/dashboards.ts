import { TenantId, ok, type DashboardWidget, type Result } from "@donordesk/domain";
import type { IDashboardLinkRepository, IDashboardRepository, StoredDashboard, StoredDashboardLink } from "@donordesk/application";
import type { PrismaClient } from "@prisma/client";

type DashboardRow = NonNullable<Awaited<ReturnType<PrismaClient["dashboard"]["findFirst"]>>>;
type LinkRow = NonNullable<Awaited<ReturnType<PrismaClient["dashboardShareLink"]["findFirst"]>>>;

const widgetsFrom = (text: string): DashboardWidget[] => {
  try { const v = JSON.parse(text); return Array.isArray(v) ? (v as DashboardWidget[]) : []; } catch { return []; }
};

const dashboardFrom = (r: DashboardRow): StoredDashboard => ({
  id: r.id, tenantId: TenantId.create(r.tenantId), scope: r.scope as StoredDashboard["scope"], ...(r.projectId ? { projectId: r.projectId } : {}),
  ownerId: r.ownerId, name: r.name, widgets: widgetsFrom(r.widgetsJson), createdAt: r.createdAt, updatedAt: r.updatedAt,
});

const linkFrom = (r: LinkRow): StoredDashboardLink => ({
  id: r.id, tenantId: TenantId.create(r.tenantId), dashboardId: r.dashboardId, label: r.label, tokenHash: r.tokenHash, expiresAt: r.expiresAt,
  ...(r.revokedAt ? { revokedAt: r.revokedAt } : {}), createdById: r.createdById, createdAt: r.createdAt,
});

export class PrismaDashboardRepository implements IDashboardRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(d: StoredDashboard): Promise<Result<void>> {
    await this.prisma.dashboard.create({
      data: { id: d.id, tenantId: d.tenantId.toString(), scope: d.scope, projectId: d.projectId ?? null, ownerId: d.ownerId, name: d.name, widgetsJson: JSON.stringify(d.widgets) },
    });
    return ok(undefined);
  }

  /** Writes every mutable field. With an expected version the write happens only if nobody saved in between. */
  async update(d: StoredDashboard, expectedUpdatedAt?: Date): Promise<Result<boolean>> {
    const r = await this.prisma.dashboard.updateMany({
      where: { id: d.id, tenantId: d.tenantId.toString(), ...(expectedUpdatedAt ? { updatedAt: expectedUpdatedAt } : {}) },
      data: { name: d.name, widgetsJson: JSON.stringify(d.widgets), projectId: d.projectId ?? null },
    });
    return ok(r.count > 0);
  }

  async delete(id: string, tenantId: TenantId): Promise<Result<void>> {
    await this.prisma.dashboard.deleteMany({ where: { id, tenantId: tenantId.toString() } });
    return ok(undefined);
  }

  async findById(id: string, tenantId: TenantId): Promise<Result<StoredDashboard | null>> {
    const row = await this.prisma.dashboard.findFirst({ where: { id, tenantId: tenantId.toString() } });
    return ok(row ? dashboardFrom(row) : null);
  }

  async listVisible(tenantId: TenantId, ownerId: string, projectId?: string): Promise<Result<StoredDashboard[]>> {
    const rows = await this.prisma.dashboard.findMany({
      where: {
        tenantId: tenantId.toString(),
        OR: [{ scope: "ORG" }, { scope: "MINE", ownerId }, ...(projectId ? [{ scope: "PROJECT", projectId }] : [])],
      },
      orderBy: { updatedAt: "desc" },
    });
    return ok(rows.map(dashboardFrom));
  }
}

export class PrismaDashboardLinkRepository implements IDashboardLinkRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(l: StoredDashboardLink): Promise<Result<void>> {
    await this.prisma.dashboardShareLink.create({
      data: { id: l.id, tenantId: l.tenantId.toString(), dashboardId: l.dashboardId, label: l.label, tokenHash: l.tokenHash, expiresAt: l.expiresAt, createdById: l.createdById },
    });
    return ok(undefined);
  }

  async listByDashboard(dashboardId: string, tenantId: TenantId): Promise<Result<StoredDashboardLink[]>> {
    const rows = await this.prisma.dashboardShareLink.findMany({ where: { dashboardId, tenantId: tenantId.toString() }, orderBy: { createdAt: "desc" } });
    return ok(rows.map(linkFrom));
  }

  async findById(id: string, tenantId: TenantId): Promise<Result<StoredDashboardLink | null>> {
    const row = await this.prisma.dashboardShareLink.findFirst({ where: { id, tenantId: tenantId.toString() } });
    return ok(row ? linkFrom(row) : null);
  }

  async revoke(id: string, tenantId: TenantId, at: Date): Promise<Result<void>> {
    await this.prisma.dashboardShareLink.updateMany({ where: { id, tenantId: tenantId.toString(), revokedAt: null }, data: { revokedAt: at } });
    return ok(undefined);
  }

  async deleteByDashboard(dashboardId: string, tenantId: TenantId): Promise<Result<void>> {
    await this.prisma.dashboardShareLink.deleteMany({ where: { dashboardId, tenantId: tenantId.toString() } });
    return ok(undefined);
  }

  async findByTokenHash(tokenHash: string): Promise<Result<StoredDashboardLink | null>> {
    const row = await this.prisma.dashboardShareLink.findUnique({ where: { tokenHash } });
    return ok(row ? linkFrom(row) : null);
  }
}
