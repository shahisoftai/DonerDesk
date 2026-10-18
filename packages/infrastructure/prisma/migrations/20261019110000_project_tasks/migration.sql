-- Phase 28.3: requests between people. Additive only. Re-run infra/postgres/rls.sql afterwards.
ALTER TABLE "ReportingProfile" ADD COLUMN "indicatorEntryDueDays" INTEGER NOT NULL DEFAULT 5;

CREATE TABLE "ProjectTask" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subjectType" TEXT,
    "subjectId" TEXT,
    "reportingPeriodId" TEXT,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "assigneeId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "urgent" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "completedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "completionNote" TEXT,
    "closedByData" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectTask_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProjectTask_tenantId_assigneeId_status_idx" ON "ProjectTask"("tenantId", "assigneeId", "status");
CREATE INDEX "ProjectTask_tenantId_projectId_status_idx" ON "ProjectTask"("tenantId", "projectId", "status");
CREATE INDEX "ProjectTask_subjectType_subjectId_idx" ON "ProjectTask"("subjectType", "subjectId");
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
