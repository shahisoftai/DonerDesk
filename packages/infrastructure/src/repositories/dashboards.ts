import { TenantId, ok, type DashboardTemplate, type DashboardWidget, type Result } from "@donordesk/domain";
import type { IDashboardLinkRepository, IDashboardRepository, IDashboardTemplateRepository, ISavedChartRepository, IBookmarkRepository, StoredBookmark, IHomePinRepository, StoredHomePin, IHomeLayoutRepository, StoredHomeLayout, IMapOverlayRepository, StoredMapOverlay, IFeaturedDashboardRepository, StoredFeaturedDashboard, ISavedReportRepository, StoredReport, StoredChart, StoredDashboard, StoredDashboardLink, StoredDashboardTemplate } from "@donordesk/application";
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
      // updatedAt is written explicitly: the handler hands out this value as the version, so it must be the stored one (`@updatedAt` alone stamps its own clock).
      data: { name: d.name, widgetsJson: JSON.stringify(d.widgets), projectId: d.projectId ?? null, updatedAt: d.updatedAt },
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

type ChartRow = NonNullable<Awaited<ReturnType<PrismaClient["savedChart"]["findFirst"]>>>;

const specFrom = (text: string): Record<string, unknown> => {
  try { const v = JSON.parse(text); return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}; } catch { return {}; }
};

const versionsFrom = (text: string): StoredChart["versions"] => {
  try { const v = JSON.parse(text); return Array.isArray(v) ? (v as StoredChart["versions"]) : []; } catch { return []; }
};

const chartFrom = (r: ChartRow): StoredChart => ({
  id: r.id, tenantId: TenantId.create(r.tenantId), scope: r.scope as StoredChart["scope"], projectId: r.projectId, ownerId: r.ownerId, name: r.name, spec: specFrom(r.specJson), versions: versionsFrom(r.versionsJson), createdAt: r.createdAt, updatedAt: r.updatedAt,
});

export class PrismaSavedChartRepository implements ISavedChartRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(c: StoredChart): Promise<Result<void>> {
    await this.prisma.savedChart.create({ data: { id: c.id, tenantId: c.tenantId.toString(), scope: c.scope, projectId: c.projectId, ownerId: c.ownerId, name: c.name, specJson: JSON.stringify(c.spec), versionsJson: JSON.stringify(c.versions) } });
    return ok(undefined);
  }

  /** Writes every mutable field. With an expected version the write happens only if nobody saved in between. */
  async update(c: StoredChart, expectedUpdatedAt?: Date): Promise<Result<boolean>> {
    const r = await this.prisma.savedChart.updateMany({
      where: { id: c.id, tenantId: c.tenantId.toString(), ...(expectedUpdatedAt ? { updatedAt: expectedUpdatedAt } : {}) },
      data: { name: c.name, specJson: JSON.stringify(c.spec), versionsJson: JSON.stringify(c.versions), updatedAt: c.updatedAt },
    });
    return ok(r.count > 0);
  }

  async delete(id: string, tenantId: TenantId): Promise<Result<void>> {
    await this.prisma.savedChart.deleteMany({ where: { id, tenantId: tenantId.toString() } });
    return ok(undefined);
  }

  async findById(id: string, tenantId: TenantId): Promise<Result<StoredChart | null>> {
    const row = await this.prisma.savedChart.findFirst({ where: { id, tenantId: tenantId.toString() } });
    return ok(row ? chartFrom(row) : null);
  }

  async listForProject(tenantId: TenantId, projectId: string, ownerId: string): Promise<Result<StoredChart[]>> {
    const rows = await this.prisma.savedChart.findMany({
      where: { tenantId: tenantId.toString(), projectId, OR: [{ scope: "PROJECT" }, { scope: "MINE", ownerId }] },
      orderBy: { updatedAt: "desc" },
    });
    return ok(rows.map(chartFrom));
  }
}

type TemplateRow = NonNullable<Awaited<ReturnType<PrismaClient["dashboardTemplate"]["findFirst"]>>>;

const templateFrom = (r: TemplateRow): StoredDashboardTemplate => ({
  id: r.id, tenantId: TenantId.create(r.tenantId), ownerId: r.ownerId, template: { ...(JSON.parse(r.json) as DashboardTemplate), id: r.id, revision: r.revision, origin: "ORGANISATION", status: "DRAFT" }, createdAt: r.createdAt, updatedAt: r.updatedAt,
});

