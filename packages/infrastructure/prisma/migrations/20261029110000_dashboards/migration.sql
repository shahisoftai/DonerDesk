-- Dashboards of saved Data Center charts, and read-only share links to them (Phase 33.8). Additive.
CREATE TABLE "Dashboard" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "projectId" TEXT,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "widgetsJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Dashboard_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Dashboard_tenantId_scope_idx" ON "Dashboard"("tenantId", "scope");
CREATE INDEX "Dashboard_tenantId_projectId_idx" ON "Dashboard"("tenantId", "projectId");

CREATE TABLE "DashboardShareLink" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DashboardShareLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DashboardShareLink_tokenHash_key" ON "DashboardShareLink"("tokenHash");
CREATE INDEX "DashboardShareLink_tenantId_dashboardId_idx" ON "DashboardShareLink"("tenantId", "dashboardId");
