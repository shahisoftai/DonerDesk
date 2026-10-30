import type { ChartVersion, DashboardScope, DashboardTemplate, DashboardWidget, Result, SavedChartScope, TenantId } from "@donordesk/domain";

export interface StoredDashboard {
  id: string;
  tenantId: TenantId;
  scope: DashboardScope;
  projectId?: string;
  ownerId: string;
  name: string;
  widgets: DashboardWidget[];
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredDashboardLink {
  id: string;
  tenantId: TenantId;
  dashboardId: string;
  label: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
  createdById: string;
  createdAt: Date;
}

export interface IDashboardRepository {
  create(d: StoredDashboard): Promise<Result<void>>;
  /** Writes every mutable field (`?? null`); the version it was read at must still be the stored one, else `false`. */
  update(d: StoredDashboard, expectedUpdatedAt?: Date): Promise<Result<boolean>>;
  delete(id: string, tenantId: TenantId): Promise<Result<void>>;
  findById(id: string, tenantId: TenantId): Promise<Result<StoredDashboard | null>>;
  /** Shared dashboards (organisation, and the project's when given) plus the person's own. */
  listVisible(tenantId: TenantId, ownerId: string, projectId?: string): Promise<Result<StoredDashboard[]>>;
}

export interface IDashboardLinkRepository {
  create(l: StoredDashboardLink): Promise<Result<void>>;
  listByDashboard(dashboardId: string, tenantId: TenantId): Promise<Result<StoredDashboardLink[]>>;
  findById(id: string, tenantId: TenantId): Promise<Result<StoredDashboardLink | null>>;
  revoke(id: string, tenantId: TenantId, at: Date): Promise<Result<void>>;
  deleteByDashboard(dashboardId: string, tenantId: TenantId): Promise<Result<void>>;
  /** Across organisations; admin connection only. */
  findByTokenHash(tokenHash: string): Promise<Result<StoredDashboardLink | null>>;
}

export interface StoredChart {
  id: string;
  tenantId: TenantId;
  scope: SavedChartScope;
  projectId: string;
  ownerId: string;
  name: string;
  /** A `ChartSpecV2`; the repository stores it as text and reads it back unchanged. */
  spec: Record<string, unknown>;
  /** The last few earlier versions, newest first. */
  versions: ChartVersion[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ISavedChartRepository {
  create(c: StoredChart): Promise<Result<void>>;
  /** Writes every mutable field; with an expected version the write happens only if nobody saved in between, else `false`. */
  update(c: StoredChart, expectedUpdatedAt?: Date): Promise<Result<boolean>>;
  delete(id: string, tenantId: TenantId): Promise<Result<void>>;
  findById(id: string, tenantId: TenantId): Promise<Result<StoredChart | null>>;
  /** The project's shared charts plus the person's own for it, newest first. */
  listForProject(tenantId: TenantId, projectId: string, ownerId: string): Promise<Result<StoredChart[]>>;
}

export interface StoredDashboardTemplate {
  id: string;
  tenantId: TenantId;
  ownerId: string;
  template: DashboardTemplate;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDashboardTemplateRepository {
  create(t: StoredDashboardTemplate): Promise<Result<void>>;
  /** With an expected version the write happens only if nobody saved in between, else `false`. */
  update(t: StoredDashboardTemplate, expectedUpdatedAt?: Date): Promise<Result<boolean>>;
  delete(id: string, tenantId: TenantId): Promise<Result<void>>;
  findById(id: string, tenantId: TenantId): Promise<Result<StoredDashboardTemplate | null>>;
  list(tenantId: TenantId): Promise<Result<StoredDashboardTemplate[]>>;
}

export interface StoredBookmark { id: string; tenantId: TenantId; userId: string; title: string; href: string; createdAt: Date }

export interface IBookmarkRepository {
  create(b: StoredBookmark): Promise<Result<void>>;
  /** Deletes only the person's own bookmark. */
  delete(id: string, tenantId: TenantId, userId: string): Promise<Result<void>>;
  /** The person's bookmarks, oldest first. */
  listForUser(tenantId: TenantId, userId: string): Promise<Result<StoredBookmark[]>>;
}

export interface StoredReport { id: string; tenantId: TenantId; scope: SavedChartScope; projectId: string; ownerId: string; name: string; query: Record<string, unknown>; createdAt: Date; updatedAt: Date }

export interface ISavedReportRepository {
  create(r: StoredReport): Promise<Result<void>>;
  /** With an expected version the write happens only if nobody saved in between, else `false`. */
  update(r: StoredReport, expectedUpdatedAt?: Date): Promise<Result<boolean>>;
  delete(id: string, tenantId: TenantId): Promise<Result<void>>;
  findById(id: string, tenantId: TenantId): Promise<Result<StoredReport | null>>;
  listForProject(tenantId: TenantId, projectId: string, ownerId: string): Promise<Result<StoredReport[]>>;
}

export interface StoredHomePin { id: string; tenantId: TenantId; userId: string; kind: string; ref: string; position: number; createdAt: Date }
/** A person's own pins. Every call is scoped to the person: nothing reads or changes another's. */
export interface IHomePinRepository {
  create(p: StoredHomePin): Promise<Result<void>>;
  delete(id: string, tenantId: TenantId, userId: string): Promise<Result<void>>;
  listForUser(tenantId: TenantId, userId: string): Promise<Result<StoredHomePin[]>>;
  /** Sets the position of the person's own pins to their place in `orderedIds`. */
  setOrder(tenantId: TenantId, userId: string, orderedIds: string[]): Promise<Result<void>>;
}

export interface StoredMapOverlay { id: string; tenantId: TenantId; name: string; storageKey: string; sizeBytes: number; featureCount: number; uploadedById: string; createdAt: Date }
export interface IMapOverlayRepository {
  create(o: StoredMapOverlay): Promise<Result<void>>;
  list(tenantId: TenantId): Promise<Result<StoredMapOverlay[]>>;
  findById(id: string, tenantId: TenantId): Promise<Result<StoredMapOverlay | null>>;
  delete(id: string, tenantId: TenantId): Promise<Result<void>>;
}

export interface StoredFeaturedDashboard { id: string; tenantId: TenantId; dashboardId: string; createdById: string; createdAt: Date }
export interface IFeaturedDashboardRepository {
  list(tenantId: TenantId): Promise<Result<StoredFeaturedDashboard[]>>;
  add(f: StoredFeaturedDashboard): Promise<Result<void>>;
  remove(dashboardId: string, tenantId: TenantId): Promise<Result<void>>;
}