export class PrismaDashboardTemplateRepository implements IDashboardTemplateRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(t: StoredDashboardTemplate): Promise<Result<void>> {
    await this.prisma.dashboardTemplate.create({ data: { id: t.id, tenantId: t.tenantId.toString(), ownerId: t.ownerId, sector: t.template.sector, title: t.template.title, json: JSON.stringify(t.template), revision: t.template.revision } });
    return ok(undefined);
  }

  async update(t: StoredDashboardTemplate, expectedUpdatedAt?: Date): Promise<Result<boolean>> {
    const r = await this.prisma.dashboardTemplate.updateMany({
      where: { id: t.id, tenantId: t.tenantId.toString(), ...(expectedUpdatedAt ? { updatedAt: expectedUpdatedAt } : {}) },
      data: { sector: t.template.sector, title: t.template.title, json: JSON.stringify(t.template), revision: t.template.revision, updatedAt: t.updatedAt },
    });
    return ok(r.count > 0);
  }

  async delete(id: string, tenantId: TenantId): Promise<Result<void>> {
    await this.prisma.dashboardTemplate.deleteMany({ where: { id, tenantId: tenantId.toString() } });
    return ok(undefined);
  }

  async findById(id: string, tenantId: TenantId): Promise<Result<StoredDashboardTemplate | null>> {
    const row = await this.prisma.dashboardTemplate.findFirst({ where: { id, tenantId: tenantId.toString() } });
    return ok(row ? templateFrom(row) : null);
  }

  async list(tenantId: TenantId): Promise<Result<StoredDashboardTemplate[]>> {
    const rows = await this.prisma.dashboardTemplate.findMany({ where: { tenantId: tenantId.toString() }, orderBy: { updatedAt: "desc" } });
    return ok(rows.map(templateFrom));
  }
}

export class PrismaBookmarkRepository implements IBookmarkRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(b: StoredBookmark): Promise<Result<void>> {
    await this.prisma.bookmark.create({ data: { id: b.id, tenantId: b.tenantId.toString(), userId: b.userId, title: b.title, href: b.href } });
    return ok(undefined);
  }

  async delete(id: string, tenantId: TenantId, userId: string): Promise<Result<void>> {
    await this.prisma.bookmark.deleteMany({ where: { id, tenantId: tenantId.toString(), userId } });
    return ok(undefined);
  }

  async listForUser(tenantId: TenantId, userId: string): Promise<Result<StoredBookmark[]>> {
    const rows = await this.prisma.bookmark.findMany({ where: { tenantId: tenantId.toString(), userId }, orderBy: { createdAt: "asc" } });
    return ok(rows.map((r) => ({ id: r.id, tenantId: TenantId.create(r.tenantId), userId: r.userId, title: r.title, href: r.href, createdAt: r.createdAt })));
  }
}

type ReportRow = NonNullable<Awaited<ReturnType<PrismaClient["savedReport"]["findFirst"]>>>;
const reportFrom = (r: ReportRow): StoredReport => ({ id: r.id, tenantId: TenantId.create(r.tenantId), scope: r.scope as StoredReport["scope"], projectId: r.projectId, ownerId: r.ownerId, name: r.name, query: JSON.parse(r.queryJson) as Record<string, unknown>, createdAt: r.createdAt, updatedAt: r.updatedAt });

export class PrismaSavedReportRepository implements ISavedReportRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(r: StoredReport): Promise<Result<void>> {
    await this.prisma.savedReport.create({ data: { id: r.id, tenantId: r.tenantId.toString(), scope: r.scope, projectId: r.projectId, ownerId: r.ownerId, name: r.name, queryJson: JSON.stringify(r.query) } });
    return ok(undefined);
  }

  async update(r: StoredReport, expectedUpdatedAt?: Date): Promise<Result<boolean>> {
    const done = await this.prisma.savedReport.updateMany({ where: { id: r.id, tenantId: r.tenantId.toString(), ...(expectedUpdatedAt ? { updatedAt: expectedUpdatedAt } : {}) }, data: { name: r.name, queryJson: JSON.stringify(r.query), updatedAt: r.updatedAt } });
    return ok(done.count > 0);
  }

  async delete(id: string, tenantId: TenantId): Promise<Result<void>> {
    await this.prisma.savedReport.deleteMany({ where: { id, tenantId: tenantId.toString() } });
    return ok(undefined);
  }

  async findById(id: string, tenantId: TenantId): Promise<Result<StoredReport | null>> {
    const row = await this.prisma.savedReport.findFirst({ where: { id, tenantId: tenantId.toString() } });
    return ok(row ? reportFrom(row) : null);
  }

  async listForProject(tenantId: TenantId, projectId: string, ownerId: string): Promise<Result<StoredReport[]>> {
    const rows = await this.prisma.savedReport.findMany({ where: { tenantId: tenantId.toString(), projectId, OR: [{ scope: "PROJECT" }, { scope: "MINE", ownerId }] }, orderBy: { updatedAt: "desc" } });
    return ok(rows.map(reportFrom));
  }
}

