-- Dashboards an administrator shows on everyone's Home, or to chosen people (Phase 35). A reference only. Additive.
CREATE TABLE "FeaturedDashboard" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "audience" TEXT NOT NULL DEFAULT '*',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeaturedDashboard_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FeaturedDashboard_tenantId_dashboardId_audience_key" ON "FeaturedDashboard"("tenantId", "dashboardId", "audience");
CREATE INDEX "FeaturedDashboard_tenantId_idx" ON "FeaturedDashboard"("tenantId");
