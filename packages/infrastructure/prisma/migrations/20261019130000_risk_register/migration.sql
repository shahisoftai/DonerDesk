-- Phase 28.7: problems and risks. Additive only. Re-run infra/postgres/rls.sql afterwards.
CREATE TABLE "ProjectRisk" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "seriousness" TEXT NOT NULL,
    "ownerId" TEXT,
    "action" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "closedNote" TEXT,
    "closedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "plannedActivityId" TEXT,
    "raisedById" TEXT NOT NULL,
    "reviewBy" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectRisk_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProjectRisk_tenantId_projectId_status_idx" ON "ProjectRisk"("tenantId", "projectId", "status");
CREATE INDEX "ProjectRisk_tenantId_ownerId_status_idx" ON "ProjectRisk"("tenantId", "ownerId", "status");
ALTER TABLE "ProjectRisk" ADD CONSTRAINT "ProjectRisk_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
