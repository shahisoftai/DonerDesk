import type { DashboardScope, DashboardWidget, Result, TenantId } from "@donordesk/domain";

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