export class PrismaHomePinRepository implements IHomePinRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async create(p: StoredHomePin): Promise<Result<void>> {
    await this.prisma.homePin.create({ data: { id: p.id, tenantId: p.tenantId.toString(), userId: p.userId, kind: p.kind, ref: p.ref, position: p.position } });
    return ok(undefined);
  }
  async delete(id: string, tenantId: TenantId, userId: string): Promise<Result<void>> {
    await this.prisma.homePin.deleteMany({ where: { id, tenantId: tenantId.toString(), userId } });
    return ok(undefined);
  }
  async listForUser(tenantId: TenantId, userId: string): Promise<Result<StoredHomePin[]>> {
    const rows = await this.prisma.homePin.findMany({ where: { tenantId: tenantId.toString(), userId }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
    return ok(rows.map((r) => ({ id: r.id, tenantId: TenantId.create(r.tenantId), userId: r.userId, kind: r.kind, ref: r.ref, position: r.position, createdAt: r.createdAt })));
  }
  async setOrder(tenantId: TenantId, userId: string, orderedIds: string[]): Promise<Result<void>> {
    await this.prisma.$transaction(orderedIds.map((id, i) => this.prisma.homePin.updateMany({ where: { id, tenantId: tenantId.toString(), userId }, data: { position: i } })));
    return ok(undefined);
  }
}

/** A person's own Home layout (Phase 40): one row per person per variant, replaced only if it is still the version the person opened. */
export class PrismaHomeLayoutRepository implements IHomeLayoutRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async find(tenantId: TenantId, userId: string, variant: string): Promise<Result<StoredHomeLayout | null>> {
    const r = await this.prisma.homeLayout.findFirst({ where: { tenantId: tenantId.toString(), userId, variant } });
    return ok(r ? { id: r.id, tenantId: TenantId.create(r.tenantId), userId: r.userId, variant: r.variant, layoutJson: r.layoutJson, updatedAt: r.updatedAt } : null);
  }
  async save(row: Omit<StoredHomeLayout, "updatedAt">, expected: Date | null): Promise<Result<boolean>> {
    const where = { tenantId: row.tenantId.toString(), userId: row.userId, variant: row.variant };
    if (expected === null) {
      try {
        await this.prisma.homeLayout.create({ data: { id: row.id, ...where, layoutJson: row.layoutJson } });
        return ok(true);
      } catch (e) {
        if ((e as { code?: string }).code === "P2002") return ok(false);
        throw e;
      }
    }
    const done = await this.prisma.homeLayout.updateMany({ where: { ...where, updatedAt: expected }, data: { layoutJson: row.layoutJson } });
    return ok(done.count > 0);
  }
  async delete(tenantId: TenantId, userId: string, variant: string): Promise<Result<void>> {
    await this.prisma.homeLayout.deleteMany({ where: { tenantId: tenantId.toString(), userId, variant } });
    return ok(undefined);
  }
}

export class PrismaMapOverlayRepository implements IMapOverlayRepository {
  constructor(private readonly prisma: PrismaClient) {}
  private from = (r: { id: string; tenantId: string; name: string; storageKey: string; sizeBytes: number; featureCount: number; uploadedById: string; createdAt: Date }): StoredMapOverlay =>
    ({ id: r.id, tenantId: TenantId.create(r.tenantId), name: r.name, storageKey: r.storageKey, sizeBytes: r.sizeBytes, featureCount: r.featureCount, uploadedById: r.uploadedById, createdAt: r.createdAt });
  async create(o: StoredMapOverlay): Promise<Result<void>> {
    await this.prisma.mapOverlay.create({ data: { id: o.id, tenantId: o.tenantId.toString(), name: o.name, storageKey: o.storageKey, sizeBytes: o.sizeBytes, featureCount: o.featureCount, uploadedById: o.uploadedById } });
    return ok(undefined);
  }
  async list(tenantId: TenantId): Promise<Result<StoredMapOverlay[]>> {
    return ok((await this.prisma.mapOverlay.findMany({ where: { tenantId: tenantId.toString() }, orderBy: { createdAt: "asc" } })).map(this.from));
  }
  async findById(id: string, tenantId: TenantId): Promise<Result<StoredMapOverlay | null>> {
    const r = await this.prisma.mapOverlay.findFirst({ where: { id, tenantId: tenantId.toString() } });
    return ok(r ? this.from(r) : null);
  }
  async delete(id: string, tenantId: TenantId): Promise<Result<void>> {
    await this.prisma.mapOverlay.deleteMany({ where: { id, tenantId: tenantId.toString() } });
    return ok(undefined);
  }
}

export class PrismaFeaturedDashboardRepository implements IFeaturedDashboardRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async list(tenantId: TenantId): Promise<Result<StoredFeaturedDashboard[]>> {
    const rows = await this.prisma.featuredDashboard.findMany({ where: { tenantId: tenantId.toString() }, orderBy: { createdAt: "asc" } });
    return ok(rows.map((r) => ({ id: r.id, tenantId: TenantId.create(r.tenantId), dashboardId: r.dashboardId, audience: r.audience, createdById: r.createdById, createdAt: r.createdAt })));
  }
  async add(f: StoredFeaturedDashboard): Promise<Result<void>> {
    await this.prisma.featuredDashboard.upsert({ where: { tenantId_dashboardId_audience: { tenantId: f.tenantId.toString(), dashboardId: f.dashboardId, audience: f.audience } }, update: {}, create: { id: f.id, tenantId: f.tenantId.toString(), dashboardId: f.dashboardId, audience: f.audience, createdById: f.createdById } });
    return ok(undefined);
  }
  async remove(dashboardId: string, tenantId: TenantId): Promise<Result<void>> {
    await this.prisma.featuredDashboard.deleteMany({ where: { dashboardId, tenantId: tenantId.toString() } });
    return ok(undefined);
  }
}
