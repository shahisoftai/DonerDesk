-- Reports the team keeps: the question only, never figures (Phase 34.5). Additive.
CREATE TABLE "SavedReport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "queryJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SavedReport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SavedReport_tenantId_projectId_idx" ON "SavedReport"("tenantId", "projectId");
