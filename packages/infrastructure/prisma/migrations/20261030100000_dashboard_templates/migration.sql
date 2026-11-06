-- Dashboard templates the organisation keeps (Phase 34.3). Additive.
CREATE TABLE "DashboardTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "json" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DashboardTemplate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DashboardTemplate_tenantId_sector_idx" ON "DashboardTemplate"("tenantId", "sector");
