-- Phase 28.1-I: the column mapping a project saves for KoboToolbox/ODK imports. One per project. Additive only.
-- Re-run infra/postgres/rls.sql afterwards (adds ProjectSubmissionMapping; RLS forced).
CREATE TABLE "ProjectSubmissionMapping" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "mappingJson" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectSubmissionMapping_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProjectSubmissionMapping_projectId_key" ON "ProjectSubmissionMapping"("projectId");
CREATE INDEX "ProjectSubmissionMapping_tenantId_idx" ON "ProjectSubmissionMapping"("tenantId");
