-- Phase 42.1: several places per planned activity. Additive. Re-run infra/postgres/rls.sql afterwards (adds PlannedActivityPlace; RLS forced).
CREATE TABLE "PlannedActivityPlace" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "plannedActivityId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlannedActivityPlace_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlannedActivityPlace_plannedActivityId_placeId_key" ON "PlannedActivityPlace"("plannedActivityId", "placeId");
CREATE INDEX "PlannedActivityPlace_tenantId_projectId_idx" ON "PlannedActivityPlace"("tenantId", "projectId");
CREATE INDEX "PlannedActivityPlace_tenantId_placeId_idx" ON "PlannedActivityPlace"("tenantId", "placeId");
