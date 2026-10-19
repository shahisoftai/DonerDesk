-- Phase 28.1-A: finish-to-start dependencies between planned activities. Additive only.
-- Re-run infra/postgres/rls.sql afterwards (adds PlannedActivityDependency; RLS forced).
CREATE TABLE "PlannedActivityDependency" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "predecessorId" TEXT NOT NULL,
    "successorId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlannedActivityDependency_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlannedActivityDependency_predecessorId_successorId_key" ON "PlannedActivityDependency"("predecessorId", "successorId");
CREATE INDEX "PlannedActivityDependency_tenantId_projectId_idx" ON "PlannedActivityDependency"("tenantId", "projectId");
CREATE INDEX "PlannedActivityDependency_tenantId_successorId_idx" ON "PlannedActivityDependency"("tenantId", "successorId");
