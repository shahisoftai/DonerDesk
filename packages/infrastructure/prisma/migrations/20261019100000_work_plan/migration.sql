-- Phase 28.1: work plan. Additive only (new tables, nullable or defaulted columns). Re-run infra/postgres/rls.sql afterwards.
ALTER TABLE "Project" ADD COLUMN "showWorkPlanning" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ActivityUpdate" ADD COLUMN "plannedActivityId" TEXT;
CREATE INDEX "ActivityUpdate_plannedActivityId_idx" ON "ActivityUpdate"("plannedActivityId");

CREATE TABLE "PlannedActivity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "location" TEXT,
    "logframeActivityId" TEXT,
    "outputId" TEXT,
    "ownerUserId" TEXT,
    "supportUserIds" TEXT NOT NULL DEFAULT '[]',
    "plannedStart" DATE NOT NULL,
    "plannedEnd" DATE NOT NULL,
    "originalStart" DATE NOT NULL,
    "originalEnd" DATE NOT NULL,
    "targetParticipants" INTEGER,
    "targetCount" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "statusReason" TEXT,
    "seriesId" TEXT,
    "recurrenceJson" TEXT,
    "evidenceRequirementsJson" TEXT NOT NULL DEFAULT '[]',
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlannedActivity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PlannedActivity_tenantId_projectId_plannedStart_idx" ON "PlannedActivity"("tenantId", "projectId", "plannedStart");
CREATE INDEX "PlannedActivity_tenantId_ownerUserId_idx" ON "PlannedActivity"("tenantId", "ownerUserId");
CREATE INDEX "PlannedActivity_seriesId_idx" ON "PlannedActivity"("seriesId");
ALTER TABLE "PlannedActivity" ADD CONSTRAINT "PlannedActivity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PlanRevision" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "plannedActivityId" TEXT NOT NULL,
    "changeJson" TEXT NOT NULL,
    "reason" TEXT,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlanRevision_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PlanRevision_tenantId_plannedActivityId_idx" ON "PlanRevision"("tenantId", "plannedActivityId");
CREATE INDEX "PlanRevision_tenantId_projectId_changedAt_idx" ON "PlanRevision"("tenantId", "projectId", "changedAt");
