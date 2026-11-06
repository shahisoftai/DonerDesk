-- Phase 28.1-K: a project's automation rules that are switched off. A rule with no row is on. Additive only.
-- Re-run infra/postgres/rls.sql afterwards (adds ProjectAutomation; RLS forced).
CREATE TABLE "ProjectAutomation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "updatedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectAutomation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProjectAutomation_projectId_ruleKey_key" ON "ProjectAutomation"("projectId", "ruleKey");
CREATE INDEX "ProjectAutomation_tenantId_projectId_idx" ON "ProjectAutomation"("tenantId", "projectId");
