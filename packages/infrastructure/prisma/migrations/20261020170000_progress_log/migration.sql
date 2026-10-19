-- Phase 28.1 gap closure: progress log per planned activity, and the indicators each activity reports on. Additive only.
-- Re-run infra/postgres/rls.sql afterwards (adds ProgressEntry and PlannedActivityIndicator; RLS forced).
CREATE TABLE "PlannedActivityIndicator" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "plannedActivityId" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlannedActivityIndicator_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlannedActivityIndicator_plannedActivityId_indicatorId_key" ON "PlannedActivityIndicator"("plannedActivityId", "indicatorId");
CREATE INDEX "PlannedActivityIndicator_tenantId_projectId_idx" ON "PlannedActivityIndicator"("tenantId", "projectId");

CREATE TABLE "ProgressEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "plannedActivityId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "valuesJson" TEXT NOT NULL,
    "narrativeJson" TEXT NOT NULL DEFAULT '{}',
    "absorbedById" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProgressEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProgressEntry_plannedActivityId_kind_fromDate_key" ON "ProgressEntry"("plannedActivityId", "kind", "fromDate");
CREATE INDEX "ProgressEntry_tenantId_plannedActivityId_idx" ON "ProgressEntry"("tenantId", "plannedActivityId");
