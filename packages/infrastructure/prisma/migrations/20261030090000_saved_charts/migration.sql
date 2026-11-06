-- Charts the team keeps: the chart specification only, never data (Phase 34.1). Additive.
CREATE TABLE "SavedChart" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specJson" TEXT NOT NULL,
    "versionsJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SavedChart_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SavedChart_tenantId_projectId_idx" ON "SavedChart"("tenantId", "projectId");
CREATE INDEX "SavedChart_tenantId_ownerId_idx" ON "SavedChart"("tenantId", "ownerId");
